import { describe, expect, it } from "vitest";
import {
  buildBody,
  publishState,
  requiredInputNames,
  rowStatus,
  rowTitle,
  rowToValues,
} from "./form-values";

const ID = "6f9c2a7e-1b2d-4c3e-8f4a-5b6c7d8e9f01";

function serviceValues(change: Record<string, unknown> = {}) {
  return { ...rowToValues("services", null), slug: "strategic-planning", ...change };
}

describe("rowToValues", () => {
  it("starts a new row as a draft with empty inputs", () => {
    const values = rowToValues("services", null);
    expect(values.status).toBe("draft");
    expect(values.titleAr).toBe("");
    expect(values.titleEn).toBe("");
    expect(values.isFeatured).toBe(false);
    expect(values.position).toBe("");
  });

  it("copies a row, turning numbers into input text", () => {
    const values = rowToValues("services", {
      id: ID,
      status: "published",
      titleEn: "Planning",
      position: 3,
      isFeatured: true,
    });
    expect(values).toMatchObject({ status: "published", titleEn: "Planning", position: "3", isFeatured: true });
  });
});

describe("buildBody", () => {
  it("builds a create body with trimmed text and no empty fields", () => {
    const { body, errors, formError } = buildBody(
      "services",
      serviceValues({ titleEn: "  Planning ", summaryEn: "Plans", position: "2" }),
      null,
    );
    expect(errors).toEqual({});
    expect(formError).toBe(false);
    expect(body).toEqual({
      status: "draft",
      slug: "strategic-planning",
      titleEn: "Planning",
      summaryEn: "Plans",
      isFeatured: false,
      position: 2,
    });
  });

  it("asks for a required field on create", () => {
    const { errors } = buildBody("services", serviceValues({ slug: "" }), null);
    expect(errors.slug).toBe("required");
  });

  it("marks a value the shared schema refuses", () => {
    const { errors } = buildBody("services", serviceValues({ slug: "Not a slug!", position: "-1" }), null);
    expect(errors.slug).toBe("invalid");
    expect(errors.position).toBe("invalid");
  });

  it("sends the id on update and refuses to empty a filled field", () => {
    const original = { id: ID, status: "draft", slug: "a", titleAr: "تخطيط" };
    const values = { ...rowToValues("services", original), titleAr: "" };
    const { body, errors } = buildBody("services", values, original);
    expect(body.id).toBe(ID);
    expect(errors.titleAr).toBe("cantClear");
  });

  it("sends a project's images in order, with alt text only when filled", () => {
    const values = {
      ...rowToValues("projects", null),
      slug: "p",
      images: [
        { key: "projects/a.jpg", altAr: "", altEn: "Field visit" },
        { key: "projects/b.jpg", altAr: "", altEn: "" },
      ],
    };
    const { body, errors } = buildBody("projects", values, null);
    expect(errors).toEqual({});
    expect(body.images).toEqual([
      { key: "projects/a.jpg", position: 0, altEn: "Field visit" },
      { key: "projects/b.jpg", position: 1 },
    ]);
  });
});

describe("publishState", () => {
  it("is available in English only when the Arabic required fields are empty", () => {
    const state = publishState(
      "services",
      serviceValues({ status: "published", titleEn: "Planning", summaryEn: "Plans", titleAr: "تخطيط" }),
      null,
    );
    expect(state).toEqual({ locales: ["en"], problems: [] });
  });

  it("can't be published with no language complete", () => {
    const state = publishState("services", serviceValues({ titleEn: "Planning" }), null);
    expect(state.locales).toEqual([]);
    expect(state.problems).toEqual(["no_language"]);
  });

  it("takes approval from the saved row, never from the form", () => {
    const values = {
      ...rowToValues("partners", null),
      nameEn: "UNDP",
      consentConfirmed: true,
      adminApproved: true,
    };
    expect(publishState("partners", values, null).problems).toEqual(["not_approved"]);
    const approved = { id: ID, status: "draft", nameEn: "UNDP", adminApproved: true };
    expect(publishState("partners", rowToValues("partners", approved), approved).problems).toEqual([
      "no_consent",
    ]);
  });
});

describe("requiredInputNames", () => {
  it("lists both languages of the required fields", () => {
    expect([...requiredInputNames("services", {})].sort()).toEqual([
      "summaryAr",
      "summaryEn",
      "titleAr",
      "titleEn",
    ]);
  });

  it("adds the general label when a project hides its organization", () => {
    const names = requiredInputNames("projects", { hideOrgName: true });
    expect(names.has("orgLabelAr")).toBe(true);
    expect(requiredInputNames("projects", {}).has("orgLabelAr")).toBe(false);
  });
});

describe("rowTitle and rowStatus", () => {
  it("names a row in the page language, else the other one", () => {
    const row = { titleAr: "تخطيط", titleEn: "Planning" };
    expect(rowTitle("services", row, "ar")).toBe("تخطيط");
    expect(rowTitle("services", row, "en")).toBe("Planning");
    expect(rowTitle("services", { titleAr: "تخطيط" }, "en")).toBe("تخطيط");
    expect(rowTitle("services", {}, "en")).toBeNull();
  });

  it("reads anything but published as a draft", () => {
    expect(rowStatus({ status: "published" })).toBe("published");
    expect(rowStatus({})).toBe("draft");
  });
});
