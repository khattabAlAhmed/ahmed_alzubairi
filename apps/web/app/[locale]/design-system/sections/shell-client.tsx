"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { AuthLink } from "@/components/auth-link";
import { ConsentBanner } from "@/components/consent-banner";
import { LanguageSwitch, UntranslatedSwitch } from "@/components/language-switch";
import { MenuPanel } from "@/components/mobile-menu";
import { QuickContact } from "@/components/quick-contact";
import { ThemeChoiceSwitch, ThemeSwitch } from "@/components/theme-switch";
import { Button } from "@/components/ui";
import { DsCode } from "../parts";

/*
 * The shell's interactive parts in place on the design-system page: each one
 * open, as its board shows it, and still working. Nothing here changes the
 * real page's consent or theme beyond what the controls themselves do.
 */

/** The phone menu, open, at phone width. */
export function MenuSample() {
  return (
    <div className="flex w-full max-w-[375px] flex-col border border-line bg-bg shadow-overlay">
      <MenuPanel onClose={() => {}} extra={<AuthLink className="w-full" />} />
    </div>
  );
}

/** The header's language and theme controls, the menu's long ones, the three-way theme, and a page with no translation. */
export function LanguageAndThemeSample() {
  const t = useTranslations("DesignSystemShell.language");
  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col items-start gap-2">
        <DsCode>{t("header")}</DsCode>
        <div className="flex items-center gap-1">
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
      </div>
      <div className="flex flex-col items-start gap-2">
        <DsCode>{t("menu")}</DsCode>
        <div className="grid w-full grid-cols-2 border-y border-line [&>*]:min-h-13 [&>*]:w-full [&>*+*]:border-s [&>*+*]:border-line">
          <LanguageSwitch long />
          <ThemeSwitch withText />
        </div>
      </div>
      <div className="flex flex-col items-start gap-2">
        <DsCode>{t("choice")}</DsCode>
        <ThemeChoiceSwitch />
      </div>
      {/* Tall enough for the open note under the switch. */}
      <div className="flex min-h-56 flex-col items-start gap-2">
        <DsCode>{t("untranslated")}</DsCode>
        <UntranslatedSwitch href="/blog" initiallyOpen />
      </div>
    </div>
  );
}

/** The quick-contact panel, open, with sample channels. */
export function QuickContactSample() {
  const t = useTranslations("DesignSystemShell.quick");
  return (
    <QuickContact
      sample
      whatsapp={{ number: t("sampleWhatsapp"), href: "https://wa.me/967770000000" }}
      email={t("sampleEmail")}
    />
  );
}

/** The privacy bar in place. Choosing shows what was chosen; nothing is saved. */
export function ConsentSample() {
  const t = useTranslations("DesignSystemShell.skip");
  const [choice, setChoice] = useState<"accepted" | "declined" | null>(null);
  if (choice) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <p className="type-small">{t("chosen", { choice: t(choice) })}</p>
        <Button variant="secondary" size="sm" onClick={() => setChoice(null)}>
          {t("again")}
        </Button>
      </div>
    );
  }
  return (
    <ConsentBanner
      open
      sample
      onAccept={() => setChoice("accepted")}
      onDecline={() => setChoice("declined")}
      privacyHref="/privacy"
    />
  );
}
