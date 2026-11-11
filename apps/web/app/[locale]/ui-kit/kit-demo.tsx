"use client";

import { useLocale } from "next-intl";
import { useState, type ReactNode } from "react";
import { ArrowForwardIcon } from "@/components/icons";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  LanguageTabs,
  PageHeader,
  SectionHeading,
  Select,
  Skeleton,
  SkeletonText,
  TextArea,
  TextField,
} from "@/components/ui";
import { PANEL_TEXT, type KitText } from "./content";

function Block({ title, intro, children, aside }: { title: string; intro?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-5 border-t border-text/10 pt-8">
      <SectionHeading title={title} intro={intro} actions={aside} />
      {children}
    </section>
  );
}

/**
 * A panel's fields. The labels and the error are UI text, in the page's
 * language; the sample value is content, in the panel's.
 */
function PanelFields({ lang, showErrors }: { lang: "ar" | "en"; showErrors: boolean }) {
  const ui = PANEL_TEXT[useLocale() === "ar" ? "ar" : "en"];
  return (
    <>
      <TextField label={ui.title} name={`title_${lang}`} defaultValue={PANEL_TEXT[lang].titleValue} />
      <TextArea
        label={ui.summary}
        name={`summary_${lang}`}
        rows={3}
        error={showErrors && lang === "en" ? ui.summaryError : undefined}
      />
    </>
  );
}

export function KitDemo({ text: t }: { text: KitText }) {
  const [showErrors, setShowErrors] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={t.pageEyebrow}
        title={t.pageTitle}
        intro={t.pageIntro}
        actions={<Badge tone="neutral">{t.draft}</Badge>}
      />

      <Block title={t.buttons} intro={t.buttonsIntro}>
        <div className="flex flex-wrap items-center gap-3">
          <Button>{t.primary}</Button>
          <Button variant="secondary">{t.secondary}</Button>
          <Button variant="quiet">{t.quiet}</Button>
          <ButtonLink href="/" variant="secondary" icon={<ArrowForwardIcon />}>
            {t.link}
          </ButtonLink>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">{t.small}</Button>
          <Button size="md">{t.medium}</Button>
          <Button size="lg">{t.large}</Button>
          <Button disabled>{t.disabled}</Button>
          <Button variant="secondary" disabled>
            {t.disabled}
          </Button>
          <Button loading loadingLabel={t.loadingLabel}>
            {t.loading}
          </Button>
        </div>
      </Block>

      <Block title={t.cards} intro={t.cardsIntro}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card as="article">
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge tone="strong">{t.published}</Badge>
            </div>
            <h3 className="text-xl text-balance">{t.cardTitle}</h3>
            <p className="mt-2 text-text-secondary">{t.cardText}</p>
            <div className="mt-4">
              <ButtonLink href="/" size="sm" variant="quiet" icon={<ArrowForwardIcon />}>
                {t.link}
              </ButtonLink>
            </div>
          </Card>
          <Card as="section" compact>
            <SectionHeading level={3} title={t.cardTitle} intro={t.cardText} />
          </Card>
        </div>
      </Block>

      <Block title={t.badges}>
        <div className="flex flex-wrap gap-2">
          <Badge>{t.draft}</Badge>
          <Badge tone="strong">{t.published}</Badge>
          <Badge tone="danger">{t.attention}</Badge>
        </div>
      </Block>

      <Block
        title={t.forms}
        intro={t.formsIntro}
        aside={
          <Button variant="secondary" size="sm" aria-pressed={showErrors} onClick={() => setShowErrors((v) => !v)}>
            {t.showErrors}
          </Button>
        }
      >
        <form
          className="grid gap-5 md:grid-cols-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setLoading(true);
            setTimeout(() => setLoading(false), 2000);
          }}
        >
          <TextField label={t.name} name="name" placeholder={t.namePlaceholder} autoComplete="name" />
          <TextField
            label={t.email}
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            hint={t.emailHint}
            error={showErrors ? t.emailError : undefined}
          />
          <Select label={t.orgType} name="orgType" defaultValue="">
            <option value="" disabled>
              {t.orgChoose}
            </option>
            <option value="gov">{t.orgGov}</option>
            <option value="ngo">{t.orgNgo}</option>
            <option value="private">{t.orgPrivate}</option>
          </Select>
          <TextField label={t.readonly} name="ref" defaultValue="CR-2026-0147" disabled />
          <TextArea label={t.message} name="message" hint={t.messageHint} className="md:col-span-2" />
          <Checkbox
            label={t.terms}
            name="terms"
            className="md:col-span-2"
            error={showErrors ? t.termsError : undefined}
          />
          <div className="md:col-span-2">
            <Button type="submit" loading={loading} loadingLabel={t.loadingLabel}>
              {loading ? t.loading : t.submit}
            </Button>
          </div>
        </form>
      </Block>

      <Block title={t.tabs} intro={t.tabsIntro}>
        <LanguageTabs
          label={t.tabsLabel}
          invalidLabel={t.hasErrors}
          arabic={{ label: PANEL_TEXT.ar.label, content: <PanelFields lang="ar" showErrors={showErrors} /> }}
          english={{
            label: PANEL_TEXT.en.label,
            content: <PanelFields lang="en" showErrors={showErrors} />,
            invalid: showErrors,
          }}
        />
      </Block>

      <Block title={t.skeleton} intro={t.skeletonIntro}>
        <Card aria-busy="true">
          <span className="sr-only" role="status">
            {t.loadingStatus}
          </span>
          <Skeleton className="mb-4 h-6 w-1/2" />
          <SkeletonText lines={3} />
        </Card>
      </Block>
    </div>
  );
}
