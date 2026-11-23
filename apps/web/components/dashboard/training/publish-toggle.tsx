"use client";

import type { ContentStatus } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { useRouter } from "@/i18n/navigation";
import { updateCourse } from "./send";

/**
 * Publish or unpublish one course. `PATCH /api/admin/courses` checks
 * `training.manage` and refuses to publish a course without a title and a
 * description, or a scheduled one without a date.
 */
export function PublishToggle({
  id,
  title,
  status,
}: {
  id: string;
  title: string;
  status: ContentStatus;
}) {
  const t = useTranslations("DashboardTraining.publish");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const next: ContentStatus = status === "published" ? "draft" : "published";

  async function toggle() {
    setBusy(true);
    setNotice(null);
    const result = await updateCourse({ id, status: next });
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
          className={cx("text-sm font-semibold", notice.ok ? "text-ink" : "text-danger")}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}
