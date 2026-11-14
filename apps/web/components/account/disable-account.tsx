"use client";

import { useClerk } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Card, Checkbox } from "@/components/ui";
import { NoticeLine, type Notice } from "./notice";
import { disableOwnAccount } from "./send";

/**
 * "Disable my account" in two steps: open the confirm, then tick that only the
 * site's admin can reactivate it, then confirm. The server bans the account,
 * which ends every session; this page then signs out here too.
 */
export function DisableAccount() {
  const t = useTranslations("AccountProfile.disable");
  const locale = useLocale();
  const { signOut } = useClerk();
  const [step, setStep] = useState<"closed" | "confirm">("closed");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  function cancel() {
    setStep("closed");
    setUnderstood(false);
  }

  async function confirm() {
    setBusy(true);
    setNotice(null);
    const result = await disableOwnAccount();
    if (!result.ok) {
      setBusy(false);
      setNotice({ ok: false, text: result.message ?? t("failed") });
      return;
    }
    await signOut({ redirectUrl: `/${locale}` });
  }

  return (
    <Card as="section" aria-labelledby="disable-title" className="space-y-3 border-danger/40">
      <h2 id="disable-title" className="text-xl">
        {t("title")}
      </h2>
      <p className="max-w-prose text-text-secondary">{t("intro")}</p>
      <p className="max-w-prose font-semibold">{t("adminOnly")}</p>
      {step === "closed" ? (
        <Button variant="secondary" onClick={() => setStep("confirm")}>
          {t("start")}
        </Button>
      ) : (
        <div role="group" aria-labelledby="disable-confirm" className="space-y-3 rounded-md border border-danger p-3">
          <p id="disable-confirm" className="font-semibold">
            {t("confirmTitle")}
          </p>
          <Checkbox
            label={t("understand")}
            checked={understood}
            onChange={(event) => setUnderstood(event.target.checked)}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={!understood} loading={busy} loadingLabel={t("working")} onClick={confirm}>
              {t("confirm")}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={cancel}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
      <NoticeLine notice={notice} />
    </Card>
  );
}
