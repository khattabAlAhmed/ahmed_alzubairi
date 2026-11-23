import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui";

/** Previous and next links for a dashboard list; nothing on a single page. */
export function Paging({
  page,
  pages,
  link,
}: {
  page: number;
  pages: number;
  link: (page: number) => string;
}) {
  const t = useTranslations("DashboardTraining.paging");
  if (pages <= 1) return null;
  return (
    <nav aria-label={t("label")} className="flex flex-wrap items-center justify-between gap-3">
      {page > 1 ? (
        <ButtonLink href={link(page - 1)} variant="secondary" size="sm">
          {t("previous")}
        </ButtonLink>
      ) : (
        <span />
      )}
      <p className="text-sm text-ink-2">{t("position", { page, pages })}</p>
      {page < pages ? (
        <ButtonLink href={link(page + 1)} variant="secondary" size="sm">
          {t("next")}
        </ButtonLink>
      ) : (
        <span />
      )}
    </nav>
  );
}
