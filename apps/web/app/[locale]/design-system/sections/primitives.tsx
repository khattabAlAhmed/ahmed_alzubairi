import type { Locale } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ArrowForwardIcon } from "@/components/icons";
import { dateLocale, formatNumber } from "@/components/public/home/format";
import { FilterChips } from "@/components/public/listing/filter-chips";
import { Pagination } from "@/components/public/listing/pagination";
import { SearchField } from "@/components/public/listing/search-field";
import { MoreLink } from "@/components/public/parts";
import {
  Button,
  buttonClasses,
  Checkbox,
  DatedDivider,
  Divider,
  FileInput,
  LanguageTabs,
  Radio,
  Select,
  SkeletonImage,
  SkeletonListItem,
  SkeletonRecord,
  Switch,
  Tag,
  TextArea,
  TextField,
} from "@/components/ui";
import { cx, INLINE_LINK, NAV_LINK, TAB_LIST, tabClasses } from "@/components/ui/cx";
import { StatusPill } from "@/components/workspace/status-pill";
import { DsBlock, DsCode, DsNote, DsSection } from "../parts";
import { DemoFileChip, DemoLoadingButton } from "./primitives-client";

/*
 * components.md group 2. One DsBlock per primitive, every state its board
 * shows. States that need a pointer or a keyboard (hover, focus, pressed,
 * drag-over) are drawn here as still pictures; the live controls next to them
 * show the real thing.
 */

type Props = { locale: Locale };

/** The forced look of keyboard focus, for the still pictures. */
const SHOWN_FOCUS = "outline-2 outline-offset-3 outline-focus outline-solid";
const SHOWN_FOCUS_INPUT = "[&_input]:outline-2 [&_input]:outline-offset-3 [&_input]:outline-focus [&_input]:outline-solid";

export async function PrimitivesSection({ locale }: Props) {
  const ds = await getTranslations({ locale, namespace: "DesignSystem" });
  const t = await getTranslations({ locale, namespace: "DesignSystemPrimitives" });
  // StatusPill and FileChip read their labels on the client.
  const { Workspace } = await getMessages({ locale });

  return (
    <DsSection id="primitives" title={ds("primitives.title")} intro={t("intro")}>
      <ButtonBlock locale={locale} />
      <LinkBlock locale={locale} />
      <TagBlock locale={locale} />
      <NextIntlClientProvider locale={locale} messages={{ Workspace }}>
        <StatusBlock locale={locale} />
        <FieldsBlock locale={locale} />
        <ChoiceBlock locale={locale} />
        <FileBlock locale={locale} />
        <TabsBlock locale={locale} />
      </NextIntlClientProvider>
      <SearchBlock locale={locale} />
      <ChipsBlock locale={locale} />
      <PaginationBlock locale={locale} />
      <DividerBlock locale={locale} />
      <SkeletonBlock locale={locale} />
    </DsSection>
  );
}

