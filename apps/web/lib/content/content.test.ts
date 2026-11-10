import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The fake client records each query and returns every fixture row for the
 * table, ignoring filters. So each rule below must hold in `lib/content`'s own
 * code, not only in the query: remove a rule and its test fails.
 */
type Query = {
  table: string;
  columns: string;
  filters: [string, unknown][];
  signal?: AbortSignal;
};

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  queries: [] as Query[],
  fail: false,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const query: Query = { table, columns: "", filters: [] };
      db.queries.push(query);
      const builder = {
        select: (columns: string) => {
          query.columns = columns;
          return builder;
        },
        eq: (column: string, value: unknown) => {
          query.filters.push([column, value]);
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        abortSignal: (signal: AbortSignal) => {
          query.signal = signal;
          return builder;
        },
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(
            db.fail || query.signal?.aborted
              ? { data: null, error: { code: "PGRST000" } }
              : { data: db.rows[table] ?? [], error: null },
          ).then(resolve, reject),
      };
      return builder;
    },
  }),
}));

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

const content = await import("./index");

const SECRET_NAME_AR = "اسم الجهة السري";
const SECRET_NAME_EN = "Secret Org Name";
const SECRET_KEY = "secret-storage-key";
const doc = (words: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: words }] }],
});

const both = (field: string, value: string) => ({
  [`${field}_ar`]: `${value} (ar)`,
  [`${field}_en`]: `${value} (en)`,
});

