import { contentRowSchemas } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { fromColumns, toColumns } from "./columns";

const ID = "3f8a7c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b";
const SERVICE_ID = "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const NOW = "2026-11-07T10:00:00+00:00";

describe("toColumns", () => {
  it("snake-cases fields and renames upload keys", () => {
    expect(
      toColumns("partners", { nameAr: "جهة", logoKey: "media/l.png", consentConfirmed: true }),
    ).toEqual({ name_ar: "جهة", logo_path: "media/l.png", consent_confirmed: true });
    expect(toColumns("posts", { readingMinutesEn: 4, coverKey: "media/c.jpg" })).toEqual({
      reading_minutes_en: 4,
      cover_path: "media/c.jpg",
    });
  });

  it("leaves out nested and undefined fields", () => {
    expect(
      toColumns("projects", {
        titleAr: "مشروع",
        orgLabelEn: undefined,
        images: [],
        serviceIds: [],
      }),
    ).toEqual({ title_ar: "مشروع" });
  });
});

describe("fromColumns", () => {
  it("never returns storage_key or approved_by", () => {
    const resource = fromColumns("resources", {
      id: ID,
      kind: "guide",
      access: "email",
      storage_key: "resources/secret.pdf",
      status: "draft",
      created_at: NOW,
      updated_at: NOW,
    });
    expect(resource).not.toHaveProperty("key");
    expect(JSON.stringify(resource)).not.toContain("secret.pdf");
    const partner = fromColumns("partners", {
      id: ID,
      admin_approved: true,
      approved_by: "user_admin",
      created_at: NOW,
      updated_at: NOW,
    });
    expect(partner).not.toHaveProperty("approvedBy");
    expect(contentRowSchemas.resources.safeParse(resource).error).toBeUndefined();
    expect(contentRowSchemas.partners.safeParse(partner).error).toBeUndefined();
  });

  it("reads a project's images in order and its services", () => {
    const project = fromColumns("projects", {
      id: ID,
      slug: "youth",
      hide_org_name: true,
      org_name_ar: "اسم الجهة",
      org_label_ar: "منظمة دولية",
      created_at: NOW,
      updated_at: NOW,
      project_images: [
        { path: "media/b.jpg", alt_ar: null, alt_en: "B", position: 2 },
        { path: "media/a.jpg", alt_ar: "أ", alt_en: null, position: 1 },
      ],
      project_services: [{ service_id: SERVICE_ID }],
    });
    expect(project.images).toEqual([
      { key: "media/a.jpg", altAr: "أ", position: 1 },
      { key: "media/b.jpg", altEn: "B", position: 2 },
    ]);
    expect(project.serviceIds).toEqual([SERVICE_ID]);
    expect(contentRowSchemas.projects.safeParse(project).error).toBeUndefined();
  });

  it("drops created_at from home sections, as their row schema has none", () => {
    const section = fromColumns("home_sections", {
      key: "contact",
      position: 12,
      is_visible: true,
      content_ar: null,
      content_en: { heading: "Contact" },
      status: "published",
      created_at: NOW,
      updated_at: NOW,
    });
    expect(section).toEqual({
      key: "contact",
      position: 12,
      isVisible: true,
      contentEn: { heading: "Contact" },
      status: "published",
      updatedAt: "2026-11-07T10:00:00.000Z",
    });
    expect(contentRowSchemas.home_sections.safeParse(section).error).toBeUndefined();
  });
});
