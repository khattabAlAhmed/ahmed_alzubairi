"use client";

import type { DocumentRequestStatus } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { Button, TextField } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { useRouter } from "@/i18n/navigation";
import { expiryFromDate, sendDecision } from "./send";

type Notice = { ok: boolean; text: string };

const subscribe = () => () => {};

/** Today in the browser's zone, as a date input's `min`: access may end tonight. */
function today(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The admin's decision on one request (§6.18 steps 4 and 5). Open requests
 * get "إتاحة" (with an optional end date) and, while still pending,
 * "التواصل أولاً"; a granted one gets "سحب" behind a confirm step. Nothing
 * else: there is no reject. Rendered only for `document_requests.decide`;
 * the route checks it again.
 */
export function DecideControls({
  requestId,
  status,
  clientName,
  documentTitle,
}: {
  requestId: string;
  status: DocumentRequestStatus;
  clientName: string;
  documentTitle: string;
}) {
  const t = useTranslations("DashboardDocumentRequests.decide");
  const router = useRouter();
  // The server doesn't know the viewer's zone, so the date limit is set in the browser.
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  const [date, setDate] = useState("");
  const [dateError, setDateError] = useState<string | undefined>();
  const [busy, setBusy] = useState<"grant" | "contact_first" | "withdraw" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // A refresh brings the new status; the confirm step closes, the notice stays.
  const [stored, setStored] = useState(status);
  if (stored !== status) {
    setStored(status);
    setConfirming(false);
    setDate("");
  }

  async function decide(
    decision: "grant" | "contact_first" | "withdraw",
    done: string,
    expiresAt?: string,
  ) {
    setBusy(decision);
    setNotice(null);
    const result = await sendDecision(
      requestId,
      decision === "grant" ? { decision, ...(expiresAt ? { expiresAt } : {}) } : { decision },
    );
    setBusy(null);
    if (!result.ok) {
      setNotice({ ok: false, text: result.message ?? t("failed") });
      return;
    }
    setNotice({ ok: true, text: done });
    router.refresh();
  }

  function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let expiresAt: string | undefined;
    if (date) {
      const value = expiryFromDate(date);
      if (!value) {
        setDateError(t("expiryPast"));
        return;
      }
      expiresAt = value;
    }
    setDateError(undefined);
    void decide("grant", t("granted"), expiresAt);
  }

  const noticeLine = notice && (
    <p
      role={notice.ok ? "status" : "alert"}
      className={cx("text-sm font-semibold", notice.ok ? "text-text" : "text-danger")}
    >
      {notice.text}
    </p>
  );

  if (status === "granted") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">{t("withdrawIntro")}</p>
        {confirming ? (
          <div role="group" aria-label={t("withdrawTitle")} className="space-y-3 rounded-md border border-text/20 bg-background p-3">
            <p className="max-w-prose text-sm">
              {t("withdrawConfirm", { document: documentTitle, client: clientName })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                loading={busy === "withdraw"}
                loadingLabel={t("working")}
                onClick={() => void decide("withdraw", t("withdrawn"))}
              >
                {t("withdrawYes")}
              </Button>
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => setConfirming(false)}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            {t("withdraw")}
          </Button>
        )}
        {noticeLine}
      </div>
    );
  }

  if (status !== "pending_review" && status !== "in_contact") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">{t("closed")}</p>
        {noticeLine}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-secondary">{t("intro")}</p>
      <form noValidate onSubmit={grant} className="space-y-3 rounded-md border border-text/15 p-4">
        <TextField
          type="date"
          label={t("expiry")}
          hint={t("expiryHint")}
          value={date}
          min={inBrowser ? today() : undefined}
          onChange={(event) => {
            setDate(event.target.value);
            setDateError(undefined);
          }}
          error={dateError}
          className="max-w-xs"
        />
        <p className="text-sm text-text-secondary">{t("grantHint")}</p>
        <Button type="submit" loading={busy === "grant"} loadingLabel={t("working")} disabled={busy !== null}>
          {t("grant")}
        </Button>
      </form>
      {status === "pending_review" && (
        <div className="space-y-3 rounded-md border border-text/15 p-4">
          <p className="text-sm text-text-secondary">{t("contactFirstHint")}</p>
          <Button
            variant="secondary"
            loading={busy === "contact_first"}
            loadingLabel={t("working")}
            disabled={busy !== null}
            onClick={() => void decide("contact_first", t("contacted"))}
          >
            {t("contactFirst")}
          </Button>
        </div>
      )}
      {noticeLine}
    </div>
  );
}
