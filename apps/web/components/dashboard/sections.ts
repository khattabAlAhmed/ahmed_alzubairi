import { PERMISSIONS, type Permission } from "@repo/shared";

/** One dashboard menu entry. Labels live under `DashboardContent.nav`. */
export type DashboardSection = {
  key: "home" | "content";
  href: string;
  /** The permission that shows it, or null for every team member. */
  permission: Permission | null;
};

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
];

/** The permissions the menu needs to check. */
export function sectionPermissions(
  sections: readonly DashboardSection[] = DASHBOARD_SECTIONS,
): Permission[] {
  return [
    ...new Set(
      sections.flatMap((section) =>
        section.permission ? [section.permission] : [],
      ),
    ),
  ];
}

/** The sections a member with these permissions sees. */
export function visibleSections(
  granted: ReadonlySet<Permission>,
  sections: readonly DashboardSection[] = DASHBOARD_SECTIONS,
): DashboardSection[] {
  return sections.filter(
    (section) => section.permission === null || granted.has(section.permission),
  );
}
