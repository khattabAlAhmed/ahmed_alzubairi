"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  createContext,
  Suspense,
  use,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { buttonClasses } from "@/components/ui/button";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { Link, usePathname } from "@/i18n/navigation";
import { otherLocale } from "@/i18n/routing";

/** Where the switch goes instead, for the page at `pathname` only. */
type Fallback = { pathname: string; href: string };

const FallbackContext = createContext<{
  fallback: Fallback | null;
  setFallback: (fallback: Fallback | null) => void;
}>({ fallback: null, setFallback: () => {} });

/**
 * Lets a page tell the header's switch that its content has no translation
 * (§6.1). The public layout wraps the page and the header in it. It holds no
 * session data, so the layout stays static.
 */
export function LanguageFallbackProvider({ children }: { children: ReactNode }) {
  const [fallback, setFallback] = useState<Fallback | null>(null);
  return <FallbackContext value={{ fallback, setFallback }}>{children}</FallbackContext>;
}

/**
 * Rendered by a page whose content isn't available in the other language: the
 * switch then goes to `href`, the section's list page, never to an empty page.
 */
export function LanguageFallback({ href }: { href: string }) {
  const { setFallback } = use(FallbackContext);
  const pathname = usePathname();

  useEffect(() => {
    setFallback({ pathname, href });
    return () => setFallback(null);
  }, [setFallback, pathname, href]);

  return null;
}

/** The switch's target: the same page, or the fallback set for this page. */
export function switchTarget(
  pathname: string,
  fallback: Fallback | null,
  query?: Record<string, string>,
): { pathname: string; query?: Record<string, string> } {
  if (fallback && fallback.pathname === pathname) return { pathname: fallback.href };
  return { pathname, query };
}

const SWITCH = cx(
  "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center px-2.5 text-ink no-underline transition-state hover:bg-surface-hover",
  FOCUS_RING,
);

/**
 * The header shows only the other language's short name (`EN`, `عربي`); `long`
 * gives its full name, as in the phone menu (the LanguageAndTheme board).
 */
function SwitchLabel({ long }: { long: boolean }) {
  const t = useTranslations("Header");
  const target = otherLocale(useLocale());
  if (long) return <span className="text-sm">{t("switchLanguage")}</span>;
  // `EN` is a Latin code, set in the mono face; `عربي` is a word.
  return <span className={target === "en" ? "font-mono text-[13px]" : "text-sm"}>{t("switchLanguageShort")}</span>;
}

/**
 * A page with no translation (§6.1): the switch says so first, in the language
 * the visitor asked for, and offers the section's list there, or to stay.
 */
export function UntranslatedSwitch({
  href,
  long = false,
  initiallyOpen = false,
}: {
  href: string;
  long?: boolean;
  /** The design-system page shows the note open. */
  initiallyOpen?: boolean;
}) {
  const t = useTranslations("Header");
  const locale = useLocale();
  const target = otherLocale(locale);
  const [open, setOpen] = useState(initiallyOpen);
  // Focus moves into the note only when a person opens it.
  const opened = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    if (opened.current) popover.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-label={t("switchLanguageLabel")}
        aria-expanded={open}
        aria-controls={id}
        lang={target}
        className={cx(SWITCH, "w-full")}
        onClick={() => {
          opened.current = !open;
          setOpen(!open);
        }}
      >
        <SwitchLabel long={long} />
      </button>
      <div
        ref={popover}
        id={id}
        hidden={!open}
        role="group"
        aria-labelledby={`${id}-title`}
        lang={target}
        dir={target === "ar" ? "rtl" : "ltr"}
        className="absolute end-0 top-full z-50 mt-1 w-[300px] max-w-[calc(100vw-2rem)] border-t-2 border-rule bg-bg p-4 text-start shadow-overlay"
      >
        <p id={`${id}-title`} className="type-small font-medium">
          {t("untranslated.title")}
        </p>
        <p className="type-caption text-ink-2">{t("untranslated.body")}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-4">
          <Link href={{ pathname: href }} locale={target} hrefLang={target} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            {t("untranslated.go")}
          </Link>
          <button
            type="button"
            className={buttonClasses({ variant: "quiet", size: "sm" })}
            onClick={() => {
              setOpen(false);
              button.current?.focus();
            }}
          >
            {t("untranslated.stay")}
          </button>
        </div>
      </div>
    </div>
  );
}

function LanguageLink({ query, long = false }: { query?: Record<string, string>; long?: boolean }) {
  const t = useTranslations("Header");
  const locale = useLocale();
  const pathname = usePathname();
  const { fallback } = use(FallbackContext);
  const target = otherLocale(locale);
  const to = switchTarget(pathname, fallback, query);

  if (fallback && to.pathname === fallback.href && fallback.pathname === pathname) {
    return <UntranslatedSwitch href={fallback.href} long={long} />;
  }

  return (
    <Link href={to} locale={target} hrefLang={target} lang={target} aria-label={t("switchLanguageLabel")} className={SWITCH}>
      <SwitchLabel long={long} />
    </Link>
  );
}

function LanguageLinkWithQuery({ long }: { long: boolean }) {
  const search = useSearchParams();

  return <LanguageLink query={Object.fromEntries(search)} long={long} />;
}

/** Keeps the query too, or switching language on sign-in would lose the return path. */
export function LanguageSwitch({ long = false }: { long?: boolean }) {
  return (
    <Suspense fallback={<LanguageLink long={long} />}>
      <LanguageLinkWithQuery long={long} />
    </Suspense>
  );
}