function seed() {
  db.queries = [];
  db.fail = false;
  db.rows = {
    home_sections: [
      {
        key: "hero",
        position: 0,
        is_visible: true,
        status: "published",
        content_ar: { name: "مثال", title: "مستشار", valueStatement: "قيمة", photoKey: "media/hero.jpg" },
        content_en: { name: "Example", title: "Consultant", valueStatement: "Value" },
      },
      { key: "stats", position: 1, is_visible: true, status: "draft", content_ar: { heading: "مسودة" }, content_en: { heading: "Draft" } },
      { key: "services", position: 2, is_visible: false, status: "published", content_ar: { heading: "مخفي" }, content_en: { heading: "Hidden" } },
    ],
    home_stats: [
      { id: "s1", label_ar: "سنوات", label_en: "Years", value: "15", position: 0, status: "published" },
      { id: "s2", label_ar: "مسودة", label_en: "Draft", value: "9", position: 1, status: "draft" },
    ],
    pages: [{ key: "about", status: "draft", ...both("title", "About"), body_ar: doc("نص"), body_en: doc("Text") }],
    timeline_items: [],
    expertise_areas: [
      { id: "e1", slug: "governance", ...both("title", "Governance"), ...both("summary", "Summary"), body_ar: null, body_en: null, position: 0, status: "published" },
      { id: "e2", slug: "draft-area", ...both("title", "Draft"), ...both("summary", "Draft"), body_ar: null, body_en: null, position: 1, status: "draft" },
    ],
    services: [
      { id: "sv1", slug: "both", expertise_id: null, ...both("title", "Both"), ...both("summary", "Both"), is_featured: true, position: 0, status: "published" },
      { id: "sv2", slug: "english-only", expertise_id: null, title_ar: null, title_en: "English only", summary_ar: null, summary_en: "Only English", is_featured: false, position: 1, status: "published" },
      { id: "sv3", slug: "arabic-only", expertise_id: null, title_ar: "عربي فقط", title_en: null, summary_ar: "عربي", summary_en: null, is_featured: false, position: 2, status: "published" },
      { id: "sv4", slug: "draft", expertise_id: null, ...both("title", "Draft"), ...both("summary", "Draft"), is_featured: false, position: 3, status: "draft" },
    ],
    projects: [
      {
        id: "p1",
        slug: "hidden",
        expertise_id: null,
        org_type: "organization",
        ...both("title", "Hidden org project"),
        org_name_ar: SECRET_NAME_AR,
        org_name_en: SECRET_NAME_EN,
        org_label_ar: "منظمة دولية",
        org_label_en: "An international organization",
        hide_org_name: true,
        ...both("goal", "Goal"),
        ...both("results", "Results"),
        is_featured: true,
        status: "published",
        created_at: "2026-01-01T00:00:00Z",
        project_images: [{ path: "projects/p1.jpg", alt_ar: "صورة", alt_en: "Photo", position: 0 }],
        project_services: [{ service_id: "sv1" }],
      },
      {
        id: "p2",
        slug: "visible",
        expertise_id: null,
        org_type: "company",
        ...both("title", "Visible org project"),
        ...both("org_name", "Example Org"),
        org_label_ar: null,
        org_label_en: null,
        hide_org_name: false,
        ...both("goal", "Goal"),
        is_featured: false,
        status: "published",
        created_at: "2026-01-02T00:00:00Z",
        project_images: [],
        project_services: [],
      },
      {
        id: "p3",
        slug: "draft",
        expertise_id: null,
        org_type: null,
        ...both("title", "Draft project"),
        hide_org_name: false,
        ...both("goal", "Goal"),
        is_featured: false,
        status: "draft",
        created_at: "2026-01-03T00:00:00Z",
        project_images: [],
        project_services: [],
      },
    ],
    faqs: [
      { id: "f1", category: "account", service_id: null, ...both("question", "Q"), ...both("answer", "A"), position: 0, status: "published" },
      { id: "f2", category: "account", service_id: null, ...both("question", "Draft Q"), ...both("answer", "A"), position: 1, status: "draft" },
    ],
    partners: [
      { id: "pa1", ...both("name", "Approved Partner"), logo_path: "logos/pa1.png", consent_confirmed: true, admin_approved: true, position: 0, status: "published" },
      { id: "pa2", ...both("name", "No Consent Partner"), logo_path: null, consent_confirmed: false, admin_approved: true, position: 1, status: "published" },
      { id: "pa3", ...both("name", "Unapproved Partner"), logo_path: null, consent_confirmed: true, admin_approved: false, position: 2, status: "published" },
      { id: "pa4", ...both("name", "Draft Partner"), logo_path: null, consent_confirmed: true, admin_approved: true, position: 3, status: "draft" },
    ],
    testimonials: [
      { id: "t1", ...both("quote", "Approved quote"), ...both("author", "Author"), partner_id: "pa1", letter_path: SECRET_KEY, consent_confirmed: true, admin_approved: true, position: 0, status: "published" },
      { id: "t2", ...both("quote", "No consent quote"), ...both("author", "Author"), partner_id: null, letter_path: SECRET_KEY, consent_confirmed: false, admin_approved: true, position: 1, status: "published" },
      { id: "t3", ...both("quote", "Unapproved quote"), ...both("author", "Author"), partner_id: null, letter_path: SECRET_KEY, consent_confirmed: true, admin_approved: false, position: 2, status: "published" },
      { id: "t4", ...both("quote", "Draft quote"), ...both("author", "Author"), partner_id: null, letter_path: SECRET_KEY, consent_confirmed: true, admin_approved: true, position: 3, status: "draft" },
      { id: "t5", ...both("quote", "Quote of no-consent partner"), ...both("author", "Author"), partner_id: "pa2", letter_path: SECRET_KEY, consent_confirmed: true, admin_approved: true, position: 4, status: "published" },
    ],
    posts: [
      { id: "po1", ...both("slug", "post"), slug_ar: "مقال", slug_en: "post", ...both("title", "Post"), excerpt_ar: null, excerpt_en: null, body_ar: doc("نص"), body_en: doc("Text"), cover_path: null, reading_minutes_ar: 3, reading_minutes_en: 3, published_at: "2026-01-01T00:00:00Z", status: "published" },
      { id: "po2", slug_ar: "مسودة", slug_en: "draft", ...both("title", "Draft post"), body_ar: doc("نص"), body_en: doc("Text"), status: "draft" },
    ],
    resources: [
      { id: "r1", kind: "guide", ...both("title", "Guide"), description_ar: null, description_en: null, storage_key: SECRET_KEY, access: "email", status: "published" },
      { id: "r2", kind: "guide", ...both("title", "Draft guide"), storage_key: SECRET_KEY, access: "direct", status: "draft" },
    ],
    media_items: [
      { id: "m1", category: "events", ...both("title", "Event"), outlet_ar: null, outlet_en: null, date: "2026-01-01", image_path: null, url: null, video_url: null, status: "published" },
      { id: "m2", category: "events", ...both("title", "Draft event"), date: "2026-01-02", status: "draft" },
    ],
    documents: [
      { id: "d1", category: "thank_you_letter", title_ar: "خطاب شكر", title_en: "Thank-you letter", storage_key: SECRET_KEY, mime: "application/pdf", access_mode: "view", status: "published" },
      { id: "d2", category: "course_certificate", title_ar: "مسودة", title_en: "Draft document", storage_key: SECRET_KEY, mime: "application/pdf", access_mode: "view", status: "draft" },
    ],
    site_settings: [
      { key: "contact_email", value: "contact@example.com" },
      { key: "cv_visible", value: false },
      { key: "cv_file_key", value: "media/cv.pdf" },
    ],
  };
}

