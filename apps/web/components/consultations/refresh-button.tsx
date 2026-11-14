"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";

/** "تحديث" (§6.17): reloads the page's data from the server. No realtime. */
export function RefreshButton() {
  const t = useTranslations("AccountConsultations.detail");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      loading={pending}
      loadingLabel={t("refreshing")}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? t("refreshing") : t("refresh")}
    </Button>
  );
}