/** A sample with its state named above it. */
function State({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-start gap-2", className)}>
      <DsCode>{label}</DsCode>
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- button -- */

async function ButtonBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemPrimitives" });
  const s = (key: "default" | "hover" | "focus" | "pressed" | "disabled" | "loading") => t(`states.${key}`);

  const rows = [
    {
      name: t("button.primary"),
      text: t("button.requestConsultation"),
      variant: "primary" as const,
      hover: "bg-ink! text-bg!",
      pressed: "bg-ink! text-bg!",
      loading: true,
    },
    {
      name: t("button.secondary"),
      text: t("button.seeExpertise"),
      variant: "secondary" as const,
      hover: "bg-surface-hover!",
      pressed: "bg-ink! text-bg!",
      loading: false,
    },
    { name: t("button.quiet"), text: t("button.readRecord"), variant: "quiet" as const, hover: "decoration-2!", pressed: "text-ink!", loading: false },
    { name: t("button.danger"), text: t("button.deleteChat"), variant: "danger" as const, hover: "bg-surface-hover!", pressed: "bg-danger! text-bg!", loading: false },
  ];

  return (
    <DsBlock title={t("button.title")}>
      <div className="flex flex-col gap-6">
        {rows.map((row) => (
          <div key={row.variant} className="grid gap-3 border-b border-line pb-6 md:grid-cols-[var(--label-col)_minmax(0,1fr)]">
            <p className="text-ink-2 type-small">{row.name}</p>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              <State label={s("default")}>
                <Button variant={row.variant}>{row.text}</Button>
              </State>
              <State label={s("hover")}>
                <span className={buttonClasses({ variant: row.variant, className: row.hover })}>{row.text}</span>
              </State>
              <State label={s("focus")}>
                <span className={buttonClasses({ variant: row.variant, className: SHOWN_FOCUS })}>{row.text}</span>
              </State>
              <State label={s("pressed")}>
                <span className={buttonClasses({ variant: row.variant, className: row.pressed })}>{row.text}</span>
              </State>
              <State label={s("disabled")}>
                <Button variant={row.variant} disabled>
                  {row.text}
                </Button>
              </State>
              {row.loading && (
                <State label={s("loading")}>
                  <DemoLoadingButton variant={row.variant} label={t("button.sending")} />
                </State>
              )}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-4">
          <Button size="sm">{t("button.requestConsultation")}</Button>
          <Button size="sm" variant="secondary">
            {t("button.seeExpertise")}
          </Button>
          <Button size="lg" icon={<ArrowForwardIcon className="size-4.5" />}>
            {t("button.requestConsultation")}
          </Button>
        </div>
      </div>
      <DsNote className="mt-4">
        {t("button.sizes")} {t("button.note")}
      </DsNote>
    </DsBlock>
  );
}

/* ----------------------------------------------------------------- link -- */

async function LinkBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemPrimitives" });
  return (
    <DsBlock title={t("link.title")}>
      <div className="grid gap-8 md:grid-cols-3">
        <div className="flex flex-col gap-3">
          <DsCode>{t("link.inline")}</DsCode>
          <p className="max-w-measure">
            {t("link.inlineBefore")}{" "}
            <a href="#primitives" className={INLINE_LINK}>
              {t("link.inlineLink")}
            </a>{" "}
            {t("link.inlineMiddle")}{" "}
            <a href="#primitives" className={cx(INLINE_LINK, "text-ink-2")}>
              {t("link.inlineVisited")}
            </a>{" "}
            {t("link.inlineAfter")}
          </p>
          <DsNote>{t("link.inlineNote")}</DsNote>
        </div>
        <div className="flex flex-col gap-3">
          <DsCode>{t("link.nav")}</DsCode>
          <div className="flex flex-wrap gap-6">
            <a href="#primitives" aria-current="page" className={NAV_LINK}>
              {t("link.home")}
            </a>
            <a href="#primitives" className={NAV_LINK}>
              {t("link.projects")}
            </a>
            <a href="#primitives" className={NAV_LINK}>
              {t("link.blog")}
            </a>
          </div>
          <DsNote>{t("link.navNote")}</DsNote>
        </div>
        <div className="flex flex-col items-start gap-3">
          <DsCode>{t("link.more")}</DsCode>
          <MoreLink href="/design-system" label={t("link.allProjects")} count={formatNumber(38, locale)} />
          <DsNote>{t("link.moreNote")}</DsNote>
        </div>
      </div>
    </DsBlock>
  );
}

/* ------------------------------------------------------------------ tag -- */

async function TagBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemPrimitives" });
  return (
    <DsBlock title={t("tag.title")}>
      <div className="flex flex-wrap items-center gap-3.5">
        <Tag>{t("tag.governance")}</Tag>
        <Tag>{t("tag.inPerson")}</Tag>
        <Tag tone="soon">{t("tag.soon")}</Tag>
        <Tag tone="draft">{t("tag.draft")}</Tag>
        <Tag tone="strong">{t("tag.published")}</Tag>
        <Tag tone="danger">{t("tag.needsAttention")}</Tag>
        <Tag>
          <span dir="ltr" className="font-mono">
            PDF
          </span>
        </Tag>
      </div>
      <DsNote className="mt-3.5">{t("tag.note")}</DsNote>
    </DsBlock>
  );
}

/* --------------------------------------------------------------- status -- */

const CONSULTATION = ["new", "in_review", "in_progress", "scheduled", "closed"] as const;
const DOCUMENT = ["pending_review", "in_contact", "granted", "expired", "revoked"] as const;

async function StatusBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemPrimitives" });
  const row = (children: ReactNode) => <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">{children}</div>;
  return (
    <DsBlock title={t("status.title")}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="type-small font-medium">{t("status.consultations")}</p>
          {row(
            CONSULTATION.map((status) => (
              <div key={status} className="flex flex-col items-start gap-1">
                <StatusPill kind="consultation" status={status} />
                <DsCode>{status}</DsCode>
              </div>
            )),
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="type-small font-medium">{t("status.documents")}</p>
          {row(
            DOCUMENT.map((status) => (
              <div key={status} className="flex flex-col items-start gap-1">
                <StatusPill kind="documentRequest" status={status} />
                <DsCode>{status}</DsCode>
              </div>
            )),
          )}
        </div>
      </div>
      <DsNote className="mt-4">{t("status.note")}</DsNote>
    </DsBlock>
  );
}

/* --------------------------------------------------------------- fields -- */

async function FieldsBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemPrimitives" });
  const f = (key: Parameters<typeof t>[0]) => t(key);
  return (
    <DsBlock title={t("fields.title")}>
      <div className="grid gap-x-8 gap-y-7 md:grid-cols-2 lg:grid-cols-3">
        <State label={t("states.default")} className="items-stretch">
          <TextField label={f("fields.fullName")} name="ds-name" placeholder={f("fields.fullNamePlaceholder")} />
        </State>
        <State label={t("states.focus")} className="items-stretch">
          <TextField
            label={f("fields.organization")}
            mark={f("fields.optional")}
            name="ds-org"
            defaultValue={f("fields.organizationValue")}
            className={cx(SHOWN_FOCUS_INPUT, "[&_input]:border-b-accent")}
          />
        </State>
        <State label={t("states.error")} className="items-stretch">
          <TextField
            label={f("fields.email")}
            name="ds-email"
            type="email"
            defaultValue={f("fields.emailValue")}
            error={f("fields.emailError")}
          />
        </State>
        <State label={t("states.default")} className="items-stretch">
          <Select label={f("fields.orgType")} name="ds-type" defaultValue="government">
            <option value="government">{f("fields.government")}</option>
            <option value="organization">{f("fields.organizationType")}</option>
            <option value="company">{f("fields.company")}</option>
            <option value="individual">{f("fields.individual")}</option>
          </Select>
        </State>
        <State label={t("states.disabled")} className="items-stretch">
          <TextField label={f("fields.phone")} name="ds-phone" type="tel" defaultValue={f("fields.phoneValue")} disabled />
        </State>
        <State label={t("states.filled")} className="items-stretch">
          <TextField label={f("fields.subject")} name="ds-subject" defaultValue={f("fields.subjectValue")} />
        </State>
        <TextArea
          label={f("fields.facing")}
          name="ds-facing"
          rows={4}
          defaultValue={f("fields.facingValue")}
          hint={f("fields.facingHint")}
          className="md:col-span-2 lg:col-span-3"
        />
      </div>
      <DsNote className="mt-4">{t("fields.ltrNote")}</DsNote>
    </DsBlock>
  );
}

/* --------------------------------------------------------------- choice -- */

async function ChoiceBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemPrimitives" });
  const consent = (
    <>
      {t("choice.consentBefore")}{" "}
      <a href="#primitives" className={INLINE_LINK}>
        {t("choice.terms")}
      </a>
      {t("choice.and")}
      <a href="#primitives" className={INLINE_LINK}>
        {t("choice.privacy")}
      </a>
      {t("choice.consentAfter")}
    </>
  );
  return (
    <DsBlock title={t("choice.title")}>
      <div className="grid gap-8 md:grid-cols-3">
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2 text-[15px] font-medium">{t("choice.checkboxes")}</legend>
          <Checkbox label={t("choice.governance")} name="ds-c1" defaultChecked />
          <Checkbox label={t("choice.humanitarian")} name="ds-c2" />
          <Checkbox label={t("choice.development")} name="ds-c3" disabled />
          <Checkbox label={t("states.focus")} name="ds-c4" defaultChecked className={SHOWN_FOCUS_INPUT} />
        </fieldset>
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2 text-[15px] font-medium">{t("choice.radios")}</legend>
          <Radio name="ds-org-type" label={t("fields.government")} defaultChecked />
          <Radio name="ds-org-type" label={t("fields.organizationType")} />
          <Radio name="ds-org-type" label={t("fields.company")} />
          <Radio name="ds-org-type" label={t("fields.individual")} disabled />
        </fieldset>
        <div className="flex flex-col gap-3.5">
          <p className="text-[15px] font-medium">{t("choice.switches")}</p>
          <Switch label={t("choice.everyReply")} defaultChecked />
          <Switch label={t("choice.dayBefore")} />
          <Divider />
          <Checkbox label={consent} name="ds-consent" />
          <Checkbox label={consent} name="ds-consent-error" error={t("choice.consentError")} />
        </div>
      </div>
    </DsBlock>
  );
}

/* ----------------------------------------------------------------- file -- */

async function FileBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemPrimitives" });
  const zone = {
    label: t("file.label"),
    mark: t("file.optional"),
    prompt: t("file.prompt"),
    browse: t("file.browse"),
    dropHere: t("file.dropHere"),
    types: t("file.types"),
    limits: t("file.limits"),
  };
  const pdf = "application/pdf";
  return (
    <DsBlock title={t("file.title")}>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <FileInput {...zone} />
          <State label={t("states.dragOver")} className="items-stretch">
            <FileInput {...zone} label={t("file.label")} over />
          </State>
        </div>
        <div className="flex flex-col gap-2.5">
          <DemoFileChip
            file={{ id: "a", name: t("file.names.draft"), sizeBytes: 2_516_582, mime: pdf, state: "uploading", progress: 64 }}
          />
          <DemoFileChip
            file={{
              id: "b",
              name: t("file.names.chart"),
              sizeBytes: 317_440,
              mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              state: "ready",
            }}
          />
          <DemoFileChip
            file={{ id: "c", name: t("file.names.slides"), sizeBytes: 5_400_000, mime: "application/zip", state: "refused", reason: "wrongType" }}
          />
          <DemoFileChip
            file={{ id: "d", name: t("file.names.photos"), sizeBytes: 1_200_000, mime: "image/png", state: "refused", reason: "failed" }}
            retryLabel={t("file.retry")}
          />
        </div>
      </div>
      <DsNote className="mt-4">{t("file.note")}</DsNote>
    </DsBlock>
  );
}

