import type { Messages } from "next-intl";

type NavItem<Label extends string> = { href: string; label: Label };

type NavLabel = keyof Messages["Nav"];
type AccountLabel = keyof Messages["Account"];

// Only sections with a page (nav-items.test.ts checks each one).

/** The header's inline navigation on wide screens (the Header board). */
export const MAIN_NAV = [
  { href: "/", label: "home" },
  { href: "/about", label: "about" },
  { href: "/expertise", label: "expertise" },
  { href: "/services", label: "services" },
  { href: "/projects", label: "projects" },
  { href: "/blog", label: "blog" },
  { href: "/documents", label: "documentsShort" },
] as const satisfies readonly NavItem<NavLabel>[];

/** The phone menu's index of sections (the MobileMenu board). */
export const MENU_NAV = [
  { href: "/", label: "home" },
  { href: "/about", label: "about" },
  { href: "/expertise", label: "expertise" },
  { href: "/services", label: "services" },
  { href: "/projects", label: "projects" },
  { href: "/training", label: "training" },
  { href: "/blog", label: "blog" },
  { href: "/documents", label: "documents" },
  { href: "/contact", label: "contact" },
] as const satisfies readonly NavItem<NavLabel>[];

/** The footer's first index: his work (the Footer board). */
const FOOTER_SITE = [
  { href: "/about", label: "about" },
  { href: "/expertise", label: "expertise" },
  { href: "/services", label: "services" },
  { href: "/projects", label: "projects" },
  { href: "/clients", label: "clients" },
  { href: "/training", label: "training" },
] as const satisfies readonly NavItem<NavLabel>[];

/** The footer's second index: what he shares. */
const FOOTER_KNOWLEDGE = [
  { href: "/blog", label: "blog" },
  { href: "/resources", label: "resources" },
  { href: "/media", label: "media" },
  { href: "/documents", label: "documents" },
  { href: "/faq", label: "faq" },
] as const satisfies readonly NavItem<NavLabel>[];

export const FOOTER_GROUPS = [
  { label: "footerSite", items: FOOTER_SITE },
  { label: "footerKnowledge", items: FOOTER_KNOWLEDGE },
] as const satisfies readonly { label: NavLabel; items: readonly NavItem<NavLabel>[] }[];

/** Every section the footer reaches, with contact last. */
export const FOOTER_NAV = [
  ...FOOTER_SITE,
  ...FOOTER_KNOWLEDGE,
  { href: "/contact", label: "contact" },
] as const satisfies readonly NavItem<NavLabel>[];

export const ACCOUNT_NAV = [
  { href: "/account/consultations", label: "consultations" },
  { href: "/account/documents", label: "documents" },
  { href: "/account/courses", label: "courses" },
  { href: "/account/profile", label: "profile" },
] as const satisfies readonly NavItem<AccountLabel>[];

export const CONSULTATION_HREF = "/account/consultations";

/** The home link matches exactly; any other link also matches its sub-pages. */
export function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
