import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";

export default function CoursesPage() {
  const t = useTranslations("Account");

  return <EmptyState title={t("courses")} text={t("empty")} />;
}
