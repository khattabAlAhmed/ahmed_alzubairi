import { describe, expect, it } from "vitest";
import {
  CONTENT_CACHE_TAGS,
  contentCacheTag,
  SITE_SETTINGS_CACHE_TAG,
} from "./cache-tags";
import { CONTENT_TYPES } from "./content";
import {
  availableLocales,
  canPublish,
  isAvailableIn,
  isFilled,
  localizedField,
  publishProblems,
  REQUIRED_FIELDS,
} from "./publishing";

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const englishOnlyService = {
  titleEn: "Governance",
  summaryEn: "Institutional governance.",
  titleAr: null,
  summaryAr: null,
};

describe("isFilled", () => {
  it.each([
    ["text", true],
    ["  ", false],
    ["", false],
    [null, false],
    [undefined, false],
    [0, true],
    [Number.NaN, false],
    [doc("Hello"), true],
    [doc("   "), false],
    [{ type: "doc", content: [{ type: "paragraph" }] }, false],
    [{ type: "doc" }, false],
    [{ text: "not a doc" }, false],
  ])("%j → %s", (value, expected) => {
    expect(isFilled(value)).toBe(expected);
  });
});

describe("isAvailableIn", () => {
  it("names fields per language", () => {
    expect(localizedField("orgLabel", "ar")).toBe("orgLabelAr");
    expect(localizedField("orgLabel", "en")).toBe("orgLabelEn");
  });

  it("an English-only row is unavailable in Arabic", () => {
    expect(isAvailableIn("services", englishOnlyService, "en")).toBe(true);
    expect(isAvailableIn("services", englishOnlyService, "ar")).toBe(false);
    expect(availableLocales("services", englishOnlyService)).toEqual(["en"]);
  });

  it("needs every required field in that language", () => {
    expect(isAvailableIn("services", { titleAr: "الحوكمة" }, "ar")).toBe(false);
    expect(
      isAvailableIn("services", { titleAr: "الحوكمة", summaryEn: "x" }, "ar"),
    ).toBe(false);
  });

  it("a blank string doesn't count", () => {
    expect(isAvailableIn("faqs", { questionAr: " ", answerAr: "ج" }, "ar")).toBe(
      false,
    );
  });

  it("an empty Tiptap body doesn't count", () => {
    const page = { titleAr: "من أنا", bodyAr: { type: "doc", content: [] } };
    expect(isAvailableIn("pages", page, "ar")).toBe(false);
    expect(
      isAvailableIn("pages", { ...page, bodyAr: doc("نبذة") }, "ar"),
    ).toBe(true);
  });

  it("a post needs its slug in that language", () => {
    const post = { titleEn: "Post", bodyEn: doc("Body") };
    expect(isAvailableIn("posts", post, "en")).toBe(false);
    expect(isAvailableIn("posts", { ...post, slugEn: "post" }, "en")).toBe(
      true,
    );
  });

  it("a project with a hidden name needs the label in that language", () => {
    const project = { titleAr: "مشروع", goalAr: "هدف", hideOrgName: true };
    expect(isAvailableIn("projects", project, "ar")).toBe(false);
    expect(
      isAvailableIn("projects", { ...project, orgLabelAr: "منظمة دولية" }, "ar"),
    ).toBe(true);
    expect(
      isAvailableIn("projects", { ...project, hideOrgName: false }, "ar"),
    ).toBe(true);
  });

  it("a home section needs content that passes its key's schema", () => {
    const hero = {
      key: "hero",
      contentEn: { name: "Ahmed", title: "Consultant", valueStatement: "V" },
    };
    expect(isAvailableIn("home_sections", hero, "en")).toBe(true);
    expect(isAvailableIn("home_sections", hero, "ar")).toBe(false);
    expect(
      isAvailableIn(
        "home_sections",
        { key: "hero", contentEn: { heading: "x" } },
        "en",
      ),
    ).toBe(false);
    expect(
      isAvailableIn(
        "home_sections",
        { key: "footer", contentEn: { heading: "x" } },
        "en",
      ),
    ).toBe(false);
  });

  it.each(Object.keys(REQUIRED_FIELDS) as (keyof typeof REQUIRED_FIELDS)[])(
    "an empty %s row is available in no language",
    (type) => {
      expect(availableLocales(type, {})).toEqual([]);
    },
  );
});

describe("canPublish", () => {
  const testimonial = {
    quoteAr: "عمل متميز",
    authorAr: "مدير البرامج",
    consentConfirmed: true,
    adminApproved: true,
  };

  it("publishes a testimonial with consent and approval", () => {
    expect(canPublish("testimonials", testimonial)).toBe(true);
  });

  it("refuses a testimonial without consent", () => {
    const row = { ...testimonial, consentConfirmed: false };
    expect(canPublish("testimonials", row)).toBe(false);
    expect(publishProblems("testimonials", row)).toEqual(["no_consent"]);
  });

  it("refuses a testimonial without admin approval", () => {
    const row = { ...testimonial, adminApproved: undefined };
    expect(canPublish("testimonials", row)).toBe(false);
    expect(publishProblems("testimonials", row)).toEqual(["not_approved"]);
  });

  it("refuses a partner without consent or approval", () => {
    expect(canPublish("partners", { nameEn: "UNDP" })).toBe(false);
    expect(publishProblems("partners", { nameEn: "UNDP" })).toEqual([
      "no_consent",
      "not_approved",
    ]);
    expect(
      canPublish("partners", {
        nameEn: "UNDP",
        consentConfirmed: true,
        adminApproved: true,
      }),
    ).toBe(true);
  });

  it("consent and approval must be exactly true", () => {
    const row = { ...testimonial, consentConfirmed: "true", adminApproved: 1 };
    expect(canPublish("testimonials", row)).toBe(false);
  });

  it("refuses a row available in no language", () => {
    expect(publishProblems("services", { titleAr: "الحوكمة" })).toEqual([
      "no_language",
    ]);
    expect(
      canPublish("testimonials", {
        consentConfirmed: true,
        adminApproved: true,
      }),
    ).toBe(false);
  });

  it("publishes a row in one language only", () => {
    expect(canPublish("services", englishOnlyService)).toBe(true);
  });

  it("a stat needs its value", () => {
    expect(canPublish("home_stats", { labelAr: "سنوات الخبرة" })).toBe(false);
    expect(publishProblems("home_stats", { labelAr: "سنوات الخبرة" })).toEqual(
      ["no_value"],
    );
    expect(
      canPublish("home_stats", { labelAr: "سنوات الخبرة", value: "15+" }),
    ).toBe(true);
  });

  it("other types don't need consent", () => {
    expect(canPublish("faqs", { questionEn: "Q?", answerEn: "A." })).toBe(true);
  });
});

describe("cache tags", () => {
  it("has one distinct tag per content type, plus site settings", () => {
    const tags = CONTENT_TYPES.map((type) => contentCacheTag(type));
    expect(new Set([...tags, SITE_SETTINGS_CACHE_TAG]).size).toBe(
      CONTENT_TYPES.length + 1,
    );
    expect(CONTENT_CACHE_TAGS.projects).toBe("content:projects");
    expect(Object.keys(CONTENT_CACHE_TAGS).sort()).toEqual(
      [...CONTENT_TYPES].sort(),
    );
  });
});