/* --------------------------------------------------------------- search -- */

async function SearchBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemPrimitives" });
  const term = t("search.term");
  const missing = t("search.noResultsTerm");
  return (
    <DsBlock title={t("search.title")}>
      <div className="flex flex-col gap-6">
        <SearchField pathname="/design-system" label={t("search.label")} />
        <SearchField
          pathname="/design-system"
          value={term}
          label={t("search.label")}
          clearLabel={t("search.clear")}
          status={t("search.results", { count: formatNumber(7, locale), term })}
        />
        <SearchField
          pathname="/design-system"
          value={missing}
          label={t("search.label")}
          status={
            <>
              {t("search.noResultsBefore", { term: missing })}{" "}
              <a href="#primitives" className={INLINE_LINK}>
                {t("search.browseAll")}
              </a>
              .
            </>
          }
        />
      </div>
    </DsBlock>
  );
}

/* ---------------------------------------------------------------- chips -- */

async function ChipsBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemPrimitives" });
  const n = (value: number) => formatNumber(value, locale);
  return (
    <DsBlock title={t("chips.title")}>
      <div className="flex flex-col gap-4.5">
        <FilterChips
          label={t("chips.area")}
          pathname="/design-system"
          param="area"
          query={{ area: "governance" }}
          options={[
            { value: "governance", label: t("chips.governance"), count: n(14) },
            { value: "humanitarian", label: t("chips.humanitarian"), count: n(17) },
            { value: "development", label: t("chips.development"), count: n(7) },
          ]}
        />
        <FilterChips
          label={t("chips.orgType")}
          pathname="/design-system"
          param="type"
          options={[
            { value: "government", label: t("chips.government"), count: n(9) },
            { value: "international", label: t("chips.international"), count: n(20) },
            { value: "local", label: t("chips.local"), count: n(6) },
            { value: "company", label: t("chips.company"), count: n(3) },
          ]}
        />
      </div>
      <DsNote className="mt-4">{t("chips.note")}</DsNote>
    </DsBlock>
  );
}

