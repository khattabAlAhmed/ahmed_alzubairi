import { PERMISSIONS } from "@repo/shared";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { hasCustomEditor } from "@/components/dashboard/content/custom-editors";
import { loadRow } from "@/components/dashboard/content/data";
import { EditorPage } from "@/components/dashboard/content/editor-page";
import { rowTitle } from "@/components/dashboard/content/form-values";
import { isEditable, parseContentType } from "@/components/dashboard/content/registry";
import { sectionAccess } from "@/components/dashboard/gate";
import { Refusal } from "@/components/dashboard/refusal";
import { EmptyState } from "@/components/empty-state";
import { requireTeamMember } from "@/lib/auth/gates";

type Search = { type?: string | string[]; id?: string | string[]; created?: string | string[] };

export default async function EditContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  await requireTeamMember(params, "/dashboard/content/edit");
  const access = await sectionAccess(params, PERMISSIONS.CONTENT_MANAGE);
  if (!access.allowed) return <Refusal />;

  const search = await searchParams;
  const type = parseContentType(search.type);
  if (!type || !isEditable(type, { customEditor: hasCustomEditor(type) })) notFound();

  const t = await getTranslations("DashboardContent");
  const row = typeof search.id === "string" ? await loadRow(type, search.id) : null;
  if (!row) {
    return <EmptyState title={t("editor.notFoundTitle")} text={t("editor.notFoundText")} />;
  }

  return (
    <EditorPage
      type={type}
      row={row}
      locale={access.locale}
      justCreated={search.created === "1"}
      title={
        rowTitle(type, row, access.locale) ??
        t("editor.editTitle", { type: t(`types.${type}`) })
      }
    />
  );
}
