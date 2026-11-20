import { contentUpdateBodySchemas, HOME_SECTION_KEYS } from "@repo/shared";
import { describe, expect, it } from "vitest";
import {
  buildSection,
  isSignatureFile,
  moveParagraph,
  sectionFields,
  sectionPublishState,
  sectionValues,
  type SectionValues,
} from "./section-content";

const blank = (key: Parameters<typeof sectionValues>[0]) => sectionValues(key, null);

describe("sectionFields", () => {
  it("builds every section's form from its shared schema", () => {
    for (const key of HOME_SECTION_KEYS) {
      expect(sectionFields(key).length, key).toBeGreaterThan(0);
    }
    expect(sectionFields("hero").map((field) => field.path)).toEqual(["name", "title", "valueStatement"]);
    expect(sectionFields("audiences").filter((field) => field.path.endsWith(".title"))).toHaveLength(3);
  });
});

describe("buildSection", () => {
  it("sends one language and leaves a blank one out", () => {
    const values = blank("services");
    values.en = { heading: " Featured services ", intro: "" };
    const built = buildSection("services", values, "published", { key: "services" });
    expect(built.errors).toEqual({});
    expect(built.body).toEqual({
      key: "services",
      status: "published",
      contentEn: { heading: "Featured services" },
    });
    expect(contentUpdateBodySchemas.home_sections.safeParse(built.body).success).toBe(true);
  });

  it("marks a missing required field in the language being filled", () => {
    const values = blank("expertise");
    values.ar = { heading: "", intro: "مقدمة" };
    expect(buildSection("expertise", values, "draft", null).errors).toEqual({ "ar.heading": "required" });
  });

  it("builds the three audience items, and needs each title", () => {
    const values = blank("audiences");
    values.en = {
      ...values.en,
      heading: "Who I work with",
      "items.0.title": "Government",
      "items.1.title": "Humanitarian",
      "items.1.description": "NGOs and agencies",
    };
    const missing = buildSection("audiences", values, "draft", null);
    expect(missing.errors).toEqual({ "en.items.2.title": "required" });

    values.en["items.2.title"] = "Private";
    const built = buildSection("audiences", values, "draft", null);
    expect(built.errors).toEqual({});
    expect(built.body.contentEn).toEqual({
      heading: "Who I work with",
      items: [
        { title: "Government" },
        { title: "Humanitarian", description: "NGOs and agencies" },
        { title: "Private" },
      ],
    });
  });

  it("saves the hero photo with each language's text", () => {
    const values: SectionValues = {
      ar: { name: "مثال", title: "مستشار", valueStatement: "قيمة" },
      en: { name: "", title: "", valueStatement: "" },
      photoKey: "media/hero.jpg",
    };
    const built = buildSection("hero", values, "draft", null);
    expect(built.body.contentAr).toEqual({ name: "مثال", title: "مستشار", valueStatement: "قيمة", photoKey: "media/hero.jpg" });
    expect(built.body.contentEn).toBeUndefined();
  });

  it("refuses to empty a language that had content", () => {
    const row = { key: "contact", contentEn: { heading: "Contact" } };
    const built = buildSection("contact", blank("contact"), "draft", row);
    expect(built.errors).toEqual({ "en.heading": "cantClear" });
  });

  it("reads the saved row back into the form", () => {
    const row = {
      key: "hero",
      contentAr: { name: "مثال", title: "t", valueStatement: "v" },
      contentEn: { name: "Example", title: "t", valueStatement: "v", photoKey: "media/p.jpg" },
    };
    const values = sectionValues("hero", row);
    expect(values.en.name).toBe("Example");
    expect(values.photoKey).toBe("media/p.jpg");
  });
});

describe("sectionPublishState", () => {
  it("can't publish a section with no complete language", () => {
    expect(sectionPublishState("media", blank("media"), "published", { key: "media" }).problems).toEqual([
      "no_language",
    ]);
  });

  it("publishes in the languages the form fills", () => {
    const values = blank("media");
    values.ar = { heading: "الظهور الإعلامي", intro: "" };
    expect(sectionPublishState("media", values, "published", { key: "media" })).toEqual({
      locales: ["ar"],
      problems: [],
    });
  });
});

describe("letter", () => {
  const saved = {
    key: "letter",
    contentAr: { heading: "رسالة", salutation: "إلى من يقرأ هذا،", paragraphs: ["أولى", "ثانية"], signOff: "أحمد", isPlaceholder: true },
    contentEn: {
      heading: "A letter",
      salutation: "To you,",
      paragraphs: ["One."],
      signOff: "Ahmed",
      signatureKey: "a.png",
      signatureDarkKey: "b.png",
      isPlaceholder: true,
    },
  };

  it("reads paragraphs per language, and the signatures and switch once for both", () => {
    const values = sectionValues("letter", saved);
    expect(values.letter).toEqual({
      paragraphs: { ar: ["أولى", "ثانية"], en: ["One."] },
      signatureKey: "a.png",
      signatureDarkKey: "b.png",
      isPlaceholder: true,
    });
    expect(values.ar.salutation).toBe("إلى من يقرأ هذا،");
  });

  it("starts a new letter with one empty paragraph, as a placeholder", () => {
    expect(blank("letter").letter).toEqual({
      paragraphs: { ar: [""], en: [""] },
      signatureKey: "",
      signatureDarkKey: "",
      isPlaceholder: true,
    });
    expect(blank("hero").letter).toBeUndefined();
  });

  it("saves the signatures and the switch with each language", () => {
    const values = sectionValues("letter", saved);
    values.letter!.isPlaceholder = false;
    values.letter!.signatureDarkKey = "c.png";
    const built = buildSection("letter", values, "draft", saved);
    expect(built.errors).toEqual({});
    expect(built.body.contentAr).toEqual({ ...saved.contentAr, signatureKey: "a.png", signatureDarkKey: "c.png", isPlaceholder: false });
    expect(built.body.contentEn).toEqual({ ...saved.contentEn, signatureDarkKey: "c.png", isPlaceholder: false });
    expect(contentUpdateBodySchemas.home_sections.safeParse(built.body).success).toBe(true);
  });

  it("points at a blank paragraph", () => {
    const values = sectionValues("letter", saved);
    values.letter!.paragraphs.en = ["One.", "  "];
    expect(buildSection("letter", values, "draft", saved).errors).toEqual({ "en.paragraphs.1": "required" });
  });

  it("moves a paragraph, and stays put at the ends", () => {
    expect(moveParagraph(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveParagraph(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveParagraph(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });

  it("takes only a PNG signature file, never an SVG", () => {
    expect(isSignatureFile({ name: "sig.png", type: "image/png" })).toBe(true);
    expect(isSignatureFile({ name: "sig.svg", type: "image/svg+xml" })).toBe(false);
    expect(isSignatureFile({ name: "sig.svg", type: "image/png" })).toBe(false);
    expect(isSignatureFile({ name: "sig.jpg", type: "image/jpeg" })).toBe(false);
  });
});