/* ----------------------------------------------------------------- tabs -- */

async function TabsBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemPrimitives" });
  const topics = ["consultations", "training", "documents", "account"] as const;
  return (
    <DsBlock title={t("tabs.title")}>
      <div className="flex flex-col gap-8">
        {/* A still picture of the tab row: the live, keyboard-driven tabs are LanguageTabs below. */}
        <div aria-hidden="true" className={TAB_LIST}>
          {topics.map((topic, i) => (
            <span key={topic} className={tabClasses(i === 0)}>
              {t(`tabs.${topic}`)}
            </span>
          ))}
        </div>
        <LanguageTabs
          label={t("tabs.language")}
          invalidLabel={t("tabs.hasErrors")}
          arabic={{
            label: t("tabs.arabic"),
            content: <TextField label={t("tabs.titleField")} name="ds-title-ar" defaultValue={t("tabs.titleAr")} />,
          }}
          english={{
            label: t("tabs.english"),
            invalid: true,
            content: <TextField label={t("tabs.titleField")} name="ds-title-en" error={t("tabs.titleError")} />,
          }}
        />
      </div>
      <DsNote className="mt-4">{t("tabs.note")}</DsNote>
    </DsBlock>
  );
}

/* ----------------------------------------------------------- pagination -- */

async function PaginationBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemPrimitives" });
  return (
    <DsBlock title={t("pagination.title")}>
      <div className="flex flex-col gap-6">
        <Pagination pathname="/design-system" page={5} totalPages={12} />
        <Pagination pathname="/design-system" page={1} totalPages={12} />
      </div>
      <DsNote className="mt-4">{t("pagination.note")}</DsNote>
    </DsBlock>
  );
}

