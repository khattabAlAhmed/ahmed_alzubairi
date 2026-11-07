import { contentRowSchemas, errorResponseSchema } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import adminEn from "@/messages/en/AdminErrors.json";
import en from "@/messages/en.json";
import type { DbRow } from "./columns";
import {
  createContent,
  listContent,
  updateContent,
  type ContentDeps,
  type ContentStore,
  type WriteOutcome,
} from "./handlers";

const ID = "3f8a7c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b";
const SERVICE_ID = "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const NOW = "2026-11-07T10:00:00.123456+00:00";

function fakeStore(rows: Record<string, DbRow> = {}) {
  const store = {
    list: vi.fn(async () => Object.values(rows)),
    get: vi.fn(async (_type, ref) => rows[ref.value] ?? null),
    insert: vi.fn(async (): Promise<WriteOutcome> => ({ ok: true, id: ID })),
    update: vi.fn(
      async (_type, ref): Promise<WriteOutcome> =>
        rows[ref.value]
          ? { ok: true, id: ref.value }
          : { ok: false, reason: "not_found" },
    ),
    replaceProjectImages: vi.fn(async () => {}),
    replaceProjectServices: vi.fn(
      async (projectId: string): Promise<WriteOutcome> => ({
        ok: true,
        id: projectId,
      }),
    ),
    servicesExist: vi.fn(async () => true),
    remove: vi.fn(async () => {}),
    audit: vi.fn(async () => {}),
  } satisfies ContentStore;
  return store;
}

function deps(store: ContentStore) {
  return {
    locale: "en",
    userId: "user_editor",
    store,
    revalidate: vi.fn((tag: string) => void tag),
  } satisfies ContentDeps;
}

