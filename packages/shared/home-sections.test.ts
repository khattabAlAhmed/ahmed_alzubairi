import { describe, expect, it } from "vitest";
import { contentRowSchemas, contentUpdateBodySchemas } from "./content";
import {
  HOME_SECTION_KEYS,
  homeSectionContentSchemas,
  LETTER_MAX_PARAGRAPHS,
  type HomeSectionKey,
} from "./home-sections";

const heading = { heading: "Areas of expertise", intro: "Three areas." };

const VALID: Record<HomeSectionKey, object> = {
  hero: {
    name: "Ahmed",
    title: "Consultant",
    valueStatement: "Governance that works.",
    photoKey: "media/hero.jpg",
  },
  letter: {
    heading: "A letter",
    salutation: "To whoever is reading this,",
    paragraphs: ["First.", "Second."],
    signOff: "Ahmed Alzubairi",
    signatureKey: "123e4567-e89b-42d3-a456-426614174000.png",
    signatureDarkKey: "123e4567-e89b-42d3-a456-426614174001.png",
    isPlaceholder: true,
  },
  stats: { heading: "In numbers" },
  expertise: heading,
  audiences: {
    heading: "Who I work with",
    items: [
      { title: "Government", description: "Ministries" },
      { title: "Humanitarian" },
      { title: "Private sector" },
    ],
  },
  services: heading,
  projects: heading,
  partners: heading,
  testimonials: heading,
  media: heading,
  latest: heading,
  newsletter: heading,
  contact: heading,
};

const REFUSED: Record<HomeSectionKey, unknown> = {
  hero: { name: "Ahmed", title: "Consultant" },
  letter: {
    heading: "A letter",
    salutation: "Hello,",
    paragraphs: [],
    signOff: "Ahmed",
    isPlaceholder: false,
  },
  stats: { intro: "No heading" },
  expertise: { heading: "  " },
  audiences: {
    heading: "Who I work with",
    items: [{ title: "Government" }, { title: "Humanitarian" }],
  },
  services: { heading: "Services", items: [] },
  projects: "Projects",
  partners: { heading: "Logos", logos: ["a.png"] },
  testimonials: null,
  media: { heading: 1 },
  latest: {},
  newsletter: { heading: "<b>x</b>", intro: "" },
  contact: { heading: "Contact", email: "a@example.com" },
};

describe("home section content", () => {
  it("has a schema for every key", () => {
    expect(Object.keys(homeSectionContentSchemas).sort()).toEqual(
      [...HOME_SECTION_KEYS].sort(),
    );
  });

  it.each(HOME_SECTION_KEYS)("accepts valid %s content", (key) => {
    const result = homeSectionContentSchemas[key].safeParse(VALID[key]);
    expect(result.error).toBeUndefined();
  });

  it.each(HOME_SECTION_KEYS)("refuses invalid %s content", (key) => {
    expect(homeSectionContentSchemas[key].safeParse(REFUSED[key]).success).toBe(
      false,
    );
  });

  it("list sections hold only a heading and intro", () => {
    expect(
      homeSectionContentSchemas.services.safeParse({
        heading: "Services",
        serviceIds: ["x"],
      }).success,
    ).toBe(false);
  });
});

describe("letter content", () => {
  const schema = homeSectionContentSchemas.letter;
  const letter = {
    heading: "A letter",
    salutation: "Hello,",
    paragraphs: ["One."],
    signOff: "Ahmed",
    isPlaceholder: false,
  };

  it("comes right after the hero", () => {
    expect(HOME_SECTION_KEYS.slice(0, 2)).toEqual(["hero", "letter"]);
  });

  it("takes 1 to 6 paragraphs", () => {
    const paragraphs = (count: number) =>
      Array.from({ length: count }, (_, index) => `Paragraph ${index}.`);
    expect(schema.safeParse({ ...letter, paragraphs: paragraphs(1) }).success).toBe(true);
    expect(
      schema.safeParse({ ...letter, paragraphs: paragraphs(LETTER_MAX_PARAGRAPHS) }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ ...letter, paragraphs: paragraphs(LETTER_MAX_PARAGRAPHS + 1) }).success,
    ).toBe(false);
    expect(schema.safeParse({ ...letter, paragraphs: ["One.", "  "] }).success).toBe(false);
  });

  it("needs the placeholder flag", () => {
    expect(schema.safeParse({ ...letter, isPlaceholder: undefined }).success).toBe(false);
    expect(schema.safeParse({ ...letter, isPlaceholder: "yes" }).success).toBe(false);
  });

  it.each(["signatureKey", "signatureDarkKey"])(
    "%s takes only a PNG media key",
    (field) => {
      for (const key of ["a.png", "b.PNG"]) {
        expect(schema.safeParse({ ...letter, [field]: key }).success).toBe(true);
      }
      for (const key of ["a.svg", "a.webp", "a.jpg", "a.pdf", "a.png.svg", "pending/a.png", ""]) {
        expect(schema.safeParse({ ...letter, [field]: key }).success).toBe(false);
      }
    },
  );

  it("refuses unknown fields", () => {
    expect(schema.safeParse({ ...letter, html: "<p>x</p>" }).success).toBe(false);
  });
});

describe("home section PATCH body", () => {
  const schema = contentUpdateBodySchemas.home_sections;

  it("checks content against its key's schema", () => {
    expect(
      schema.safeParse({ key: "hero", contentEn: VALID.hero }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ key: "hero", contentEn: VALID.expertise }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ key: "letter", contentAr: VALID.letter }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ key: "letter", contentAr: VALID.hero }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ key: "audiences", contentAr: VALID.audiences })
        .success,
    ).toBe(true);
  });

  it("refuses arbitrary JSON as content", () => {
    expect(
      schema.safeParse({ key: "latest", contentAr: { html: "<script>" } })
        .success,
    ).toBe(false);
  });

  it("keeps the dashboard row checked per key", () => {
    const row = contentRowSchemas.home_sections;
    const updatedAt = "2026-11-07T10:00:00Z";
    expect(
      row.safeParse({ key: "hero", contentAr: VALID.hero, updatedAt }).success,
    ).toBe(true);
    expect(
      row.safeParse({ key: "hero", contentAr: VALID.contact, updatedAt })
        .success,
    ).toBe(false);
  });
});
