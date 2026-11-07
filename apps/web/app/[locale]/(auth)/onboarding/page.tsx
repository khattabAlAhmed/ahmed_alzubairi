import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";

// The onboarding task fills this in and reads `RETURN_PARAM` from the URL, through `safeReturnPath`.
export default function OnboardingPage() {
  const t = useTranslations("Onboarding");

  return <EmptyState title={t("title")} text={t("empty")} />;
}
