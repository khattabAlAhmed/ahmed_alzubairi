import { PERMISSIONS } from "@repo/shared";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { hasCustomEditor } from "@/components/dashboard/content/custom-editors";
import { EditorPage } from "@/components/dashboard/content/editor-page";
import {
  canCreate,
  isEditable,
  parseContentType,
} from "@/components/dashboard/content/registry";
import { sectionAccess } from "@/components/dashboard/gate";
import { Refusal } from "@/components/dashboard/refusal";
import { requireTeamMember } from "@/lib/auth/gates";

export default async function NewContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  await requireTeamMember(params, "/dashboard/content/new");
  const access = await sectionAccess(params, PERMISSIONS.CONTENT_MANAGE);
  if (!access.allowed) return <Refusal />;

  const type = parseContentType((await searchParams).type);
  if (
    !type ||
    !canCreate(type) ||
    !isEditable(type, { customEditor: hasCustomEditor(type) })
  ) {
    notFound();
  }

  const t = await getTranslations("DashboardContent");
  return (
    <EditorPage
      type={type}
      row={null}
      locale={access.locale}
      title={t("editor.newTitle", { type: t(`types.${type}`) })}
    />
  );
}
