"use client";

import { useId, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { cx, FOCUS_RING } from "./cx";

export type LanguagePanel = {
  /** The tab and panel name, in its own language. */
  label: string;
  content: ReactNode;
  /** A field in this panel has an error. Marks the tab, so it isn't missed. */
  invalid?: boolean;
};

const WIDE = "(min-width: 64rem)"; // Tailwind's `lg`.

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Arabic and English versions of the same content. Side by side from `lg`
 * up, tabs below it. Each panel has its own `lang` and `dir`, whatever the
 * page language, so Arabic is always RTL and English always LTR.
 *
 * Both panels stay in the DOM, so a form posts both languages.
 */
export function LanguageTabs({
  arabic,
  english,
  label,
  invalidLabel,
  className,
}: {
  arabic: LanguagePanel;
  english: LanguagePanel;
  /** Names the tab list for screen readers, such as "Language". */
  label: string;
  /** Read after an invalid tab's name, such as "has errors". */
  invalidLabel?: string;
  className?: string;
}) {
  const id = useId();
  const [selected, setSelected] = useState<"ar" | "en">("ar");
  // The server renders tabs. Wide screens switch to side by side on hydration;
  // CSS already shows both panels, so nothing moves.
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => false);

  const panels = [
    { lang: "ar" as const, dir: "rtl" as const, ...arabic },
    { lang: "en" as const, dir: "ltr" as const, ...english },
  ];

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    // Two tabs: every arrow moves to the other one, in either direction.
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home" ? "ar" : event.key === "End" ? "en" : selected === "ar" ? "en" : "ar";
    setSelected(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        className="mb-4 inline-flex gap-1 rounded-lg border border-text/15 bg-surface p-1 lg:hidden"
      >
        {panels.map((panel) => {
          const active = selected === panel.lang;
          return (
            <button
              key={panel.lang}
              id={`${id}-tab-${panel.lang}`}
              type="button"
              role="tab"
              lang={panel.lang}
              aria-selected={active}
              aria-controls={`${id}-panel-${panel.lang}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setSelected(panel.lang)}
              onKeyDown={onKeyDown}
              className={cx(
                "inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold",
                FOCUS_RING,
                active ? "bg-text text-background" : "text-text hover:bg-text/10",
              )}
            >
              {panel.label}
              {panel.invalid && (
                <>
                  {" "}
                  <span aria-hidden="true" className="size-2 rounded-full bg-danger" />
                  {invalidLabel && <span className="sr-only">{invalidLabel}</span>}
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {panels.map((panel) => (
          <section
            key={panel.lang}
            id={`${id}-panel-${panel.lang}`}
            lang={panel.lang}
            dir={panel.dir}
            {...(wide
              ? { "aria-labelledby": `${id}-heading-${panel.lang}` }
              : { role: "tabpanel", "aria-labelledby": `${id}-tab-${panel.lang}` })}
            className={cx(
              "min-w-0 rounded-lg border border-text/10 bg-surface p-4 md:p-6",
              selected === panel.lang ? "block" : "hidden lg:block",
              panel.invalid && "lg:border-danger",
            )}
          >
            <h3
              id={`${id}-heading-${panel.lang}`}
              className="mb-4 hidden items-center gap-2 text-lg lg:flex"
            >
              {panel.label}
              {panel.invalid && (
                <>
                  {" "}
                  <span aria-hidden="true" className="size-2 rounded-full bg-danger" />
                  {invalidLabel && <span className="sr-only">{invalidLabel}</span>}
                </>
              )}
            </h3>
            <div className="space-y-4">{panel.content}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
