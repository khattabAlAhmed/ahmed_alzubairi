import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui";

/** Previous and next links under a list. Nothing when there is one page. */
export async function Paging({
  page,
  pages,
  link,
}: {
  page: number;
  pages: number;
  link: (page: number) => string;
}) {
  if (pages <= 1) return null;
  const t = await getTranslations("DashboardTeam.paging");

  return (
    <nav aria-label={t("label")} className="flex flex-wrap items-center justify-between gap-3">
      {page > 1 ? (
        <ButtonLink href={link(page - 1)} variant="secondary" size="sm">
          {t("previous")}
        </ButtonLink>
      ) : (
        <span />
      )}
      <p className="text-sm text-text-secondary">{t("position", { page, pages })}</p>
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
