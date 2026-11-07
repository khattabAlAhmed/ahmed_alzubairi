import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";

export default function ProfilePage() {
  const t = useTranslations("Account");

  return <EmptyState title={t("profile")} text={t("empty")} />;
}
