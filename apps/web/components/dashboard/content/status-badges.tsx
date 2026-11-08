import type { Locale } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui";

/** A row's status badge (مسودة / منشور) and the languages it is available in. */
export async function StatusBadges({
  status,
  locales,
}: {
  status: "draft" | "published";
  locales: readonly Locale[];
}) {
  const t = await getTranslations("DashboardContent");

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={status === "published" ? "strong" : "neutral"}>
        {t(`status.${status}`)}
      </Badge>
      <span className="sr-only">{t("list.languages")}:</span>
      {locales.length === 0 ? (
        <Badge tone="danger">{t("list.noLanguage")}</Badge>
      ) : (
        locales.map((locale) => (
          <Badge key={locale} className="font-normal">
            <span lang={locale}>{t(`locales.${locale}`)}</span>
          </Badge>
        ))
      )}
    </div>
  );
}
