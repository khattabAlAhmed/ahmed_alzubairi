import { availableLocales, type ContentType, type Locale } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { hasCustomEditor } from "./custom-editors";
import { loadRows } from "./data";
import { rowStatus, rowTitle } from "./form-values";
import { canCreate, editPath, isEditable, newPath } from "./registry";
import { StatusBadges } from "./status-badges";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";

/** One content type's rows, with status and languages. The page checks access first. */
export async function TypeList({ type, locale }: { type: ContentType; locale: Locale }) {
  const [t, rows] = await Promise.all([
    getTranslations("DashboardContent"),
    loadRows(type),
  ]);
  const editable = isEditable(type, { customEditor: hasCustomEditor(type) });
  const creatable = editable && canCreate(type);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/content"
        className="text-sm font-semibold underline-offset-4 hover:underline"
      >
        {t("list.backToTypes")}
      </Link>
      <PageHeader
        title={t(`types.${type}`)}
        actions={
          creatable ? (
            <ButtonLink href={newPath(type)}>{t("list.new")}</ButtonLink>
          ) : undefined
        }
      />
      {!editable && (
        <p role="note" className="rounded-md border border-text/15 p-3 text-sm">
          {t("list.comingSoon")}
        </p>
      )}
      {rows.length === 0 ? (
        <Card as="section">
          <h2 className="text-xl">{t("list.emptyTitle")}</h2>
          <p className="mt-2 text-text-secondary">
            {creatable ? t("list.emptyText") : t("list.emptyFixed")}
          </p>
        </Card>
      ) : (
        <ul className="divide-y divide-text/10 rounded-lg border border-text/10 bg-surface">
          {rows.map((row) => {
            const ref = String(type === "home_sections" ? row.key : row.id);
            const title = rowTitle(type, row, locale) ?? t("list.untitled");
            const locales: Locale[] = availableLocales(type, row);
            const updated = typeof row.updatedAt === "string" ? new Date(row.updatedAt) : null;
            return (
              <li
                key={ref}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  {editable ? (
                    <Link
                      href={editPath(type, ref)}
                      aria-label={t("list.editItem", { title })}
                      className="font-semibold break-words hover:underline"
                    >
                      {title}
                    </Link>
                  ) : (
                    <p className="font-semibold break-words">{title}</p>
                  )}
                  {updated && (
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {t("list.updated", { date: date.format(updated) })}
                    </p>
                  )}
                </div>
                <StatusBadges status={rowStatus(row)} locales={locales} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
