"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui";
import { ConfirmTwice } from "@/components/workspace";
import { useRouter } from "@/i18n/navigation";
import { deleteConsultation } from "./send";

/**
 * Deletes a consultation after the double confirmation (§6.17 retention).
 * Shown only with `data.delete`; the route checks it again.
 */
export function DeleteConsultation({
  id,
  title,
  remove = deleteConsultation,
}: {
  id: string;
  title: string;
  remove?: typeof deleteConsultation;
}) {
  const t = useTranslations("DashboardConsultations.delete");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function confirm() {
    setBusy(true);
    setError(undefined);
    const result = await remove(id);
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? t("failed"));
      return;
    }
    setOpen(false);
    router.push("/dashboard/consultations");
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t("button")}
      </Button>
      <ConfirmTwice
        open={open}
        onCancel={() => {
          setOpen(false);
          setError(undefined);
        }}
        onConfirm={() => void confirm()}
        title={t("title")}
        question={t("question", { title })}
        word={t("word")}
        confirmLabel={busy ? t("busy") : t("confirm")}
        busy={busy}
        error={error}
      />
    </>
  );
}
