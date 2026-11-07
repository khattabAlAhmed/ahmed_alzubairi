import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowForwardIcon } from "./icons";
import { MAIN_CONTENT_ID } from "./skip-link";

export function NotFoundContent() {
  const t = useTranslations("NotFound");

  return (
    <main
      id={MAIN_CONTENT_ID}
      className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <h1 className="text-3xl">{t("title")}</h1>
      <p className="text-text-secondary">{t("description")}</p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 font-semibold underline underline-offset-4"
      >
        {t("backHome")}
        <ArrowForwardIcon />
      </Link>
    </main>
  );
}
