import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";

export default function DashboardPage() {
  const t = useTranslations("Dashboard");

  return <EmptyState title={t("title")} text={t("empty")} />;
}
