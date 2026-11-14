"use client";

import { useReverification, useUser } from "@clerk/nextjs";
import { isClerkAPIResponseError, isReverificationCancelledError } from "@clerk/nextjs/errors";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button, Card, Checkbox, TextField } from "@/components/ui";
import { NoticeLine, type Notice } from "./notice";

/** Clerk's minimum, set on the instance (§6.16). */
export const MIN_PASSWORD_LENGTH = 12;

type Key = "incorrect" | "pwned" | "weak" | "tooShort" | "failed";

/** Clerk's error codes for a password change, as our message keys. */
export function passwordErrorKey(error: unknown): Key {
  if (!isClerkAPIResponseError(error)) return "failed";
  const code = error.errors[0]?.code ?? "";
  if (code === "form_password_incorrect") return "incorrect";
  if (code === "form_password_pwned") return "pwned";
  if (code === "form_password_length_too_short") return "tooShort";
  if (code.startsWith("form_password")) return "weak";
  return "failed";
}

/**
 * Changes the password through Clerk's own flow: `user.updatePassword`, with
 * Clerk's reverification step when the session needs it. Our server never
 * sees a password.
 */
export function PasswordForm() {
  const t = useTranslations("AccountProfile.password");
  const { user } = useUser();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [errors, setErrors] = useState<{ next?: string; repeat?: string }>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const change = useReverification(
    (params: { currentPassword: string; newPassword: string; signOutOfOtherSessions: boolean }) =>
      user ? user.updatePassword(params) : Promise.reject(new Error("no user")),
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const found = {
      next: next.length < MIN_PASSWORD_LENGTH ? t("tooShort") : undefined,
      repeat: next !== repeat ? t("mismatch") : undefined,
    };
    setErrors(found);
    if (found.next || found.repeat) return;

    setBusy(true);
    try {
      await change({ currentPassword: current, newPassword: next, signOutOfOtherSessions: signOutOthers });
      setCurrent("");
      setNext("");
      setRepeat("");
      setNotice({ ok: true, text: t("saved") });
    } catch (error) {
      // Closing Clerk's reverification step isn't a failure to report.
      if (!isReverificationCancelledError(error)) {
        setNotice({ ok: false, text: t(passwordErrorKey(error)) });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" aria-labelledby="password-title" className="space-y-4">
      <div>
        <h2 id="password-title" className="text-xl">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">{t("intro")}</p>
      </div>
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        {/* Same grid as the two fields below, so the current password lines up with them. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t("current")}
            type="password"
            dir="ltr"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t("new")}
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            error={errors.next}
            required
          />
          <TextField
            label={t("confirm")}
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
            error={errors.repeat}
            required
          />
        </div>
        <Checkbox
          label={t("signOutOthers")}
          checked={signOutOthers}
          onChange={(event) => setSignOutOthers(event.target.checked)}
        />
        <Button type="submit" loading={busy} loadingLabel={t("saving")} disabled={!user}>
          {t("save")}
        </Button>
        <NoticeLine notice={notice} />
      </form>
    </Card>
  );
}
