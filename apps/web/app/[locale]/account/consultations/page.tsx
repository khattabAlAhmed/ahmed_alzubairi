import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";

export default function ConsultationsPage() {
  const t = useTranslations("Account");

  return <EmptyState title={t("consultations")} text={t("consultationsEmpty")} />;
}
