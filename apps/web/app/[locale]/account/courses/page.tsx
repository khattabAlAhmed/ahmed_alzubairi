import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { requireProfile } from "@/lib/auth/gates";

export default async function CoursesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await requireProfile(params, "/account/courses");
  const t = await getTranslations("Account");

  return <EmptyState title={t("courses")} text={t("empty")} />;
}
