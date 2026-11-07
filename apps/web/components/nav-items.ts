import type { Messages } from "next-intl";

type NavItem<Label extends string> = { href: string; label: Label };

type NavLabel = keyof Messages["Nav"];
type AccountLabel = keyof Messages["Account"];

export const MAIN_NAV = [
  { href: "/", label: "home" },
  { href: "/about", label: "about" },
  { href: "/expertise", label: "expertise" },
  { href: "/services", label: "services" },
  { href: "/projects", label: "projects" },
  { href: "/training", label: "training" },
  { href: "/blog", label: "blog" },
  { href: "/contact", label: "contact" },
] as const satisfies readonly NavItem<NavLabel>[];

export const FOOTER_NAV = [
  ...MAIN_NAV.filter((item) => item.href !== "/contact"),
  { href: "/resources", label: "resources" },
  { href: "/media", label: "media" },
  { href: "/clients", label: "clients" },
  { href: "/documents", label: "documents" },
  { href: "/faq", label: "faq" },
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
