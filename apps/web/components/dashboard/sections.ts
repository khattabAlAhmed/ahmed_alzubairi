import { PERMISSIONS, type Permission } from "@repo/shared";

/** One dashboard menu entry. Labels live under `DashboardContent.nav`. */
export type DashboardSection = {
  key: "home" | "content" | "testimonials" | "settings";
  href: string;
  /**
   * The permission that shows it, or a list where any one shows it, or null
   * for every team member. Hiding an entry is not the security check: each
   * page and route checks its own permission on the server.
   */
  permission: Permission | readonly Permission[] | null;
};

/** The keys a section accepts; empty for every team member. */
export function sectionKeys(section: DashboardSection): readonly Permission[] {
  if (section.permission === null) return [];
  return typeof section.permission === "string" ? [section.permission] : section.permission;
}

/**
 * The dashboard menu (§6.20), in order. Later phases add their sections
 * here, each with its own permission. Never a role name.
 */
export const DASHBOARD_SECTIONS: readonly DashboardSection[] = [
  { key: "home", href: "/dashboard", permission: null },
  {
    key: "content",
    href: "/dashboard/content",
    permission: PERMISSIONS.CONTENT_MANAGE,
  },
  {
    key: "testimonials",
    href: "/dashboard/testimonials",
    // Editors edit them; the admin approves them.
    permission: [PERMISSIONS.CONTENT_MANAGE, PERMISSIONS.TESTIMONIALS_APPROVE],
  },
  {
    key: "settings",
    href: "/dashboard/settings",
    permission: PERMISSIONS.TEAM_MANAGE,
  },
];

/** The permissions the menu needs to check. */
export function sectionPermissions(
  sections: readonly DashboardSection[] = DASHBOARD_SECTIONS,
): Permission[] {
  return [...new Set(sections.flatMap(sectionKeys))];
}

/** The sections a member with these permissions sees. */
export function visibleSections(
  granted: ReadonlySet<Permission>,
  sections: readonly DashboardSection[] = DASHBOARD_SECTIONS,
): DashboardSection[] {
  return sections.filter((section) => {
    const keys = sectionKeys(section);
    return keys.length === 0 || keys.some((key) => granted.has(key));
  });
}