async function everything() {
  const results = [];
  for (const locale of ["ar", "en"] as const) {
    results.push(
      await content.getHomeSections(locale),
      await content.getHomeStats(locale),
      await content.getPage("about", locale),
      await content.getTimeline(locale),
      await content.getExpertiseAreas(locale),
      await content.getExpertiseArea("draft-area", locale),
      await content.getServices(locale),
      await content.getService("draft", locale),
      await content.getProjects(locale),
      await content.getProject("hidden", locale),
      await content.getProject("draft", locale),
      await content.getFaqs(locale),
      await content.getPartners(locale),
      await content.getTestimonials(locale),
      await content.getLatestPosts(locale, 10),
      await content.getLatestResources(locale, 10),
      await content.getLatestMediaItems(locale, 10),
      await content.getPublicDocuments(locale),
    );
  }
  results.push(await content.getSiteSettings());
  return JSON.stringify(results);
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  seed();
});

describe("hidden organization names (§6.6)", () => {
  it.each(["ar", "en"] as const)("never return org_name_* for a hidden project in %s", async (locale) => {
    const list = await content.getProjects(locale);
    const detail = await content.getProject("hidden", locale);
    const json = JSON.stringify([list, detail]);

    expect(json).not.toContain(SECRET_NAME_AR);
    expect(json).not.toContain(SECRET_NAME_EN);
    expect(detail?.organization).toBe(locale === "ar" ? "منظمة دولية" : "An international organization");
    expect(list.find((project) => project.slug === "hidden")?.organization).toBe(detail?.organization);
  });

  it("shows the name of a project that isn't hidden", async () => {
    const project = await content.getProject("visible", "en");
    expect(project?.organization).toBe("Example Org (en)");
  });
});

describe("consent rule (§6.11)", () => {
  it.each(["ar", "en"] as const)("returns only consented, approved, published testimonials in %s", async (locale) => {
    const testimonials = await content.getTestimonials(locale);
    expect(testimonials.map((item) => item.id)).toEqual(["t1", "t5"]);
  });

  it("names only a public partner on a testimonial", async () => {
    const testimonials = await content.getTestimonials("en");
    expect(testimonials.find((item) => item.id === "t1")?.organization).toBe("Approved Partner (en)");
    expect(testimonials.find((item) => item.id === "t5")?.organization).toBeNull();
    expect(JSON.stringify(testimonials)).not.toContain("No Consent Partner");
  });

  it("returns only consented, approved, published partners", async () => {
    expect((await content.getPartners("ar")).map((item) => item.id)).toEqual(["pa1"]);
  });
});

