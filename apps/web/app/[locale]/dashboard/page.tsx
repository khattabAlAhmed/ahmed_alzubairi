import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { requireTeamMember } from "@/lib/auth/gates";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await requireTeamMember(params, "/dashboard");
  const t = await getTranslations("Dashboard");

  return <EmptyState title={t("title")} text={t("empty")} />;
}
