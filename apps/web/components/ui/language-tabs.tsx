"use client";

import {
  createContext,
  useContext,
  useId,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AlertIcon } from "../icons";
import { cx, TAB_LIST, tabClasses } from "./cx";

export type LanguagePanel = {
  /** The tab and panel name, in its own language. */
  label: string;
  content: ReactNode;
  /** A field in this panel has an error. Marks the tab, so it isn't missed. */
  invalid?: boolean;
};

/** The language and direction of the content typed in a panel. */
export type PanelLanguage = { lang: "ar" | "en"; dir: "rtl" | "ltr" };

/** A glyph and a hidden word, so an invalid tab never relies on color alone. */
function InvalidMark({ label }: { label?: string }) {
  return (
    <>
      {" "}
      <AlertIcon aria-hidden="true" className="size-4 shrink-0 text-danger" />
      {label && <span className="sr-only">{label}</span>}
    </>
  );
}

const PanelLanguageContext = createContext<PanelLanguage | null>(null);

/**
 * The language of the `LanguageTabs` panel around a field, or null outside
 * one. Content controls (inputs, text areas, the rich-text editing area) put
 * it on themselves; labels, hints and errors don't, so they stay in the UI's.
 */
export function usePanelLanguage(): PanelLanguage | null {
  return useContext(PanelLanguageContext);
}

// Fixed objects, so a render of the tabs doesn't re-render every field.
const ARABIC: PanelLanguage = { lang: "ar", dir: "rtl" };
const ENGLISH: PanelLanguage = { lang: "en", dir: "ltr" };

const WIDE = "(min-width: 64rem)"; // Tailwind's `lg`.

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Arabic and English versions of the same content. Side by side from `lg`
 * up, tabs below it. The content typed in a panel has the panel's `lang` and
 * `dir`, whatever the page language, so Arabic is always RTL and English
 * always LTR: the content controls read them from `usePanelLanguage`. The
 * text around them (labels, hints, errors) is UI text, so the panel itself
 * keeps the page's language and direction.
 *
 * Both panels stay in the DOM, so a form posts both languages.
 */
export function LanguageTabs({
  arabic,
  english,
  label,
  invalidLabel,
  headingLevel = 3,
  className,
}: {
  arabic: LanguagePanel;
  english: LanguagePanel;
  /** Names the tab list for screen readers, such as "Language". */
  label: string;
  /** Read after an invalid tab's name, such as "has errors". */
  invalidLabel?: string;
  /**
   * The level of each panel's heading (shown side by side, from `lg`): one
   * below the heading the tabs sit under. 2 when they come straight after
   * the page's h1.
   */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}) {
  const id = useId();
  const Heading = `h${headingLevel}` as const;
  const [selected, setSelected] = useState<"ar" | "en">("ar");
  // The server renders tabs. Wide screens switch to side by side on hydration;
  // CSS already shows both panels, so nothing moves.
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => false);

  const panels = [
    { ...arabic, ...ARABIC, language: ARABIC },
    { ...english, ...ENGLISH, language: ENGLISH },
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
        className={cx(TAB_LIST, "mb-5 lg:hidden")}
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
              className={tabClasses(active)}
            >
              {panel.label}
              {panel.invalid && <InvalidMark label={invalidLabel} />}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {panels.map((panel) => (
          <section
            key={panel.lang}
            id={`${id}-panel-${panel.lang}`}
            {...(wide
              ? { "aria-labelledby": `${id}-heading-${panel.lang}` }
              : { role: "tabpanel", "aria-labelledby": `${id}-tab-${panel.lang}` })}
            className={cx(
              // Each panel opens with the heavy rule, like a record.
              "min-w-0 border-t-2 border-rule pt-5 lg:pt-4",
              selected === panel.lang ? "block" : "hidden lg:block",
              panel.invalid && "lg:border-danger",
            )}
          >
            {/* The language's own name: its own `lang`, on the UI's start side. */}
            <Heading
              id={`${id}-heading-${panel.lang}`}
              lang={panel.lang}
              className="mb-4 hidden items-center gap-2 type-h3 lg:flex"
            >
              {panel.label}
              {panel.invalid && <InvalidMark label={invalidLabel} />}
            </Heading>
            <PanelLanguageContext.Provider value={panel.language}>
              <div className="space-y-4">{panel.content}</div>
            </PanelLanguageContext.Provider>
          </section>
        ))}
      </div>
    </div>
  );
}
