import { useTranslations } from "next-intl";

export const MAIN_CONTENT_ID = "main-content";

export function SkipLink() {
  const t = useTranslations("Common");

  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-md"
    >
      {t("skipToContent")}
    </a>
  );
}
