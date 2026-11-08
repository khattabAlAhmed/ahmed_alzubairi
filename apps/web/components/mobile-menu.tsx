"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { cx, FOCUS_RING } from "./ui/cx";
import { CloseIcon, MenuIcon } from "./icons";
import { MAIN_NAV } from "./nav-items";
import { NavLink } from "./nav-link";

const PANEL_ID = "mobile-menu";

/** `extra` holds what the header row hides on small screens: sign-in and quick contact. */
export function MobileMenu({ extra }: { extra?: ReactNode }) {
  const t = useTranslations("Header");
  const tNav = useTranslations("Nav");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <div className="xl:hidden">
      <button
        type="button"
        className={cx("inline-flex size-9 items-center justify-center rounded-md hover:bg-text/10", FOCUS_RING)}
        aria-label={open ? t("closeMenu") : t("openMenu")}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen(!open)}
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>
      <div
        id={PANEL_ID}
        hidden={!open}
        // Scrolls on its own when it is taller than the screen (a phone held sideways).
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain border-b border-text/10 bg-surface shadow-md"
      >
        <nav aria-label={tNav("mainLabel")}>
          <ul className="mx-auto max-w-7xl px-4 py-2">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cx(
                    "block rounded-md border-s-2 border-transparent px-3 py-3 hover:bg-text/10",
                    "aria-[current=page]:border-accent aria-[current=page]:bg-text/5 aria-[current=page]:font-semibold",
                    FOCUS_RING,
                    "focus-visible:-outline-offset-2",
                  )}
                >
                  {tNav(item.label)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {extra && (
          <div className="mx-auto max-w-7xl px-4">
            {extra}
          </div>
        )}
      </div>
    </div>
  );
}