describe("drafts", () => {
  it("are never returned by any read", async () => {
    const json = await everything();
    for (const marker of ["Draft", "مسودة"]) expect(json).not.toContain(marker);
  });

  it("return null for a draft's detail page", async () => {
    expect(await content.getProject("draft", "en")).toBeNull();
    expect(await content.getService("draft", "en")).toBeNull();
    expect(await content.getExpertiseArea("draft-area", "en")).toBeNull();
    expect(await content.getPage("about", "en")).toBeNull();
  });

  it("leave out draft and hidden home sections", async () => {
    expect((await content.getHomeSections("en")).map((section) => section.key)).toEqual(["hero"]);
  });
});

describe("missing translation (§6.1)", () => {
  it("leaves an English-only row out of Arabic, and keeps it in English", async () => {
    const ar = (await content.getServices("ar")).map((item) => item.slug);
    const en = (await content.getServices("en")).map((item) => item.slug);
    expect(ar).not.toContain("english-only");
    expect(en).toContain("english-only");
    expect(await content.getService("english-only", "ar")).toBeNull();
  });

  it("leaves an Arabic-only row out of English", async () => {
    expect((await content.getServices("en")).map((item) => item.slug)).not.toContain("arabic-only");
    expect((await content.getServices("ar")).map((item) => item.slug)).toContain("arabic-only");
  });

  it("returns only the requested language's fields", async () => {
    const [service] = await content.getServices("ar");
    expect(service?.title).toBe("Both (ar)");
    expect(JSON.stringify(await content.getServices("ar"))).not.toContain("(en)");
  });

  it("lists a detail page's languages for the language switch", async () => {
    expect((await content.getProject("hidden", "ar"))?.availableIn).toEqual(["ar", "en"]);
    expect((await content.getService("english-only", "en"))?.availableIn).toEqual(["en"]);
  });
});

describe("storage keys and letters", () => {
  it("never appear in any response", async () => {
    const json = await everything();
    expect(json).not.toContain(SECRET_KEY);
    expect(json).not.toMatch(/letter_?path|storage_?key|letterKey|cv_file_key|photoKey/i);
  });

  it("turn image paths into public-media URLs", async () => {
    const [hero] = await content.getHomeSections("ar");
    expect(hero?.key === "hero" && hero.content.photoUrl).toBe(
      "https://example.supabase.co/storage/v1/object/public/public-media/media/hero.jpg",
    );
    expect((await content.getPartners("en"))[0]?.logoUrl).toBe(
      "https://example.supabase.co/storage/v1/object/public/public-media/logos/pa1.png",
    );
  });

  it("show the CV only when it's visible", async () => {
    expect((await content.getSiteSettings()).cvUrl).toBeNull();
    db.rows.site_settings = [
      { key: "cv_visible", value: true },
      { key: "cv_file_key", value: "media/cv.pdf" },
    ];
    expect((await content.getSiteSettings()).cvUrl).toBe(
      "https://example.supabase.co/storage/v1/object/public/public-media/media/cv.pdf",
    );
  });
});

