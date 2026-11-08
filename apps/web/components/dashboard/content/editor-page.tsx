import type { ContentType, Locale } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { DashboardIntl } from "../dashboard-intl";
import { loadRefOptions, mediaBase } from "./data";
import { EditorHost } from "./editor-host";
import type { Row } from "./form-values";
import { listPath } from "./registry";
import { PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";

/** The shared frame of the new and edit pages: back link, title, editor. */
export async function EditorPage({
  type,
  row,
  locale,
  justCreated = false,
  title,
}: {
  type: ContentType;
  row: Row | null;
  locale: Locale;
  justCreated?: boolean;
  title: string;
}) {
  const t = await getTranslations("DashboardContent");
  const refOptions = await loadRefOptions(type, locale, t("list.untitled"));

  return (
    <div className="space-y-6">
      <Link
        href={listPath(type)}
        className="text-sm font-semibold underline-offset-4 hover:underline"
      >
        {t("editor.back")}
      </Link>
      <PageHeader title={title} eyebrow={t(`types.${type}`)} />
      <DashboardIntl>
        <EditorHost
          // One form per row: moving to another row starts a fresh form.
          key={row ? String(row.id ?? row.key) : "new"}
          type={type}
          row={row}
          refOptions={refOptions}
          mediaBase={mediaBase()}
          justCreated={justCreated}
        />
      </DashboardIntl>
    </div>
  );
}
