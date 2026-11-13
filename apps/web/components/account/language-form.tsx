"use client";

import { LOCALES, type Locale } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button, Card, Select } from "@/components/ui";
import { getPathname, usePathname } from "@/i18n/navigation";
import { NoticeLine, type Notice } from "./notice";
import { saveProfile } from "./send";

/**
 * The preferred language: saved to the profile (emails use it), then the page
 * loads again in it.
 */
export function LanguageForm({ saved }: { saved: Locale }) {
  const t = useTranslations("AccountProfile.language");
  const pathname = usePathname();
  const [value, setValue] = useState<Locale>(saved);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setBusy(true);
    const result = value === saved ? { ok: true as const } : await saveProfile({ locale: value });
    setBusy(false);
    if (!result.ok) {
      setNotice({ ok: false, text: result.message ?? t("failed") });
      return;
    }
    // A full load, not a client navigation: the language is a root param, and
    // a soft navigation left the old language's page in the document too.
    // Clerk's components also pick their language up on load.
    window.location.assign(getPathname({ href: pathname, locale: value }));
  }

  return (
    <Card as="section" aria-labelledby="language-title" className="space-y-4">
      <div>
        <h2 id="language-title" className="text-xl">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">{t("intro")}</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <Select
          label={t("label")}
          value={value}
          onChange={(event) => setValue(event.target.value as Locale)}
          className="min-w-0 flex-1 basis-48"
        >
          {LOCALES.map((locale) => (
            // Each language is named in itself, as language switches do.
            <option key={locale} value={locale} lang={locale}>
              {t(locale)}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" loading={busy} loadingLabel={t("save")}>
          {t("save")}
        </Button>
      </form>
      <NoticeLine notice={notice} />
    </Card>
  );
}
