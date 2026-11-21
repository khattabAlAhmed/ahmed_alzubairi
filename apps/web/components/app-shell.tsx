import type { ReactNode } from "react";
import { CompactHeader } from "./compact-header";
import { SIDE_LINK } from "./dashboard/side-link";
import { NavLink } from "./nav-link";
import { SignOutButton } from "./sign-out-button";
import { MAIN_CONTENT_ID } from "./skip-link";

export type AppShellLink = { href: string; label: string };



/**
 * The practical layout shared by the account and the dashboard (the AppShell
 * board): the index sidebar on `surface`, opened by the heavy rule, and the
 * content on the page ground. On phones the sidebar sits above the content.
 * Which sections show is decided by the caller (the dashboard's menu hides
 * what the member's permissions don't allow).
 */
export function AppShell({
  title,
  navLabel,
  links,
  menu,
  children,
}: {
  title: string;
  navLabel: string;
  links: readonly AppShellLink[];
  /** A menu built elsewhere, such as the dashboard's permission-based one. Shown after `links`. */
  menu?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <CompactHeader>
        <SignOutButton />
      </CompactHeader>
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-b border-line bg-surface md:w-60 md:shrink-0 md:border-e md:border-b-0">
          <p className="border-t-2 border-b border-rule border-b-line px-4.5 py-3.5 font-semibold type-small">{title}</p>
          {links.length > 0 && (
            <nav aria-label={navLabel} className="py-2">
              <ul className="flex flex-wrap md:flex-col">
                {links.map((link) => (
                  <li key={link.href}>
                    <NavLink href={link.href} className={SIDE_LINK}>
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          {menu && <div className="px-2 py-2 md:px-0">{menu}</div>}
        </aside>
        <main id={MAIN_CONTENT_ID} className="min-w-0 flex-1 bg-bg p-4 md:p-8">
          {children}
        </main>
      </div>
    </>
  );
}