describe("slug checks for the proxy", () => {
  it("say yes only for a slug its detail read returns", async () => {
    expect(await content.hasService("both", "ar")).toBe(true);
    expect(await content.hasProject("hidden", "en")).toBe(true);
    expect(await content.hasExpertiseArea("governance", "ar")).toBe(true);
  });

  it("refuse a missing slug", async () => {
    expect(await content.hasService("no-such-slug", "en")).toBe(false);
    expect(await content.hasProject("no-such-slug", "en")).toBe(false);
    expect(await content.hasExpertiseArea("no-such-slug", "en")).toBe(false);
  });

  it("refuse a draft", async () => {
    expect(await content.hasService("draft", "en")).toBe(false);
    expect(await content.hasProject("draft", "en")).toBe(false);
    expect(await content.hasExpertiseArea("draft-area", "en")).toBe(false);
  });

  it("refuse a row that isn't in this language", async () => {
    expect(await content.hasService("english-only", "ar")).toBe(false);
    expect(await content.hasService("english-only", "en")).toBe(true);
    expect(await content.hasService("arabic-only", "en")).toBe(false);
  });

  it("refuse a hidden-organization project with no label in this language", async () => {
    db.rows.projects = db.rows.projects!.map((row) =>
      row.slug === "hidden" ? { ...row, org_label_en: null } : row,
    );
    expect(await content.hasProject("hidden", "en")).toBe(false);
    expect(await content.getProject("hidden", "en")).toBeNull();
    expect(await content.hasProject("hidden", "ar")).toBe(true);
  });

  it("agree with the detail reads for every fixture row", async () => {
    for (const locale of ["ar", "en"] as const) {
      for (const { slug } of db.rows.services!) {
        expect(await content.hasService(String(slug), locale), `service ${slug} ${locale}`).toBe(
          (await content.getService(String(slug), locale)) !== null,
        );
      }
      for (const { slug } of db.rows.projects!) {
        expect(await content.hasProject(String(slug), locale), `project ${slug} ${locale}`).toBe(
          (await content.getProject(String(slug), locale)) !== null,
        );
      }
      for (const { slug } of db.rows.expertise_areas!) {
        expect(await content.hasExpertiseArea(String(slug), locale), `area ${slug} ${locale}`).toBe(
          (await content.getExpertiseArea(String(slug), locale)) !== null,
        );
      }
    }
  });

  it("read one language's rule columns, by slug and status, and nothing else", async () => {
    await content.hasService("both", "ar");
    await content.hasProject("hidden", "en");
    await content.hasExpertiseArea("governance", "ar");
    expect(db.queries.map((query) => query.columns)).toEqual([
      "slug, status, title_ar, summary_ar",
      "slug, status, title_en, goal_en, hide_org_name, org_label_en",
      "slug, status, title_ar, summary_ar",
    ]);
    for (const query of db.queries) {
      expect(query.filters, query.table).toContainEqual(["status", "published"]);
      expect(query.filters.map(([column]) => column), query.table).toContain("slug");
    }
  });

  it("hand a given signal to the query, and throw when it is aborted", async () => {
    const live = new AbortController();
    expect(await content.hasService("both", "ar", live.signal)).toBe(true);
    expect(await content.hasProject("hidden", "ar", live.signal)).toBe(true);
    expect(await content.hasExpertiseArea("governance", "ar", live.signal)).toBe(true);
    expect(db.queries.map((query) => query.signal)).toEqual([live.signal, live.signal, live.signal]);

    const aborted = AbortSignal.abort();
    await expect(content.hasService("both", "ar", aborted)).rejects.toThrow("services failed");
    await expect(content.hasProject("hidden", "ar", aborted)).rejects.toThrow("projects failed");
    await expect(content.hasExpertiseArea("governance", "ar", aborted)).rejects.toThrow(
      "expertise_areas failed",
    );
  });

  it("throw when the query fails, so the proxy can pass the request on", async () => {
    db.fail = true;
    await expect(content.hasService("both", "ar")).rejects.toThrow("lib/content services failed");
  });
});

describe("queries", () => {
  it("select explicit columns, never *, letter_path or storage_key", async () => {
    await everything();
    expect(db.queries.length).toBeGreaterThan(0);
    for (const query of db.queries) {
      expect(query.columns, query.table).not.toBe("");
      expect(query.columns, query.table).not.toContain("*");
      expect(query.columns, query.table).not.toMatch(/letter_path|storage_key|access_mode/);
    }
  });

  it("filter on status in the database too", async () => {
    await everything();
    for (const query of db.queries.filter((item) => item.table !== "site_settings")) {
      expect(query.filters, query.table).toContainEqual(["status", "published"]);
    }
  });
});
