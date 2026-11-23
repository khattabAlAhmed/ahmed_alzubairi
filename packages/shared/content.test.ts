import { describe, expect, it } from "vitest";
import {
  contentCreateBodySchemas,
  contentRowSchemas,
  contentUpdateBodySchemas,
  MAX_IMAGE_ALT_LENGTH,
  MAX_IMAGE_CAPTION_LENGTH,
  missingImageAlt,
  PHOTO_CONTENT_TYPES,
} from "./content";

/** The photo of the About page and of an expertise area (P8D-T41). */

const ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

/** A body available in Arabic and English, per type. */
const bodies = {
  pages: {
    key: "about",
    titleAr: "من أنا",
    titleEn: "About",
    bodyAr: doc("نص"),
    bodyEn: doc("Text"),
  },
  expertise_areas: {
    slug: "governance",
    titleAr: "الحوكمة",
    titleEn: "Governance",
    summaryAr: "ملخص",
    summaryEn: "Summary",
  },
} as const;

const createOf = (type: (typeof PHOTO_CONTENT_TYPES)[number]) =>
  contentCreateBodySchemas[type];

describe.each(PHOTO_CONTENT_TYPES)("%s photo", (type) => {
  const base = bodies[type];
  const withPhoto = { ...base, imageKey: "media/photo.webp" };

  it("is optional", () => {
    expect(createOf(type).safeParse({ ...base, status: "published" }).success).toBe(true);
  });

  it("refuses a published photo without alt in a language the row is published in", () => {
    const result = createOf(type).safeParse({
      ...withPhoto,
      status: "published",
      imageAltAr: "صورة",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["imageAltEn"]]);
  });

  it("refuses a published photo with no alt at all, once per language", () => {
    const result = createOf(type).safeParse({ ...withPhoto, status: "published" });
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["imageAltAr"],
      ["imageAltEn"],
    ]);
  });

  it("passes with alt in every published language", () => {
    expect(
      createOf(type).safeParse({
        ...withPhoto,
        status: "published",
        imageAltAr: "جلسة عمل",
        imageAltEn: "A working session",
        imageCaptionEn: "Working session with a directorate team",
      }).success,
    ).toBe(true);
  });

  it("needs alt only in the languages the row is available in", () => {
    const englishOnly = Object.fromEntries(
      Object.entries(withPhoto).filter(([name]) => !name.endsWith("Ar")),
    );
    expect(
      createOf(type).safeParse({
        ...englishOnly,
        status: "published",
        imageAltEn: "A working session",
      }).success,
    ).toBe(true);
  });

  it("lets a draft keep a photo without alt", () => {
    expect(createOf(type).safeParse({ ...withPhoto, status: "draft" }).success).toBe(true);
  });

  it("applies the rule to an update body too", () => {
    const update = contentUpdateBodySchemas[type];
    // A page's key is fixed, so an update never carries it.
    const fields = Object.fromEntries(Object.entries(withPhoto).filter(([name]) => name !== "key"));
    expect(update.safeParse({ ...fields, id: ID, status: "published" }).success).toBe(false);
    expect(
      update.safeParse({
        ...fields,
        id: ID,
        status: "published",
        imageAltAr: "صورة",
        imageAltEn: "Photo",
      }).success,
    ).toBe(true);
  });

  it(`limits alt to ${MAX_IMAGE_ALT_LENGTH} and caption to ${MAX_IMAGE_CAPTION_LENGTH} characters`, () => {
    const draft = { ...withPhoto, status: "draft" };
    const parse = (extra: object) => createOf(type).safeParse({ ...draft, ...extra }).success;
    expect(parse({ imageAltAr: "a".repeat(MAX_IMAGE_ALT_LENGTH) })).toBe(true);
    expect(parse({ imageAltAr: "a".repeat(MAX_IMAGE_ALT_LENGTH + 1) })).toBe(false);
    expect(parse({ imageCaptionEn: "c".repeat(MAX_IMAGE_CAPTION_LENGTH) })).toBe(true);
    expect(parse({ imageCaptionEn: "c".repeat(MAX_IMAGE_CAPTION_LENGTH + 1) })).toBe(false);
    expect(parse({ imageAltEn: "   " })).toBe(false);
  });

  it("shows the photo fields on team rows", () => {
    const row = contentRowSchemas[type].parse({
      ...withPhoto,
      status: "draft",
      imageAltEn: "Photo",
      imageCaptionAr: "تعليق",
      id: ID,
      createdAt: "2026-11-23T00:00:00.000Z",
      updatedAt: "2026-11-23T00:00:00.000Z",
    });
    expect(row).toMatchObject({ imageKey: "media/photo.webp", imageAltEn: "Photo", imageCaptionAr: "تعليق" });
  });
});

describe("missingImageAlt", () => {
  it("names the alt fields a published row with a photo still needs", () => {
    expect(
      missingImageAlt("pages", { ...bodies.pages, status: "published", imageKey: "media/p.webp" }),
    ).toEqual(["imageAltAr", "imageAltEn"]);
  });

  it("is empty for a draft, a row with no photo, or a row with every alt", () => {
    expect(missingImageAlt("pages", { ...bodies.pages, status: "draft", imageKey: "media/p.webp" })).toEqual([]);
    expect(missingImageAlt("pages", { ...bodies.pages, status: "published" })).toEqual([]);
    expect(
      missingImageAlt("expertise_areas", {
        ...bodies.expertise_areas,
        status: "published",
        imageKey: "media/a.webp",
        imageAltAr: "صورة",
        imageAltEn: "Photo",
      }),
    ).toEqual([]);
  });
});
