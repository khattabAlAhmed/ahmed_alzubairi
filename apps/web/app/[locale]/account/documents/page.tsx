import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";

export default function DocumentsPage() {
  const t = useTranslations("Account");

  return <EmptyState title={t("documents")} text={t("empty")} />;
}
