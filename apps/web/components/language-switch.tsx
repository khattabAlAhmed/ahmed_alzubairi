"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  createContext,
  Suspense,
  use,
  useEffect,
  useState,
  type ReactNode,
} from "react";
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

function LanguageLink({ query }: { query?: Record<string, string> }) {
  const t = useTranslations("Header");
  const locale = useLocale();
  const pathname = usePathname();
  const { fallback } = use(FallbackContext);
  const target = otherLocale(locale);

  return (
    <Link
      href={switchTarget(pathname, fallback, query)}
      locale={target}
      hrefLang={target}
      lang={target}
      aria-label={t("switchLanguageLabel")}
      className={cx(
        "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-1 text-sm font-semibold hover:bg-text/10",
        FOCUS_RING,
      )}
    >
      <span className="lg:hidden">{t("switchLanguageShort")}</span>
      <span className="hidden lg:inline">{t("switchLanguage")}</span>
    </Link>
  );
}

function LanguageLinkWithQuery() {
  const search = useSearchParams();

  return <LanguageLink query={Object.fromEntries(search)} />;
}

/** Keeps the query too, or switching language on sign-in would lose the return path. */
export function LanguageSwitch() {
  return (
    <Suspense fallback={<LanguageLink />}>
      <LanguageLinkWithQuery />
    </Suspense>
  );
}
