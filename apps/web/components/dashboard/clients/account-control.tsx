"use client";

import type { ProfileStatus } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { useRouter } from "@/i18n/navigation";

type Notice = { ok: boolean; text: string };

/**
 * `PATCH /api/admin/clients`. The route checks `clients.view_all`; showing
 * this control is not the check.
 */
export async function sendStatus(
  id: string,
  status: ProfileStatus,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true } | { ok: false; message: string | null }> {
  let response: Response;
  try {
    response = await fetchImpl("/api/admin/clients", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  } catch {
    return { ok: false, message: null };
  }
  if (response.ok) return { ok: true };
  const reply = (await response.json().catch(() => null)) as {
    error?: { message?: unknown };
  } | null;
  const message = reply?.error?.message;
  return { ok: false, message: typeof message === "string" ? message : null };
}

/** Disable or reactivate one client, with a confirm step that says what happens. */
export function AccountControl({
  id,
  name,
  status,
}: {
  id: string;
  name: string;
  status: ProfileStatus;
}) {
  const t = useTranslations("DashboardClients.account");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // A refresh brings the new status; the confirm step closes, the notice stays.
  const [stored, setStored] = useState(status);
  if (stored !== status) {
    setStored(status);
    setConfirming(false);
  }
  const next: ProfileStatus = status === "active" ? "disabled" : "active";

  async function confirm() {
    setBusy(true);
    setNotice(null);
    const result = await sendStatus(id, next);
    setBusy(false);
    setConfirming(false);
    if (!result.ok) {
      setNotice({ ok: false, text: result.message ?? t("failed") });
      return;
    }
    setNotice({ ok: true, text: next === "disabled" ? t("disabledDone") : t("enabledDone") });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {confirming ? (
        <div
          role="group"
          aria-label={status === "active" ? t("disable") : t("enable")}
          className="space-y-3 rounded-md border border-text/20 bg-background p-3"
        >
          <p className="max-w-prose text-sm">
            {status === "active" ? t("confirmDisable", { name }) : t("confirmEnable", { name })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={busy} loadingLabel={t("saving")} onClick={confirm}>
              {t("confirm")}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          {status === "active" ? t("disable") : t("enable")}
        </Button>
      )}
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
