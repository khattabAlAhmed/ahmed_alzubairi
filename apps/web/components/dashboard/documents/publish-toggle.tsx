"use client";

import type { ContentStatus } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { useRouter } from "@/i18n/navigation";
import { updateDocument } from "./send";

/** Publish or unpublish one document. `PATCH /api/admin/documents` checks `documents.manage`. */
export function PublishToggle({
  id,
  title,
  status,
}: {
  id: string;
  title: string;
  status: ContentStatus;
}) {
  const t = useTranslations("DashboardDocuments.publish");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const next: ContentStatus = status === "published" ? "draft" : "published";

  async function toggle() {
    setBusy(true);
    setNotice(null);
    const result = await updateDocument({ id, status: next });
    setBusy(false);
    if (!result.ok) {
      setNotice({ ok: false, text: result.message ?? t("failed") });
      return;
    }
    setNotice({ ok: true, text: next === "published" ? t("published") : t("unpublished") });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant={next === "published" ? "primary" : "secondary"}
        loading={busy}
        loadingLabel={t("working")}
        aria-label={next === "published" ? t("publishLabel", { title }) : t("unpublishLabel", { title })}
        onClick={toggle}
      >
        {next === "published" ? t("publish") : t("unpublish")}
      </Button>
      {notice && (
        <p
          role={notice.ok ? "status" : "alert"}
          className={cx("text-sm font-semibold", notice.ok ? "text-text" : "text-danger")}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}
