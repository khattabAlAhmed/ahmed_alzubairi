import { CONTENT_TYPES, type ContentType } from "@repo/shared";
import { describe, expect, it } from "vitest";
import ar from "@/messages/ar/DashboardContent.json";
import en from "@/messages/en/DashboardContent.json";
import {
  canCreate,
  CONTENT_CONFIG,
  editPath,
  listPath,
  newPath,
  isEditable,
  OPTION_SETS,
  parseContentType,
  referenceTypes,
} from "./registry";

describe("registry", () => {
  it("has a label for every type, field and option, in both languages", () => {
    for (const messages of [ar, en]) {
      const fields = messages.fields as Record<string, string>;
      const options = messages.options as Record<string, Record<string, string>>;
      for (const type of CONTENT_TYPES) {
        expect(messages.types[type]).toBeTruthy();
        for (const field of CONTENT_CONFIG[type].fields) {
          expect(fields[field.name], field.name).toBeTruthy();
        }
      }
      for (const [set, values] of Object.entries(OPTION_SETS)) {
        for (const value of values) expect(options[set][value], `${set}.${value}`).toBeTruthy();
      }
    }
  });

  it("reads only known content types", () => {
    expect(parseContentType("services")).toBe("services");
    expect(parseContentType("profiles")).toBeNull();
    expect(parseContentType(undefined)).toBeNull();
  });

  it("never creates home sections or pages: they are fixed sets", () => {
    expect(canCreate("home_sections")).toBe(false);
    expect(canCreate("pages")).toBe(false);
    expect(canCreate("services")).toBe(true);
  });

  it("leaves home sections to their own editor (P2P-T14)", () => {
    expect(isEditable("home_sections")).toBe(false);
    expect(isEditable("home_sections", { customEditor: true })).toBe(true);
    const generic = CONTENT_TYPES.filter((type: ContentType) => type !== "home_sections");
    for (const type of generic) expect(isEditable(type), type).toBe(true);
  });

  it("loads each reference type once", () => {
    expect(referenceTypes("projects")).toEqual(["expertise_areas", "services"]);
    expect(referenceTypes("home_stats")).toEqual([]);
  });

  it("builds the list, new and edit paths", () => {
    expect(listPath("services")).toBe("/dashboard/content?type=services");
    expect(newPath("services")).toBe("/dashboard/content/new?type=services");
    expect(editPath("services", "a b")).toBe("/dashboard/content/edit?type=services&id=a%20b");
  });

  it("sends home sections and quick stats to the home page editor", () => {
    expect(listPath("home_sections")).toBe("/dashboard/home");
    expect(listPath("home_stats")).toBe("/dashboard/home");
    expect(editPath("home_sections", "hero")).toBe("/dashboard/home?section=hero");
    // The generic editor appends `&created=1` after a create, so a query must already be there.
    expect(editPath("home_stats", "a b")).toBe("/dashboard/home?stat=a%20b");
  });
});
