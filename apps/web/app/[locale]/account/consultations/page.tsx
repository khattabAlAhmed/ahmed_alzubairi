import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { requireProfile } from "@/lib/auth/gates";

export default async function ConsultationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await requireProfile(params, "/account/consultations");
  const t = await getTranslations("Account");

  return <EmptyState title={t("consultations")} text={t("consultationsEmpty")} />;
}