/* -------------------------------------------------------------- divider -- */

async function DividerBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemPrimitives" });
  const month = new Intl.DateTimeFormat(dateLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date("2025-03-01"),
  );
  return (
    <DsBlock title={t("divider.title")}>
      <div className="flex flex-col gap-5.5">
        <div className="flex flex-col gap-1.5">
          <Divider variant="heavy" />
          <DsNote>{t("divider.heavy")}</DsNote>
        </div>
        <div className="flex flex-col gap-1.5">
          <Divider />
          <DsNote>{t("divider.hair")}</DsNote>
        </div>
        <div className="flex flex-col gap-1.5">
          <DatedDivider>{month}</DatedDivider>
          <DsNote>{t("divider.dated")}</DsNote>
        </div>
      </div>
    </DsBlock>
  );
}

/* ------------------------------------------------------------- skeleton -- */

async function SkeletonBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemPrimitives" });
  return (
    <DsBlock title={t("skeleton.title")}>
      <div aria-busy="true" className="grid gap-8 md:grid-cols-3">
        <span className="sr-only">{t("skeleton.loading")}</span>
        <SkeletonRecord />
        <div className="border-t border-line">
          <SkeletonListItem />
          <SkeletonListItem />
          <SkeletonListItem />
        </div>
        <SkeletonImage />
      </div>
      <DsNote className="mt-3.5">{t("skeleton.note")}</DsNote>
    </DsBlock>
  );
}
