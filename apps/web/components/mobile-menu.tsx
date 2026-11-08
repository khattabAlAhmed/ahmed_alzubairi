"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
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
        className="inline-flex size-9 items-center justify-center rounded-md hover:bg-text/10"
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
        className="absolute inset-x-0 top-full border-b border-text/10 bg-surface shadow-md"
      >
        <nav aria-label={tNav("mainLabel")}>
          <ul className="mx-auto max-w-7xl px-4 py-2">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-3 hover:bg-text/10 aria-[current=page]:font-semibold"
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
