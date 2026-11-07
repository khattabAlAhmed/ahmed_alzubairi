import type { ReactNode } from "react";
import { LanguageSwitch } from "./language-switch";
import { NavLink } from "./nav-link";
import { SiteLogo } from "./site-logo";
import { MAIN_CONTENT_ID, SkipLink } from "./skip-link";
import { ThemeSwitch } from "./theme-switch";

export type AppShellLink = { href: string; label: string };

/** The practical layout shared by the account and the dashboard (§13). */
export function AppShell({
  title,
  navLabel,
  links,
  children,
}: {
  title: string;
  navLabel: string;
  links: readonly AppShellLink[];
  children: ReactNode;
}) {
  return (
    <>
      <SkipLink />
      <header className="border-b border-text/10 bg-surface">
        <div className="flex h-14 items-center gap-2 px-4">
          <SiteLogo />
          <div className="ms-auto flex shrink-0 items-center gap-1">
            <LanguageSwitch />
            <ThemeSwitch />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-b border-text/10 bg-surface p-4 md:w-60 md:shrink-0 md:border-e md:border-b-0">
          <p className="mb-3 font-semibold">{title}</p>
          {links.length > 0 && (
            <nav aria-label={navLabel}>
              <ul className="flex flex-wrap gap-1 md:flex-col">
                {links.map((link) => (
                  <li key={link.href}>
                    <NavLink
                      href={link.href}
                      className="block rounded-md px-3 py-2 text-sm hover:bg-text/10 aria-[current=page]:bg-text/10 aria-[current=page]:font-semibold"
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </aside>
        <main id={MAIN_CONTENT_ID} className="min-w-0 flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </>
  );
}
