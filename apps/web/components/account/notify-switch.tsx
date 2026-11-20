"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Card } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { SWITCH_TRACK } from "@/components/ui/form-field";
import { NoticeLine, type Notice } from "./notice";
import { saveProfile } from "./send";

/**
 * One switch bound to `notifyOptional`. It covers meeting reminders and course
 * registration confirmations (the owner's decision of 2026-11-11); everything
 * else always reaches the user.
 */
export function NotifySwitch({ saved }: { saved: boolean }) {
  const t = useTranslations("AccountProfile.notifications");
  const id = useId();
  const [on, setOn] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function toggle() {
    const next = !on;
    setBusy(true);
    setNotice(null);
    const result = await saveProfile({ notifyOptional: next });
    setBusy(false);
    if (!result.ok) {
      setNotice({ ok: false, text: result.message ?? t("failed") });
      return;
    }
    setOn(next);
    setNotice({ ok: true, text: next ? t("savedOn") : t("savedOff") });
  }

  return (
    <Card as="section" aria-labelledby={`${id}-title`} className="space-y-3">
      <h2 id={`${id}-title`} className="text-xl">
        {t("title")}
      </h2>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p id={`${id}-label`} className="text-[15px] font-medium">
            {t("label")}
          </p>
          <p id={`${id}-covers`} className="mt-1 text-[13px] leading-[1.7] text-ink-2">
            {t("covers")}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-covers`}
          disabled={busy}
          onClick={toggle}
          className={cx(SWITCH_TRACK, "mt-1")}
        >
          <span className="sr-only">{on ? t("on") : t("off")}</span>
        </button>
      </div>
      <p className="text-sm text-text-secondary">{t("always")}</p>
      <NoticeLine notice={notice} />
    </Card>
  );
}
