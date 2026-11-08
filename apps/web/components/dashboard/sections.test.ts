import { PERMISSIONS, type Permission } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import { grantedPermissions } from "./access";
import { DASHBOARD_SECTIONS, sectionKeys, sectionPermissions, visibleSections } from "./sections";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));

describe("dashboard menu", () => {
  it("checks each permission the menu uses once", () => {
    expect(sectionPermissions()).toEqual([
      PERMISSIONS.CONTENT_MANAGE,
      PERMISSIONS.TESTIMONIALS_APPROVE,
      PERMISSIONS.TEAM_MANAGE,
    ]);
  });

  it("shows Content and Testimonials to a member with content.manage", () => {
    const keys = visibleSections(new Set([PERMISSIONS.CONTENT_MANAGE])).map((s) => s.key);
    expect(keys).toEqual(["home", "content", "testimonials"]);
  });

  it("shows Testimonials to a member with only testimonials.approve", () => {
    const keys = visibleSections(new Set([PERMISSIONS.TESTIMONIALS_APPROVE])).map((s) => s.key);
    expect(keys).toEqual(["home", "testimonials"]);
  });

  it("shows Settings only with team.manage", () => {
    expect(visibleSections(new Set([PERMISSIONS.TEAM_MANAGE])).map((s) => s.key)).toEqual([
      "home",
      "settings",
    ]);
    const withoutTeam = visibleSections(
      new Set<Permission>([PERMISSIONS.CONTENT_MANAGE, PERMISSIONS.TESTIMONIALS_APPROVE]),
    ).map((s) => s.key);
    expect(withoutTeam).not.toContain("settings");
  });

  it("shows the admin every section", () => {
    const keys = visibleSections(
      new Set<Permission>([
        PERMISSIONS.CONTENT_MANAGE,
        PERMISSIONS.TESTIMONIALS_APPROVE,
        PERMISSIONS.TEAM_MANAGE,
      ]),
    ).map((s) => s.key);
    expect(keys).toEqual(["home", "content", "testimonials", "settings"]);
  });

  it("hides Content, Testimonials and Settings from a member with none of their permissions", () => {
    const keys = visibleSections(
      new Set<Permission>([PERMISSIONS.MESSAGES_VIEW, PERMISSIONS.DOCUMENTS_VIEW]),
    ).map((s) => s.key);
    expect(keys).toEqual(["home"]);
  });

  it("gates every section but the overview with a permission key, never a role", () => {
    const values = new Set<string>(Object.values(PERMISSIONS));
    for (const section of DASHBOARD_SECTIONS) {
      const keys = sectionKeys(section);
      if (section.key === "home") expect(keys).toEqual([]);
      else {
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) expect(values.has(key)).toBe(true);
      }
    }
  });
});

describe("grantedPermissions", () => {
  it("keeps only the permissions the check allows", async () => {
    const check = vi.fn(async (key: Permission) => key === PERMISSIONS.CONTENT_MANAGE);
    const granted = await grantedPermissions(
      [PERMISSIONS.CONTENT_MANAGE, PERMISSIONS.TEAM_MANAGE],
      "en",
      check,
    );
    expect([...granted]).toEqual([PERMISSIONS.CONTENT_MANAGE]);
    expect(check).toHaveBeenCalledWith(PERMISSIONS.TEAM_MANAGE, "en");
  });

  it("returns nothing when every check refuses", async () => {
    const granted = await grantedPermissions([PERMISSIONS.CONTENT_MANAGE], "ar", async () => false);
    expect(granted.size).toBe(0);
  });
});
