"use client";

import { DOCUMENT_RECOMMENDATIONS, MAX_LONG_TEXT_LENGTH, type DocumentRecommendation } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { Button, FieldError, TextArea } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { useRouter } from "@/i18n/navigation";
import { sendRecommendation } from "./send";

/**
 * A team member's advice on an open request (§6.18 step 3): موافقة or تحتاج
 * توضيح, with an optional note. It doesn't decide anything. The route checks
 * `document_requests.recommend`.
 */
export function RecommendForm({ requestId }: { requestId: string }) {
  const t = useTranslations("DashboardDocumentRequests");
  const router = useRouter();
  const groupId = useId();
  const [choice, setChoice] = useState<DocumentRecommendation | null>(null);
  const [note, setNote] = useState("");
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!choice) {
      setMissing(true);
      return;
    }
    setBusy(true);
    setNotice(null);
    const trimmed = note.trim();
    const result = await sendRecommendation(requestId, {
      recommendation: choice,
      ...(trimmed ? { note: trimmed } : {}),
    });
    setBusy(false);
    if (!result.ok) {
      setNotice({ ok: false, text: result.message ?? t("recommend.failed") });
      return;
    }
    setChoice(null);
    setNote("");
    setNotice({ ok: true, text: t("recommend.done") });
    router.refresh();
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      {/* Locked while sending, so a change made meanwhile isn't cleared on success. */}
      <fieldset
        disabled={busy}
        aria-describedby={missing ? `${groupId}-error` : undefined}
        aria-invalid={missing ? true : undefined}
      >
        <legend className="mb-2 font-semibold">{t("recommend.choice")}</legend>
        <div className="flex flex-wrap gap-2">
          {DOCUMENT_RECOMMENDATIONS.map((value) => (
            <label
              key={value}
              className={cx(
                "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3",
                choice === value ? "border-text bg-text/10" : "border-text/40",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-ring",
              )}
            >
              <input
                type="radio"
                name={`${groupId}-recommendation`}
                value={value}
                checked={choice === value}
                onChange={() => {
                  setChoice(value);
                  setMissing(false);
                }}
                className="size-4 accent-current"
              />
              {t(`recommendation.${value}`)}
            </label>
          ))}
        </div>
        {missing && <FieldError id={`${groupId}-error`}>{t("recommend.choose")}</FieldError>}
      </fieldset>
      <TextArea
        label={t("recommend.note")}
        hint={t("recommend.noteHint")}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        maxLength={MAX_LONG_TEXT_LENGTH}
        disabled={busy}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" loading={busy} loadingLabel={t("recommend.saving")}>
          {t("recommend.submit")}
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
    </form>
  );
}
