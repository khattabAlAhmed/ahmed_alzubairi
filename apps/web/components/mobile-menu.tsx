"use client";

import { SITE_NAME } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx, FOCUS_RING } from "./ui/cx";
import { ConsultationButton } from "./consultation-button";
import { CloseIcon, MenuIcon } from "./icons";
import { LanguageSwitch } from "./language-switch";
import { MENU_NAV } from "./nav-items";
import { NavLink } from "./nav-link";
import { ThemeSwitch } from "./theme-switch";

const PANEL_ID = "mobile-menu";

const ICON_BUTTON = cx(
  "inline-flex size-11 cursor-pointer items-center justify-center text-ink transition-state hover:bg-surface-hover",
  FOCUS_RING,
);

/** What Tab can reach inside the panel, in order. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab and Shift+Tab inside `panel`: from the last control to the first,
 * and back. Returns true when it moved focus.
 */
export function trapTab(panel: HTMLElement, event: Pick<KeyboardEvent, "key" | "shiftKey" | "preventDefault">) {
  if (event.key !== "Tab") return false;
  const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => !item.closest("[hidden]"));
  const first = items[0];
  const last = items.at(-1);
  if (!first || !last) return false;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !panel.contains(active))) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (active === last || !panel.contains(active))) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

/**
 * The phone menu (the MobileMenu board): it opens over the page, behind a
 * scrim, as a labelled dialog. His name and the close button on top, then the
 * index of sections with the current page marked, then the language and theme,
 * then «اطلب استشارة». Focus stays inside until it closes; Esc closes it and
 * gives focus back to the menu button. `extra` holds the sign-in link.
 */
export function MobileMenu({ extra }: { extra?: ReactNode }) {
  const t = useTranslations("Header");
  const tNav = useTranslations("Nav");
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  const shut = (giveFocusBack: boolean) => {
    setOpen(false);
    // Back to the button that opened it, never lost on the page (WCAG 2.4.3).
    if (giveFocusBack) toggle.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    // The page under the scrim doesn't scroll while the menu is open.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
        return;
      }
      if (panel.current) trapTab(panel.current, event);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <div className="xl:hidden">
      <button
        ref={toggle}
        type="button"
        className={ICON_BUTTON}
        aria-label={t("openMenu")}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen(true)}
      >
        <MenuIcon size={24} />
      </button>
      <div hidden={!open} className="fixed inset-0 z-50">
        {/* The scrim: a click outside the panel closes it. */}
        <div aria-hidden="true" className="absolute inset-0 bg-scrim" onClick={() => shut(true)} />
        <div
          ref={panel}
          id={PANEL_ID}
          role="dialog"
          aria-modal="true"
          aria-label={t("menuLabel")}
          className="absolute inset-y-0 end-0 flex w-full max-w-[400px] flex-col overflow-y-auto overscroll-contain bg-bg text-ink shadow-overlay"
        >
          <div className="flex shrink-0 items-center justify-between border-t-2 border-b border-t-rule border-b-line ps-4 pe-2 py-1">
            <span className="text-[17px] font-semibold">{SITE_NAME}</span>
            <button
              ref={close}
              type="button"
              className={ICON_BUTTON}
              aria-label={t("closeMenu")}
              onClick={() => shut(true)}
            >
              <CloseIcon size={24} />
            </button>
          </div>
          <nav aria-label={tNav("mainLabel")}>
            <ol>
              {MENU_NAV.map((item) => (
                <li key={item.href}>
                  <NavLink
                    href={item.href}
                    onClick={() => shut(false)}
                    className={cx(
                      "block border-b border-line px-4 py-3.5 text-[19px] text-ink no-underline transition-state hover:bg-surface-hover",
                      // The current page: a vertical accent line on the start edge (the board).
                      "rtl:aria-[current=page]:shadow-[inset_-2px_0_0_var(--accent)] ltr:aria-[current=page]:shadow-[inset_2px_0_0_var(--accent)]",
                      FOCUS_RING,
                      "focus-visible:-outline-offset-2",
                    )}
                  >
                    {tNav(item.label)}
                  </NavLink>
                </li>
              ))}
            </ol>
          </nav>
          <div className="grid shrink-0 grid-cols-2 border-b border-line [&>*]:min-h-13 [&>*]:w-full [&>*+*]:border-s [&>*+*]:border-line">
            <LanguageSwitch long />
            <ThemeSwitch withText />
          </div>
          {extra && <div className="shrink-0 border-b border-line px-2 py-1">{extra}</div>}
          <div className="shrink-0 p-4">
            <ConsultationButton block />
          </div>
        </div>
      </div>
    </div>
  );
}
