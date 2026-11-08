import { describe, expect, it } from "vitest";
import { consentBlockers, draftLocales, hasPreview, previewModel, type PreviewContext } from "./draft";

const ctx: PreviewContext = {
  mediaBase: "https://media.test/p/",
  refOptions: {
    expertise_areas: [{ id: "area-1", title: "Governance" }],
    partners: [{ id: "partner-1", title: "Example Relief" }],
  },
};

const service = {
  id: "svc-1",
  slug: "strategy",
  status: "draft",
  expertiseId: "area-1",
  titleAr: "التخطيط الاستراتيجي",
  summaryAr: "ملخص",
  titleEn: " Strategic planning ",
  summaryEn: "Summary",
  audienceEn: "NGOs",
  deliverablesEn: "",
  stagesEn: "One\nTwo",
  isFeatured: true,
};

describe("previewModel", () => {
  it("maps a draft service to the public props, ignoring the draft status", () => {
    const model = previewModel("services", service, "en", ctx);
    expect(model).toEqual({
      kind: "service",
      area: { id: "area-1", slug: "", title: "Governance", summary: "" },
      service: {
        id: "svc-1",
        slug: "strategy",
        expertiseId: "area-1",
        title: "Strategic planning",
        summary: "Summary",
        isFeatured: true,
        audience: "NGOs",
        deliverables: null,
        stages: "One\nTwo",
        availableIn: ["ar", "en"],
      },
    });
  });

  it("says when a language isn't complete", () => {
    expect(previewModel("services", { ...service, summaryEn: " " }, "en", ctx)).toEqual({ kind: "incomplete" });
    expect(draftLocales("services", { ...service, summaryEn: "" })).toEqual(["ar"]);
  });

  it("shows a hidden-name project's general label, never the name", () => {
    const project = {
      id: "p-1",
      slug: "p",
      titleEn: "Water project",
      goalEn: "Clean water",
      orgNameEn: "Secret Org",
      orgLabelEn: "An international NGO",
      hideOrgName: true,
      orgType: "international",
      images: [{ key: "a/b c.jpg", altAr: "", altEn: "A well" }],
      serviceIds: ["svc-1"],
    };
    const model = previewModel("projects", project, "en", ctx);
    expect(model.kind).toBe("project");
    if (model.kind !== "project") return;
    expect(model.project.organization).toBe("An international NGO");
    expect(JSON.stringify(model)).not.toContain("Secret Org");
    expect(model.project.images).toEqual([{ url: "https://media.test/p/a/b%20c.jpg", alt: "A well" }]);
    expect(model.project.coverUrl).toBe("https://media.test/p/a/b%20c.jpg");
    expect(model.project.serviceIds).toEqual(["svc-1"]);
  });

  it("won't preview a hidden-name project without its label", () => {
    const project = { titleEn: "T", goalEn: "G", orgNameEn: "Secret Org", hideOrgName: true };
    expect(previewModel("projects", project, "en", ctx)).toEqual({ kind: "incomplete" });
  });

  it("shows a visible organization name when it isn't hidden", () => {
    const model = previewModel("projects", { titleEn: "T", goalEn: "G", orgNameEn: "Open Org" }, "en", ctx);
    expect(model.kind === "project" && model.project.organization).toBe("Open Org");
  });

  it("passes an expertise area's rich text as Tiptap JSON", () => {
    const body = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }] };
    const model = previewModel(
      "expertise_areas",
      { titleAr: "حوكمة", summaryAr: "ملخص", bodyAr: body, bodyEn: "<b>html</b>" },
      "ar",
      ctx,
    );
    expect(model.kind === "expertise" && model.area.body).toEqual(body);
  });

  it("maps a testimonial with its partner's name, and a logo with its URL", () => {
    expect(
      previewModel("testimonials", { id: "t", quoteEn: "Great", authorEn: "A. B.", partnerId: "partner-1" }, "en", ctx),
    ).toEqual({
      kind: "clients",
      partners: [],
      testimonials: [{ id: "t", quote: "Great", author: "A. B.", organization: "Example Relief" }],
    });
    expect(previewModel("partners", { id: "p", nameEn: "Org", logoKey: "logo.png" }, "en", ctx)).toEqual({
      kind: "clients",
      partners: [{ id: "p", name: "Org", logoUrl: "https://media.test/p/logo.png" }],
      testimonials: [],
    });
  });

  it("has no preview for types without a public page component here", () => {
    expect(hasPreview("faqs")).toBe(false);
    expect(previewModel("faqs", {}, "en", ctx)).toEqual({ kind: "unsupported" });
  });
});

describe("consentBlockers", () => {
  it("names what keeps a testimonial off the public site", () => {
    expect(consentBlockers({})).toEqual(["no_consent", "not_approved"]);
    expect(consentBlockers({ consentConfirmed: true })).toEqual(["not_approved"]);
    expect(consentBlockers({ consentConfirmed: true, adminApproved: true })).toEqual([]);
  });
});
