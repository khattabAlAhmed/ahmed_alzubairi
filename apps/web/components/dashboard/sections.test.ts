import { PERMISSIONS, type Permission } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import { grantedPermissions } from "./access";
import { DASHBOARD_SECTIONS, sectionPermissions, visibleSections } from "./sections";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));

describe("dashboard menu", () => {
  it("checks each permission the menu uses once", () => {
    expect(sectionPermissions()).toEqual([PERMISSIONS.CONTENT_MANAGE]);
  });

  it("shows Content to a member with content.manage", () => {
    const keys = visibleSections(new Set([PERMISSIONS.CONTENT_MANAGE])).map((s) => s.key);
    expect(keys).toEqual(["home", "content"]);
  });

  it("hides Content from a member without content.manage", () => {
    const keys = visibleSections(
      new Set<Permission>([PERMISSIONS.MESSAGES_VIEW, PERMISSIONS.DOCUMENTS_VIEW]),
    ).map((s) => s.key);
    expect(keys).toEqual(["home"]);
  });

  it("gates every section but the overview with a permission key, never a role", () => {
    const values = new Set<string>(Object.values(PERMISSIONS));
    for (const section of DASHBOARD_SECTIONS) {
      if (section.key === "home") expect(section.permission).toBeNull();
      else expect(values.has(section.permission ?? "")).toBe(true);
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
