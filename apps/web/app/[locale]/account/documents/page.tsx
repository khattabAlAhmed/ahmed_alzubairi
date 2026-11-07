import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { requireProfile } from "@/lib/auth/gates";

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await requireProfile(params, "/account/documents");
  const t = await getTranslations("Account");

  return <EmptyState title={t("documents")} text={t("empty")} />;
}
