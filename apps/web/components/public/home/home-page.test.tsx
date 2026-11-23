// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { prerender } from "react-dom/static.edge";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeSection } from "@/lib/content";

// The page lives in app/[locale]/(public)/page.tsx; its sections live here.

const content = vi.hoisted(() => ({
  sections: [] as unknown[],
  stats: [] as unknown[],
  areas: [] as unknown[],
  services: [] as unknown[],
  projects: [] as unknown[],
  partners: [] as unknown[],
  testimonials: [] as unknown[],
  media: [] as unknown[],
  posts: [] as unknown[],
  resources: [] as unknown[],
  writtenAt: null as string | null,
  /** Reads that throw, to check a section's error. */
  failing: new Set<string>(),
  calls: [] as string[],
  /** When set, getHomeSections waits on it, to see what starts before it ends. */
  sectionsGate: null as Promise<void> | null,
}));

vi.mock("@/lib/content", () => {
  const read = (name: string, value: () => unknown) => async () => {
    content.calls.push(name);
    if (content.failing.has(name)) throw new Error(`${name} failed`);
    return value();
  };
  return {
    getHomeSections: async () => {
      content.calls.push("sections");
      if (content.sectionsGate) await content.sectionsGate;
      return content.sections;
    },
    getHomeStats: read("stats", () => content.stats),
    getExpertiseAreas: read("areas", () => content.areas),
    getServices: read("services", () => content.services),
    getProjects: read("projects", () => content.projects),
    getPartners: read("partners", () => content.partners),
    getTestimonials: read("testimonials", () => content.testimonials),
    getLatestMediaItems: read("media", () => content.media),
    getLatestPosts: read("posts", () => content.posts),
    getLatestResources: read("resources", () => content.resources),
    getSiteSettings: read("settings", () => ({
      contactEmail: "contact@example.com",
      whatsappNumber: null,
      linkedinUrl: null,
      socialLinks: [],
      cvUrl: null,
    })),
  };
});
vi.mock("@/lib/content/home", () => ({
  getLetterWrittenAt: async () => {
    content.calls.push("letterDate");
    if (content.failing.has("letterDate")) throw new Error("letterDate failed");
    return content.writtenAt;
  },
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
  useTranslations: () => (key: string) => key,
  // The newsletter form, a client component, reads the page's language.
  useLocale: () => "en",
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  useRouter: () => ({ refresh: () => {} }),
}));
// The page waits for a request before reading content; tests have none.
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
vi.mock("@/components/consultation-button", () => ({
  ConsultationButton: () => <button type="button">requestConsultation</button>,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const { default: HomePage } = await import("@/app/[locale]/(public)/page");

const heading = (text: string) => ({ heading: text });

function section(key: HomeSection["key"], position: number): HomeSection {
  const sectionContent =
    key === "hero"
      ? { name: "Example Name", title: "Consultant", valueStatement: "Value", photoUrl: null }
      : key === "letter"
        ? {
            heading: "A letter",
            salutation: "To whoever is reading this,",
            paragraphs: ["Placeholder paragraph."],
            signOff: "Ahmed",
            isPlaceholder: true,
            signatureUrl: null,
            signatureDarkUrl: null,
          }
        : key === "audiences"
        ? { ...heading("Who I work with"), items: [{ title: "A" }, { title: "B" }, { title: "C" }] }
        : heading(`${key} heading`);
  return { key, position, content: sectionContent } as HomeSection;
}

/**
 * The page is a server component whose sections read their own rows behind
 * Suspense: prerender it, which waits for every section and writes each in
 * place, then read the HTML. A section whose read fails stays on its skeleton here; in the browser
 * its boundary then shows the error (sections.test.tsx, SectionBoundary).
 */
async function renderPage(locale = "en") {
  const { prelude } = await prerender(await HomePage({ params: Promise.resolve({ locale }) }), {
    onError: () => {},
  });
  document.body.innerHTML = await new Response(prelude).text();
  revealStreamedSections();
}

/**
 * What React's inline `$RC(boundary, segment)` script does in a browser: a
 * section that finished after the shell arrives as a hidden segment, and
 * replaces its skeleton. jsdom doesn't run those scripts, so this does.
 */
function revealStreamedSections() {
  for (const script of [...document.querySelectorAll("script")]) {
    const match = /\$RC\("([^"]+)","([^"]+)"\)/.exec(script.textContent ?? "");
    script.remove();
    if (!match) continue;
    const marker = document.getElementById(match[1]!);
    const segment = document.getElementById(match[2]!);
    if (!marker || !segment) continue;
    // The skeleton runs from the template to the boundary's closing comment.
    let node = marker.nextSibling;
    while (node && !(node.nodeType === Node.COMMENT_NODE && node.nodeValue === "/$")) {
      const next = node.nextSibling;
      node.remove();
      node = next;
    }
    marker.replaceWith(...segment.childNodes);
    segment.remove();
  }
}

const cleanup = () => {
  document.body.innerHTML = "";
};

const shownSections = () =>
  [...document.querySelectorAll("main [data-section]")].map((element) => element.getAttribute("data-section"));

beforeEach(() => {
  content.calls = [];
  content.failing = new Set();
  content.sectionsGate = null;
  content.writtenAt = null;
  content.stats = [{ id: "s1", label: "Projects", value: "40" }];
  content.areas = [{ id: "a1", slug: "governance", title: "Governance", summary: "Summary" }];
  content.services = [
    { id: "v1", slug: "featured", title: "Featured service", summary: "S", isFeatured: true, expertiseId: null },
    { id: "v2", slug: "other", title: "Other service", summary: "S", isFeatured: false, expertiseId: null },
  ];
  content.projects = [];
  content.partners = [{ id: "p1", name: "Example Org A", logoUrl: null }];
  content.testimonials = [{ id: "t1", quote: "Approved quote", author: "Example", organization: null }];
  content.media = [];
  content.posts = [];
  content.resources = [];
});

afterEach(cleanup);

const ALL = [
  "hero",
  "letter",
  "stats",
  "expertise",
  "audiences",
  "services",
  "projects",
  "partners",
  "testimonials",
  "media",
  "latest",
  "newsletter",
  "contact",
] as const;

function seedLike() {
  content.projects = [
    {
      id: "j1",
      slug: "example-project",
      expertiseId: null,
      orgType: null,
      title: "Example project",
      organization: null,
      goal: "Goal",
      keyResult: null,
      isFeatured: true,
      coverUrl: null,
    },
  ];
  content.media = [
    { id: "m1", category: "events", title: "Talk", outlet: null, date: null, imageUrl: null, url: null, videoUrl: null },
  ];
  content.posts = [
    {
      id: "b1",
      slug: "example-article",
      title: "Example article",
      excerpt: null,
      coverUrl: null,
      readingMinutes: 4,
      publishedAt: "2026-10-01T09:00:00Z",
    },
  ];
  content.resources = [{ id: "r1", kind: "guide", title: "Guide", description: null, access: "direct" }];
}

describe("home page", () => {
  it("renders the sections in the order lib/content returns them", async () => {
    content.sections = [section("contact", 1), section("hero", 2), section("partners", 3), section("expertise", 4)];
    await renderPage();
    expect(shownSections()).toEqual(["contact", "hero", "partners", "expertise"]);
  });

  it("composes every section as the mockup: stats in the hero, media in «Speaking and writing»", async () => {
    seedLike();
    content.sections = ALL.map((key, index) => section(key, index + 1));
    for (const locale of ["ar", "en"]) {
      content.calls = [];
      await renderPage(locale);
      expect(shownSections()).toEqual([
        "hero",
        "letter",
        "expertise",
        "audiences",
        "services",
        "projects",
        "partners",
        "testimonials",
        "latest",
        "newsletter",
        "contact",
      ]);
      // The ledger is inside the hero; the media item leads the reading section.
      const hero = document.querySelector('[data-section="hero"]') as HTMLElement;
      expect(within(hero).getByText("Projects")).toBeTruthy();
      const reading = document.querySelector('[data-section="latest"]') as HTMLElement;
      expect(within(reading).getByRole("heading", { level: 3, name: "Talk" })).toBeTruthy();
      const hrefs = [...document.querySelectorAll("a[href]")].map((link) => link.getAttribute("href") ?? "");
      expect(hrefs).toEqual(expect.arrayContaining(["/blog", "/blog/example-article", "/resources"]));
      cleanup();
    }
  });

  it("gives stats and media their own sections when their partner is hidden", async () => {
    seedLike();
    content.sections = [section("stats", 1), section("media", 2)];
    await renderPage();
    expect(shownSections()).toEqual(["stats", "media"]);
  });

  it("follows the dashboard's toggles: a hidden stats or media section stays out of its partner", async () => {
    seedLike();
    content.sections = [section("hero", 1), section("latest", 2)];
    await renderPage();
    const hero = document.querySelector('[data-section="hero"]') as HTMLElement;
    expect(within(hero).queryByText("Projects")).toBeNull();
    const reading = document.querySelector('[data-section="latest"]') as HTMLElement;
    expect(within(reading).queryByRole("heading", { level: 3, name: "Talk" })).toBeNull();
    // The stats are read with the sections either way (T36); the media block's own read never runs.
    expect(content.calls).not.toContain("media");
  });

  it("shows the placeholder letter with its tag and no date; hidden, it leaves no trace", async () => {
    content.writtenAt = "2026-03-10T08:00:00Z";
    content.sections = [section("hero", 1), section("letter", 2), section("expertise", 3)];
    await renderPage();
    const letter = document.querySelector('[data-section="letter"]') as HTMLElement;
    expect(within(letter).getByRole("heading", { level: 2, name: "A letter" })).toBeTruthy();
    expect(within(letter).getByText("placeholderTag")).toBeTruthy();
    expect(within(letter).queryByText("letterWritten")).toBeNull();
    cleanup();

    content.calls = [];
    content.sections = [section("hero", 1), section("expertise", 3)];
    await renderPage();
    expect(shownSections()).toEqual(["hero", "expertise"]);
    expect(document.querySelector('[data-section="letter"]')).toBeNull();
    expect(document.body.textContent).not.toContain("letterWritten");
  });

  it("shows the newsletter signup under the dashboard's heading, with no read of its own", async () => {
    content.sections = [section("hero", 1), section("newsletter", 2)];
    await renderPage();
    expect(shownSections()).toEqual(["hero", "newsletter"]);
    const block = document.querySelector('main [data-section="newsletter"]') as HTMLElement;
    expect(within(block).getByRole("heading", { level: 2, name: "newsletter heading" })).toBeTruthy();
    expect(within(block).getByLabelText("email")).toBeTruthy();
    expect(within(block).getByRole("button", { name: "subscribe" })).toBeTruthy();
    expect(content.calls.sort()).toEqual(["letterDate", "sections", "stats"]);
  });

  it("leaves out sections with nothing to show", async () => {
    content.sections = [section("stats", 1), section("projects", 2), section("testimonials", 3), section("latest", 4)];
    content.stats = [];
    content.testimonials = [];
    await renderPage();
    expect(shownSections()).toEqual([]);
  });

  it("keeps the page when one section's read fails", async () => {
    content.failing = new Set(["areas"]);
    content.sections = [section("hero", 1), section("expertise", 2), section("partners", 3)];
    await renderPage();
    // The failed section waits on its skeleton for the browser's boundary; the rest renders.
    expect(shownSections()).toEqual(["hero", "expertise", "partners"]);
    const failed = document.querySelector('[data-section="expertise"]') as HTMLElement;
    expect(within(failed).getByRole("status").textContent).toBe("loading");
    expect(within(document.querySelector('[data-section="partners"]') as HTMLElement).getByText("Example Org A")).toBeTruthy();
  });

  it("shows only featured services", async () => {
    content.sections = [section("services", 1)];
    await renderPage();
    expect(screen.getByText("Featured service")).toBeTruthy();
    expect(screen.queryByText("Other service")).toBeNull();
  });

  it("reads only what the visible sections need, besides the opening reads", async () => {
    content.sections = [section("hero", 1), section("expertise", 2)];
    await renderPage();
    // The stats and the letter date always run with the sections (T36);
    // hidden sections' own block reads never run.
    expect(content.calls.sort()).toEqual(["areas", "letterDate", "sections", "stats"]);
  });

  it("starts the opening reads with the sections, not after them", async () => {
    let release = () => {};
    content.sectionsGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    content.sections = [section("hero", 1), section("stats", 2), section("letter", 3)];
    const page = HomePage({ params: Promise.resolve({ locale: "en" }) });
    await vi.waitFor(() => expect(content.calls).toContain("sections"));
    // getHomeSections hasn't returned yet, and the stats and the date are already on their way.
    expect(content.calls.sort()).toEqual(["letterDate", "sections", "stats"]);
    release();
    await page;
  });

  it("keeps the hero and the letter when the stats or the date fail: only the ledger or the date goes", async () => {
    content.writtenAt = "2026-03-10T08:00:00Z";
    const placeholder = section("letter", 3) as Extract<HomeSection, { key: "letter" }>;
    const signed = { ...placeholder, content: { ...placeholder.content, isPlaceholder: false } };
    content.sections = [section("hero", 1), section("stats", 2), signed];
    await renderPage();
    const hero = () => document.querySelector('[data-section="hero"]') as HTMLElement;
    expect(within(hero()).getByText("Projects")).toBeTruthy();
    expect(document.querySelector('[data-section="letter"]')?.textContent).toContain("letterWritten");
    cleanup();

    content.failing = new Set(["stats", "letterDate"]);
    await renderPage();
    expect(shownSections()).toEqual(["hero", "letter"]);
    expect(within(hero()).getByRole("heading", { level: 1, name: "Example Name" })).toBeTruthy();
    expect(within(hero()).queryByText("Projects")).toBeNull();
    const letter = document.querySelector('[data-section="letter"]') as HTMLElement;
    expect(within(letter).getByRole("heading", { level: 2, name: "A letter" })).toBeTruthy();
    expect(letter.textContent).not.toContain("letterWritten");
  });

  it("has exactly one h1: the hero's name, or the site name without a hero", async () => {
    content.sections = [section("hero", 1), section("expertise", 2)];
    await renderPage();
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Example Name"]);
    cleanup();

    content.sections = [section("expertise", 1)];
    await renderPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("links the hero to the about page and the consultation flow", async () => {
    content.sections = [section("hero", 1)];
    await renderPage("ar");
    expect(screen.getByRole("link", { name: "aboutCta" }).getAttribute("href")).toBe("/about");
    expect(screen.getByRole("button", { name: "requestConsultation" })).toBeTruthy();
  });

  it("refuses an unknown locale", async () => {
    await expect(HomePage({ params: Promise.resolve({ locale: "fr" }) })).rejects.toThrow("NOT_FOUND");
  });
});
