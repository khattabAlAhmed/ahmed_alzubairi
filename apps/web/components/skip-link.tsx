import { useTranslations } from "next-intl";
import { SkipLinkFocus } from "./public/skip-link-focus";

export const MAIN_CONTENT_ID = "main-content";

export function SkipLink() {
  const t = useTranslations("Common");

  return (
    <>
      <SkipLinkFocus targetId={MAIN_CONTENT_ID} />
      <a
        href={`#${MAIN_CONTENT_ID}`}
        // The SkipAndConsent board: ink on the page ground, top start corner, shown on the first Tab.
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-3 focus:z-50 focus:bg-ink focus:px-4.5 focus:py-3 focus:text-[15px] focus:text-bg focus:no-underline focus-ring"
      >
        {t("skipToContent")}
      </a>
    </>
  );
}