const testimonialRow = (overrides: DbRow = {}): DbRow => ({
  id: ID,
  quote_ar: "عمل متميز",
  quote_en: null,
  author_ar: "مدير البرامج",
  author_en: null,
  partner_id: null,
  letter_path: "internal/letter.pdf",
  consent_confirmed: false,
  admin_approved: false,
  approved_by: null,
  position: 0,
  status: "draft",
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

const serviceRow = (overrides: DbRow = {}): DbRow => ({
  id: ID,
  slug: "governance",
  expertise_id: null,
  title_ar: null,
  title_en: "Governance",
  summary_ar: null,
  summary_en: "Institutional governance.",
  status: "published",
  is_featured: false,
  position: 1,
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

describe("refused cases", () => {
  it("an unknown type is 400", async () => {
    const store = fakeStore();
    const result = await listContent("site_settings", deps(store));
    expect(result.status).toBe(400);
    expect(store.list).not.toHaveBeenCalled();
  });

  it("an invalid body is 400, and nothing is written", async () => {
    const store = fakeStore();
    const d = deps(store);
    const result = await createContent("services", { status: "live" }, d);
    expect(result).toEqual({
      status: 400,
      body: {
        error: {
          code: "validation_failed",
          message: en.Errors.validation_failed,
        },
      },
    });
    expect(store.insert).not.toHaveBeenCalled();
    expect(d.revalidate).not.toHaveBeenCalled();
  });

  it("a missing body is 400", async () => {
    const result = await createContent("faqs", undefined, deps(fakeStore()));
    expect(result.status).toBe(400);
  });

  it.each([
    ["adminApproved", true],
    ["approvedBy", "user_editor"],
    ["admin_approved", true],
  ])("a body setting %s is 400, on create and update", async (field, value) => {
    const store = fakeStore({ [ID]: testimonialRow() });
    const create = await createContent(
      "testimonials",
      { status: "draft", quoteAr: "نص", [field]: value },
      deps(store),
    );
    const update = await updateContent(
      "testimonials",
      { id: ID, [field]: value },
      deps(store),
    );
    expect(create.status).toBe(400);
    expect(update.status).toBe(400);
    expect(store.insert).not.toHaveBeenCalled();
    expect(store.update).not.toHaveBeenCalled();
  });

  it("creating a published testimonial is refused: it has no approval yet", async () => {
    const store = fakeStore();
    const result = await createContent(
      "testimonials",
      {
        status: "published",
        quoteAr: "عمل متميز",
        authorAr: "مدير البرامج",
        consentConfirmed: true,
      },
      deps(store),
    );
    expect(result).toEqual({
      status: 422,
      body: {
        error: { code: "validation_failed", message: adminEn.publishNotApproved },
      },
    });
    expect(store.insert).not.toHaveBeenCalled();
  });

  it("publishing a testimonial without consent is refused", async () => {
    const store = fakeStore({ [ID]: testimonialRow({ admin_approved: true }) });
    const result = await updateContent(
      "testimonials",
      { id: ID, status: "published" },
      deps(store),
    );
    expect(result.status).toBe(422);
    expect(result.body).toEqual({
      error: { code: "validation_failed", message: adminEn.publishNoConsent },
    });
    expect(store.update).not.toHaveBeenCalled();
  });

  it("publishing a testimonial without admin approval is refused", async () => {
    const store = fakeStore({
      [ID]: testimonialRow({ consent_confirmed: true }),
    });
    const result = await updateContent(
      "testimonials",
      { id: ID, status: "published" },
      deps(store),
    );
    expect(result.body).toEqual({
      error: { code: "validation_failed", message: adminEn.publishNotApproved },
    });
    expect(store.update).not.toHaveBeenCalled();
  });

  it("publishing a partner without consent or approval is refused", async () => {
    const store = fakeStore({
      [ID]: {
        id: ID,
        name_en: "UNDP",
        consent_confirmed: false,
        admin_approved: false,
        status: "draft",
        created_at: NOW,
        updated_at: NOW,
      },
    });
    const result = await updateContent(
      "partners",
      { id: ID, status: "published" },
      deps(store),
    );
    expect(result.status).toBe(422);
  });

  it("withdrawing consent on a published testimonial is refused", async () => {
    const store = fakeStore({
      [ID]: testimonialRow({
        status: "published",
        consent_confirmed: true,
        admin_approved: true,
      }),
    });
    const result = await updateContent(
      "testimonials",
      { id: ID, consentConfirmed: false },
      deps(store),
    );
    expect(result.status).toBe(422);
  });

  it("an edit that leaves a published row with no language is refused", async () => {
    const store = fakeStore({ [ID]: serviceRow() });
    const result = await updateContent(
      "services",
      { id: ID, titleEn: " " },
      deps(store),
    );
    // " " trims to empty, which the schema refuses before the publish rule.
    expect(result.status).toBe(400);
    const store2 = fakeStore({ [ID]: serviceRow({ summary_en: null }) });
    const edit = await updateContent(
      "services",
      { id: ID, isFeatured: true },
      deps(store2),
    );
    expect(edit.body).toEqual({
      error: { code: "validation_failed", message: adminEn.publishNoLanguage },
    });
  });

  it("a published stat needs its value", async () => {
    const result = await createContent(
      "home_stats",
      { status: "published", labelAr: "سنوات الخبرة" },
      deps(fakeStore()),
    );
    expect(result.body).toEqual({
      error: { code: "validation_failed", message: adminEn.publishNoValue },
    });
  });

  it("updating a missing row is 404", async () => {
    const result = await updateContent(
      "services",
      { id: ID, isFeatured: true },
      deps(fakeStore()),
    );
    expect(result).toEqual({
      status: 404,
      body: { error: { code: "not_found", message: adminEn.notFound } },
    });
  });

  it("a duplicate slug or page key is 409", async () => {
    const store = fakeStore();
    store.insert.mockResolvedValueOnce({ ok: false, reason: "conflict" });
    const result = await createContent(
      "pages",
      { status: "draft", key: "about" },
      deps(store),
    );
    expect(result).toEqual({
      status: 409,
      body: { error: { code: "conflict", message: adminEn.conflict } },
    });
  });

  it("a link to a missing row is 400", async () => {
    const store = fakeStore();
    store.insert.mockResolvedValueOnce({
      ok: false,
      reason: "invalid_reference",
    });
    const result = await createContent(
      "services",
      { status: "draft", slug: "x", expertiseId: SERVICE_ID },
      deps(store),
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      error: { code: "validation_failed", message: adminEn.invalidReference },
    });
  });

  it("home sections can't be created", async () => {
    const result = await createContent(
      "home_sections",
      { key: "hero" },
      deps(fakeStore()),
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      error: { code: "validation_failed", message: adminEn.noPostCreate },
    });
  });

  it("a home section's content must match its key", async () => {
    const store = fakeStore({ hero: { key: "hero", status: "draft" } });
    const result = await updateContent(
      "home_sections",
      { key: "hero", contentEn: { heading: "Not a hero" } },
      deps(store),
    );
    expect(result.status).toBe(400);
  });

  it("every error body follows the shared error shape", async () => {
    const result = await createContent("services", {}, deps(fakeStore()));
    expect(errorResponseSchema.safeParse(result.body).success).toBe(true);
  });
});

describe("successful writes", () => {
  it("a draft create inserts its columns, refreshes the tag and writes no audit row", async () => {
    const store = fakeStore();
    const d = deps(store);
    const result = await createContent(
      "media_items",
      {
        status: "draft",
        category: "events",
        titleEn: "Forum",
        imageKey: "media/forum.jpg",
        videoUrl: "https://youtube.com/watch?v=1",
      },
      d,
    );
    expect(result).toEqual({ status: 201, body: { id: ID } });
    expect(store.insert).toHaveBeenCalledWith("media_items", {
      status: "draft",
      category: "events",
      title_en: "Forum",
      image_path: "media/forum.jpg",
      video_url: "https://youtube.com/watch?v=1",
    });
    expect(d.revalidate).toHaveBeenCalledWith("content:media_items");
    expect(store.audit).not.toHaveBeenCalled();
  });

  it("a published create writes a publish audit row", async () => {
    const store = fakeStore();
    const d = deps(store);
    await createContent(
      "faqs",
      {
        status: "published",
        category: "account",
        questionEn: "Q?",
        answerEn: "A.",
      },
      d,
    );
    expect(store.audit).toHaveBeenCalledWith({
      actorId: "user_editor",
      action: "content.publish",
      entity: "faqs",
      entityId: ID,
      metadata: { fields: ["answerEn", "category", "questionEn", "status"] },
    });
    expect(d.revalidate).toHaveBeenCalledWith("content:faqs");
  });

  it("publishing an approved testimonial with consent writes the row, the audit and the tag", async () => {
    const store = fakeStore({
      [ID]: testimonialRow({ consent_confirmed: true, admin_approved: true }),
    });
    const d = deps(store);
    const result = await updateContent(
      "testimonials",
      { id: ID, status: "published" },
      d,
    );
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(store.update).toHaveBeenCalledWith(
      "testimonials",
      { column: "id", value: ID },
      { status: "published" },
    );
    expect(store.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "content.publish", entityId: ID }),
    );
    expect(d.revalidate).toHaveBeenCalledWith("content:testimonials");
  });

  it("unpublishing writes an unpublish audit row", async () => {
    const store = fakeStore({ [ID]: serviceRow() });
    await updateContent("services", { id: ID, status: "draft" }, deps(store));
    expect(store.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "content.unpublish" }),
    );
  });

  it("an edit to a published row writes an edit audit row", async () => {
    const store = fakeStore({ [ID]: serviceRow() });
    await updateContent(
      "services",
      { id: ID, titleAr: "الحوكمة" },
      deps(store),
    );
    expect(store.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "content.edit",
        metadata: { fields: ["titleAr"] },
      }),
    );
  });

  it("an edit to a draft writes no audit row, but refreshes the tag", async () => {
    const store = fakeStore({ [ID]: serviceRow({ status: "draft" }) });
    const d = deps(store);
    await updateContent("services", { id: ID, titleAr: "الحوكمة" }, d);
    expect(store.audit).not.toHaveBeenCalled();
    expect(d.revalidate).toHaveBeenCalledWith("content:services");
  });

  it("home sections patch by key", async () => {
    const store = fakeStore({
      hero: { key: "hero", status: "draft", position: 1, is_visible: false },
    });
    const d = deps(store);
    const result = await updateContent(
      "home_sections",
      {
        key: "hero",
        status: "published",
        isVisible: true,
        contentAr: { name: "أحمد", title: "مستشار", valueStatement: "حوكمة فعّالة" },
      },
      d,
    );
    expect(result.status).toBe(200);
    expect(store.update).toHaveBeenCalledWith(
      "home_sections",
      { column: "key", value: "hero" },
      {
        status: "published",
        is_visible: true,
        content_ar: { name: "أحمد", title: "مستشار", valueStatement: "حوكمة فعّالة" },
      },
    );
    expect(store.audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "home_sections", entityId: "hero" }),
    );
    expect(d.revalidate).toHaveBeenCalledWith("content:home_sections");
  });

  it("a project writes its images and services", async () => {
    const store = fakeStore();
    await createContent(
      "projects",
      {
        status: "draft",
        slug: "youth",
        titleAr: "تمكين الشباب",
        images: [{ key: "media/a.jpg", altAr: "صورة" }],
        serviceIds: [SERVICE_ID],
      },
      deps(store),
    );
    expect(store.insert).toHaveBeenCalledWith("projects", {
      status: "draft",
      slug: "youth",
      title_ar: "تمكين الشباب",
    });
    expect(store.replaceProjectImages).toHaveBeenCalledWith(ID, [
      {
        project_id: ID,
        path: "media/a.jpg",
        alt_ar: "صورة",
        alt_en: null,
        position: 0,
      },
    ]);
    expect(store.replaceProjectServices).toHaveBeenCalledWith(ID, [SERVICE_ID]);
  });

  it("refuses an unknown service before writing anything", async () => {
    const store = fakeStore();
    store.servicesExist.mockResolvedValueOnce(false);
    const d = deps(store);
    const result = await createContent(
      "projects",
      { status: "draft", slug: "youth", serviceIds: [SERVICE_ID] },
      d,
    );
    expect(result.status).toBe(400);
    expect(store.insert).not.toHaveBeenCalled();
    expect(d.revalidate).not.toHaveBeenCalled();
  });

  it("undoes the project insert when its services fail", async () => {
    const store = fakeStore();
    store.replaceProjectServices.mockResolvedValueOnce({
      ok: false,
      reason: "invalid_reference",
    });
    const d = deps(store);
    const result = await createContent(
      "projects",
      { status: "draft", slug: "youth", serviceIds: [SERVICE_ID] },
      d,
    );
    expect(result.status).toBe(400);
    expect(store.remove).toHaveBeenCalledWith("projects", ID);
    expect(d.revalidate).toHaveBeenCalledWith("content:projects");
  });

  it("undoes the project insert when its images fail", async () => {
    const store = fakeStore();
    store.replaceProjectImages.mockRejectedValueOnce(new Error("boom"));
    await expect(
      createContent(
        "projects",
        { status: "draft", slug: "youth", images: [{ key: "media/a.jpg" }] },
        deps(store),
      ),
    ).rejects.toThrow("boom");
    expect(store.remove).toHaveBeenCalledWith("projects", ID);
  });

  it("refreshes the cache only after the children are written", async () => {
    const store = fakeStore();
    const d = deps(store);
    await createContent(
      "projects",
      { status: "draft", slug: "youth", serviceIds: [SERVICE_ID] },
      d,
    );
    expect(store.replaceProjectServices.mock.invocationCallOrder[0]).toBeLessThan(
      d.revalidate.mock.invocationCallOrder[0],
    );
  });

  it("a resource's key goes to storage_key", async () => {
    const store = fakeStore();
    await createContent(
      "resources",
      { status: "draft", kind: "guide", key: "resources/g.pdf", access: "direct" },
      deps(store),
    );
    expect(store.insert).toHaveBeenCalledWith(
      "resources",
      expect.objectContaining({ storage_key: "resources/g.pdf" }),
    );
  });

  const projectRow: DbRow = {
    id: ID,
    slug: "youth",
    status: "draft",
    project_images: [],
    project_services: [],
    created_at: NOW,
    updated_at: NOW,
  };

  it("a project PATCH with an unknown service writes nothing", async () => {
    const store = fakeStore({ [ID]: projectRow });
    store.servicesExist.mockResolvedValueOnce(false);
    const d = deps(store);
    const result = await updateContent(
      "projects",
      { id: ID, serviceIds: [SERVICE_ID] },
      d,
    );
    expect(result.status).toBe(400);
    expect(store.update).not.toHaveBeenCalled();
    expect(store.replaceProjectServices).not.toHaveBeenCalled();
    expect(d.revalidate).not.toHaveBeenCalled();
  });

  it("a project PATCH refreshes the cache after its children", async () => {
    const store = fakeStore({ [ID]: projectRow });
    const d = deps(store);
    const result = await updateContent(
      "projects",
      { id: ID, serviceIds: [SERVICE_ID] },
      d,
    );
    expect(result.status).toBe(200);
    expect(store.replaceProjectServices.mock.invocationCallOrder[0]).toBeLessThan(
      d.revalidate.mock.invocationCallOrder[0],
    );
  });

  it("a resource PATCH changes its key in storage_key", async () => {
    const store = fakeStore({
      [ID]: {
        id: ID,
        kind: "guide",
        storage_key: "resources/old.pdf",
        access: "direct",
        status: "draft",
        created_at: NOW,
        updated_at: NOW,
      },
    });
    const result = await updateContent(
      "resources",
      { id: ID, key: "resources/new.pdf" },
      deps(store),
    );
    expect(result.status).toBe(200);
    expect(store.update).toHaveBeenCalledWith(
      "resources",
      { column: "id", value: ID },
      { storage_key: "resources/new.pdf" },
    );
  });
});

describe("listContent", () => {
  it("returns dashboard rows that match the shared row schema", async () => {
    const store = fakeStore({ [ID]: testimonialRow() });
    const result = await listContent("testimonials", deps(store));
    expect(result.status).toBe(200);
    const rows = (result.body as { rows: unknown[] }).rows;
    expect(rows).toEqual([
      {
        id: ID,
        quoteAr: "عمل متميز",
        authorAr: "مدير البرامج",
        letterKey: "internal/letter.pdf",
        consentConfirmed: false,
        adminApproved: false,
        position: 0,
        status: "draft",
        createdAt: "2026-11-07T10:00:00.123Z",
        updatedAt: "2026-11-07T10:00:00.123Z",
      },
    ]);
    expect(contentRowSchemas.testimonials.safeParse(rows[0]).error).toBeUndefined();
  });
});
