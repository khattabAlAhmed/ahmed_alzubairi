"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui";
import { ConfirmTwice } from "@/components/workspace";
import { useRouter } from "@/i18n/navigation";
import { deleteDocument } from "./send";

/**
 * Deletes a document after the double confirmation (§8). Shown only with
 * `data.delete`; `DELETE /api/admin/documents/:id` checks it again.
 */
export function DeleteDocument({ id, title }: { id: string; title: string }) {
  const t = useTranslations("DashboardDocuments.delete");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function confirm() {
    setBusy(true);
    setError(undefined);
    const result = await deleteDocument(id);
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? t("failed"));
      return;
    }
    setOpen(false);
    router.push("/dashboard/documents");
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
