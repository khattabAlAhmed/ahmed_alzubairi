import type { Locale } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { HisSentence } from "@/components/voice/his-sentence";
import { Letter, type LetterContent } from "@/components/voice/letter";
import { Signature } from "@/components/voice/signature";
import { WhyITookIt } from "@/components/voice/why-i-took-it";
import { DsBlock, DsCode, DsNote, DsSection, DsThemes } from "../parts";

/*
 * components.md group 4: the components that carry his voice. The letter's
 * copy is the placeholder in docs/design/letter-placeholder.md, read from
 * this section's messages; on the home page it comes from the `letter`
 * home section.
 */

type Props = { locale: Locale };

export async function VoiceSection({ locale }: Props) {
  const ds = await getTranslations({ locale, namespace: "DesignSystem" });
  const t = await getTranslations({ locale, namespace: "DesignSystemVoice" });

  return (
    <DsSection id="voice" title={ds("voice.title")} intro={t("intro")}>
      <LetterBlock locale={locale} />
      <SentenceBlock locale={locale} />
      <SignatureBlock locale={locale} />
      <WhyBlock locale={locale} />
    </DsSection>
  );
}

/* --------------------------------------------------------------- letter -- */

async function LetterBlock({ locale }: Props) {
  const ds = await getTranslations({ locale, namespace: "DesignSystem" });
  const t = await getTranslations({ locale, namespace: "DesignSystemVoice" });
  const base: LetterContent = {
    heading: t("letter.heading"),
    salutation: t("letter.salutation"),
    paragraphs: t.raw("letter.paragraphs") as string[],
    signOff: t("letter.signOff"),
    signatureUrl: null,
    signatureDarkUrl: null,
    isPlaceholder: true,
  };
  // The long sample is Arabic whatever the page language.
  const ar = await getTranslations({ locale: "ar", namespace: "DesignSystemVoice" });
  const meta = [
    { term: t("letter.written"), value: t("letter.writtenValue") },
    { term: t("letter.by"), value: t("letter.byValue") },
  ];

  return (
    <DsBlock title={t("letter.title")}>
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-2">
          <DsCode>{t("letter.placeholder")} · isPlaceholder</DsCode>
          <Letter
            content={base}
            meta={meta}
            photo={{ src: "/images/hands-notes.webp", alt: t("letter.photoAlt"), caption: t("letter.photoCaption") }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <DsCode>{t("letter.real")}</DsCode>
          <DsThemes labels={{ light: ds("light"), dark: ds("dark") }}>
            {(theme) => <Letter content={{ ...base, isPlaceholder: false }} theme={theme} />}
          </DsThemes>
        </div>
        <div lang="ar" dir="rtl" className="flex flex-col gap-2">
          <DsCode>{t("letter.longTitle")}</DsCode>
          <Letter
            content={{
              ...base,
              heading: ar("letter.heading"),
              salutation: ar("letter.salutation"),
              signOff: ar("letter.signOff"),
              paragraphs: [ar("letter.longParagraph"), ar("letter.longParagraph")],
            }}
          />
        </div>
      </div>
      <DsNote className="mt-4">{t("letter.note")}</DsNote>
    </DsBlock>
  );
}

/* ------------------------------------------------------------- sentence -- */

async function SentenceBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemVoice" });
  return (
    <DsBlock title={t("sentence.title")}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <DsCode>{t("sentence.between")}</DsCode>
          <HisSentence sentence={t("sentence.text")} />
        </div>
        <div className="flex flex-col gap-2">
          <DsCode>{t("sentence.inline")}</DsCode>
          <HisSentence variant="inline" sentence={t("sentence.inlineText")} />
        </div>
      </div>
      <DsNote className="mt-4">{t("sentence.note")}</DsNote>
    </DsBlock>
  );
}

/* ------------------------------------------------------------ signature -- */

async function SignatureBlock({ locale }: Props) {
  const ds = await getTranslations({ locale, namespace: "DesignSystem" });
  const t = await getTranslations({ locale, namespace: "DesignSystemVoice" });
  return (
    <DsBlock title={t("signature.title")}>
      <DsThemes labels={{ light: ds("light"), dark: ds("dark") }}>
        {(theme) => (
          <div className="flex flex-col gap-2.5">
            <Signature theme={theme} />
            <p className="text-[13px] text-ink-2">{theme === "light" ? t("signature.light") : t("signature.dark")}</p>
          </div>
        )}
      </DsThemes>
      <DsNote className="mt-3.5">{t("signature.note")}</DsNote>
    </DsBlock>
  );
}

/* ------------------------------------------------------------------ why -- */

async function WhyBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemVoice" });
  return (
    <DsBlock title={t("why.title")}>
      <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <p className="text-ink-2 type-small">{t("why.did")}</p>
          <p className="max-w-measure">{t("why.didText")}</p>
        </div>
        <WhyITookIt text={t("why.text")} />
      </div>
      <DsNote className="mt-4">{t("why.note")}</DsNote>
    </DsBlock>
  );
}
