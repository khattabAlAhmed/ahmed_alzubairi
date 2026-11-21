import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE, ORG_TYPES, type Locale } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { InlineNotice } from "@/components/account/notice";
import { CalendarIcon, CheckIcon, CloseIcon, LockIcon, MailIcon } from "@/components/icons";
import { Button, Checkbox, FieldError, FieldHint, FileInput, Radio, Select, TextArea, TextField } from "@/components/ui";
import { cx, INLINE_LINK } from "@/components/ui/cx";
import { allowedTypeNames, formatBytes } from "@/components/workspace/format";
import { StatusPill } from "@/components/workspace/status-pill";
import { DsBlock, DsNote, DsSection } from "../parts";
import { DemoFileChip, DemoLoadingButton } from "./primitives-client";

/*
 * components.md group 6: every form and flow in the states its board shows.
 * These are still pictures built from the same primitives as the live forms:
 * no <form>, every button `type="button"`, nothing is sent. The labels come
 * from each form's own namespace; only sample values and state names are in
 * DesignSystemForms.
 */

type Props = { locale: Locale };
type T = Awaited<ReturnType<typeof getTranslations<"DesignSystemForms">>>;

export async function FormsSection({ locale }: Props) {
  const ds = await getTranslations({ locale, namespace: "DesignSystem" });
  const t = await getTranslations({ locale, namespace: "DesignSystemForms" });
  // FileChip and StatusPill read their words on the client.
  const { Workspace } = await getMessages({ locale });

  return (
    <DsSection id="forms" title={ds("forms.title")} intro={t("intro")}>
      <DsNote>{t("staticNote")}</DsNote>
      <ContactBlock t={t} locale={locale} />
      <NewsletterBlock t={t} locale={locale} />
      <NextIntlClientProvider locale={locale} messages={{ Workspace }}>
        <ConsultationBlock t={t} locale={locale} />
      </NextIntlClientProvider>
      <DialogBlock t={t} locale={locale} />
      <TrainingBlock t={t} locale={locale} />
      <SignInBlock t={t} locale={locale} />
      <OnboardingBlock t={t} locale={locale} />
    </DsSection>
  );
}

/** A state with its name above it. */
function State({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-3", className)}>
      <p className="text-ink-2 type-caption">{label}</p>
      {children}
    </div>
  );
}

/** The sent state every public form shares: the raised ground, the success rule, no reply-time promise. */
function Sent({ title, text, action }: { title: string; text: string; action?: string }) {
  return (
    <div role="status" className="flex flex-col gap-2 border-t-2 border-success bg-surface p-5">
      <p className="flex items-center gap-2 font-medium text-success type-small">
        <CheckIcon aria-hidden="true" className="size-4" />
        {title}
      </p>
      <p className="text-pretty type-small">{text}</p>
      {action && (
        <Button type="button" variant="quiet" size="sm" className="self-start">
          {action}
        </Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- contact -- */

async function ContactBlock({ t, locale }: { t: T; locale: Locale }) {
  const c = await getTranslations({ locale, namespace: "Contact" });
  const fields = (errors: boolean, filled: boolean) => (
    <div className="grid gap-x-6 gap-y-5.5 border-t-2 border-rule pt-5.5 sm:grid-cols-2">
      {errors && <InlineNotice tone="danger" title={c("errors.validation_failed")} className="sm:col-span-2" />}
      <TextField label={c("name")} defaultValue={filled ? t("sample.name") : undefined} error={errors ? c("required") : undefined} />
      <TextField
        type="email"
        label={c("emailField")}
        dir="ltr"
        defaultValue={filled ? t("sample.email") : errors ? "salma@" : undefined}
        error={errors ? c("emailInvalid") : undefined}
      />
      <fieldset className="flex min-w-0 flex-col gap-2 sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">{c("orgType")}</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {ORG_TYPES.map((type, index) => (
            <Radio
              key={type}
              name={`ds-contact-${errors ? "e" : filled ? "f" : "x"}`}
              label={c(`orgTypes.${type}`)}
              defaultChecked={filled && index === 0}
            />
          ))}
        </div>
        {errors && <FieldError id="ds-contact-org-error">{c("orgTypeRequired")}</FieldError>}
      </fieldset>
      <TextField label={c("subject")} defaultValue={filled ? t("sample.subject") : undefined} className="sm:col-span-2" />
      <TextArea label={c("message")} rows={4} defaultValue={filled ? t("sample.message") : undefined} className="sm:col-span-2" />
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        <p className="text-[13px] text-ink-2">{c("noAccount")}</p>
        {filled ? <DemoLoadingButton variant="primary" label={c("sending")} /> : <Button type="button">{c("send")}</Button>}
      </div>
    </div>
  );
  return (
    <DsBlock title={t("contact.title")} intro={t("contact.intro")}>
      <div className="grid gap-10 lg:grid-cols-2">
        <State label={t("states.errors")}>{fields(true, false)}</State>
        <div className="flex flex-col gap-10">
          <State label={t("states.sending")}>{fields(false, true)}</State>
          <State label={t("states.sent")}>
            <Sent title={c("sentTitle")} text={c("sentText")} action={c("sendAnother")} />
          </State>
        </div>
      </div>
    </DsBlock>
  );
}

/* ----------------------------------------------------------- newsletter -- */

async function NewsletterBlock({ t, locale }: { t: T; locale: Locale }) {
  const n = await getTranslations({ locale, namespace: "Newsletter" });
  const field = (compact: boolean, error?: string) => (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start">
      <TextField
        type="email"
        dir="ltr"
        label={n("email")}
        placeholder="name@example.org"
        error={error}
        className={compact ? "[&>label]:sr-only" : undefined}
      />
      <Button type="button" variant={compact ? "secondary" : "primary"} className={compact ? undefined : "mt-8"}>
        {n("subscribe")}
      </Button>
    </div>
  );
  return (
    <DsBlock title={t("newsletter.title")} intro={t("newsletter.intro")}>
      <div className="flex flex-col gap-8">
        <State label={t("states.home")}>
          <div className="grid items-end gap-6 border-y border-line border-t-2 border-t-rule py-6 md:grid-cols-12 md:gap-8">
            <div className="flex flex-col gap-1.5 md:col-span-5">
              <p className="type-h2">{n("title")}</p>
              <p className="text-ink-2 type-small">{n("intro")}</p>
            </div>
            <div className="md:col-span-6 md:col-start-7">{field(false)}</div>
          </div>
        </State>
        <div className="grid gap-8 md:grid-cols-3">
          <State label={t("states.inline")}>
            <div className="flex flex-col gap-2 bg-surface p-4.5">
              <p className="font-medium type-small">{n("title")}</p>
              <p className="text-ink-2 type-small">{n("intro")}</p>
              {field(true)}
            </div>
          </State>
          <State label={`${t("states.footer")} · ${t("states.errors")}`}>
            <div className="flex flex-col gap-2">
              <p className="text-base font-medium">{n("title")}</p>
              <p className="text-ink-2 type-small">{n("intro")}</p>
              {field(false, n("emailInvalid"))}
            </div>
          </State>
          <State label={t("states.sent")}>
            <p role="status" className="flex items-start gap-2 border-t-2 border-success pt-4 text-pretty type-small">
              <CheckIcon aria-hidden="true" className="mt-1.5 size-3.5 shrink-0 text-success" />
              <span>{n("done")}</span>
            </p>
          </State>
        </div>
      </div>
    </DsBlock>
  );
}

/* --------------------------------------------------------- consultation -- */

async function ConsultationBlock({ t, locale }: { t: T; locale: Locale }) {
  const f = await getTranslations({ locale, namespace: "AccountConsultations.form" });
  const d = await getTranslations({ locale, namespace: "AccountConsultations.detail" });
  const files = t.raw("sample.files") as string[];
  const pdf = "application/pdf";
  return (
    <DsBlock title={t("consultation.title")} intro={t("consultation.intro")}>
      <div className="grid gap-10 lg:grid-cols-[8fr_4fr] lg:gap-12">
        <State label={t("states.selected")}>
          <div className="flex flex-col gap-5.5 border-t-2 border-rule pt-5.5">
            <div className="grid gap-x-6 gap-y-5.5 sm:grid-cols-2">
              <Select label={f("service")} defaultValue="governance">
                <option value="">{f("servicePlaceholder")}</option>
                <option value="governance">{t("sample.service")}</option>
              </Select>
              <TextField label={f("organization")} defaultValue={t("sample.org")} />
            </div>
            <TextField label={f("consultationTitle")} hint={f("titleHint")} defaultValue={t("sample.consultationTitle")} />
            <TextArea label={f("description")} hint={f("descriptionHint")} error={f("descriptionRequired")} rows={4} />
            <FileInput
              label={f("attachments")}
              prompt={f("dropPrompt")}
              browse={f("dropBrowse")}
              dropHere={f("dropHere")}
              types={allowedTypeNames().join(" · ")}
              limits={f("dropLimits", { size: formatBytes(MAX_ATTACHMENT_BYTES, locale), count: MAX_ATTACHMENTS_PER_MESSAGE })}
            >
              <ul className="grid gap-2 sm:grid-cols-2">
                <li className="min-w-0">
                  <DemoFileChip file={{ id: "a", name: files[0], sizeBytes: 2_400_000, mime: pdf, state: "uploading", progress: 40 }} />
                </li>
                <li className="min-w-0">
                  <DemoFileChip
                    file={{
                      id: "b",
                      name: files[1],
                      sizeBytes: 86_000,
                      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                      state: "ready",
                    }}
                  />
                </li>
                <li className="min-w-0">
                  <DemoFileChip file={{ id: "c", name: files[2], sizeBytes: 1_200_000, mime: "image/heic", state: "refused", reason: "wrongType" }} />
                </li>
              </ul>
            </FileInput>
            <div className="flex justify-end">
              <Button type="button">{f("submit")}</Button>
            </div>
          </div>
        </State>
        <State label={t("states.filed")}>
          <div className="border-t-2 border-rule">
            <div className="flex items-center justify-between gap-4 border-b border-line py-2.5 text-[13px] text-ink-2">
              <StatusPill kind="consultation" status="new" />
              <span>{t("sample.filedWhen")}</span>
            </div>
            <p className="py-3.5 type-h3">{t("sample.consultationTitle")}</p>
            <dl>
              {[
                [d("service"), t("sample.service")],
                [f("attachments"), t("sample.attachments")],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[80px_minmax(0,1fr)] gap-4 border-b border-line py-3">
                  <dt className="text-sm text-ink-2">{label}</dt>
                  <dd className="type-small">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </State>
      </div>
    </DsBlock>
  );
}

/* --------------------------------------------------------------- dialog -- */

async function DialogBlock({ t, locale }: { t: T; locale: Locale }) {
  const r = await getTranslations({ locale, namespace: "DocumentRequestDialog" });
  const documents = t.raw("sample.documents") as string[];
  const frame = (count: number, sent: boolean) => (
    // The dialog as it looks open, on its scrim; a picture, not a modal.
    <div className="bg-scrim p-4 sm:p-8">
      <div className="mx-auto w-full max-w-[32.5rem] border-t-2 border-rule bg-bg text-ink shadow-overlay">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <p className="type-h3">{sent ? r("done") : r("title")}</p>
          {!sent && (
            <span aria-hidden="true" className="inline-flex size-11 items-center justify-center text-ink-2">
              <CloseIcon className="size-5" />
            </span>
          )}
        </div>
        <div className="flex flex-col gap-4.5 p-5">
          {sent ? (
            <p className="flex items-start gap-2 text-pretty type-small">
              <CheckIcon aria-hidden="true" className="mt-1.5 size-3.5 shrink-0 text-success" />
              {r("doneText")}
            </p>
          ) : (
            <>
              <p className="text-pretty text-ink-2 type-small">{r("intro", { count })}</p>
              <ul className="border-t border-line">
                {documents.slice(0, count).map((title) => (
                  <li key={title} className="flex items-center gap-2.5 border-b border-line py-2 text-[15px]">
                    <LockIcon aria-hidden="true" className="size-4.5 shrink-0 text-ink-2" />
                    {title}
                  </li>
                ))}
              </ul>
              <TextArea label={r("purpose")} hint={r("purposeHint")} rows={3} defaultValue={count > 1 ? t("sample.purpose") : undefined} />
            </>
          )}
        </div>
        <div className="flex flex-wrap-reverse justify-end gap-2.5 border-t border-line px-5 py-3.5">
          <Button type="button" variant="quiet">
            {sent ? r("close") : r("cancel")}
          </Button>
          <Button type="button">{sent ? r("myDocuments") : r("submit")}</Button>
        </div>
      </div>
    </div>
  );
  return (
    <DsBlock title={t("dialog.title")} intro={t("dialog.intro")}>
      <div className="grid gap-8 xl:grid-cols-3">
        <State label={t("states.one")}>{frame(1, false)}</State>
        <State label={t("states.several")}>{frame(2, false)}</State>
        <State label={t("states.sent")}>{frame(2, true)}</State>
      </div>
    </DsBlock>
  );
}

/* ------------------------------------------------------------- training -- */

async function TrainingBlock({ t, locale }: { t: T; locale: Locale }) {
  const c = await getTranslations({ locale, namespace: "Training.custom" });
  return (
    <DsBlock title={t("training.title")} intro={t("training.intro")}>
      <div className="grid gap-10 lg:grid-cols-[8fr_4fr]">
        <State label={t("states.errors")}>
          <div className="grid gap-x-6 gap-y-5.5 border-t-2 border-rule pt-5.5 sm:grid-cols-2">
            <TextField label={c("orgName")} defaultValue={t("sample.trainingOrg")} className="sm:col-span-2" />
            <TextField label={c("topic")} defaultValue={t("sample.topic")} className="sm:col-span-2" />
            <TextField type="number" dir="ltr" label={c("traineeCount")} defaultValue="0" error={c("countInvalid")} />
            <TextField type="date" label={c("suggestedDate")} error={c("dateInvalid")} />
            <TextField label={c("place")} hint={c("placeHint")} defaultValue={t("sample.place")} className="sm:col-span-2" />
            <TextField type="email" dir="ltr" label={c("contactEmail")} defaultValue={t("sample.email")} className="sm:col-span-2" />
            <div className="flex justify-end sm:col-span-2">
              <Button type="button">{c("send")}</Button>
            </div>
          </div>
        </State>
        <State label={t("states.sent")}>
          <Sent title={c("sentTitle")} text={c("sentText")} action={c("sendAnother")} />
        </State>
      </div>
    </DsBlock>
  );
}

/* -------------------------------------------------------------- sign in -- */

// The same words and icons as the live page (components/auth-forms.tsx).
const SIGN_IN_REASONS = [
  { key: "consultations", Icon: MailIcon },
  { key: "documents", Icon: LockIcon },
  { key: "courses", Icon: CalendarIcon },
] as const;

async function SignInBlock({ t, locale }: { t: T; locale: Locale }) {
  const r = await getTranslations({ locale, namespace: "AuthReason.signIn" });
  return (
    <DsBlock title={t("signIn.title")} intro={t("signIn.intro")}>
      <div className="grid items-start gap-10 lg:grid-cols-[5fr_6fr] lg:gap-16">
        <State label={t("states.signIn")}>
          {/* How Clerk's card looks through the appearance: the rule on top, hairline sides, square corners. */}
          <div className="flex flex-col gap-4.5 border border-t-2 border-line border-t-rule p-7">
            <p className="type-h2">{t("signIn.heading")}</p>
            <TextField type="email" label={t("signIn.email")} defaultValue={t("sample.email")} />
            <div className="flex flex-col gap-2">
              <TextField type="password" label={t("signIn.password")} defaultValue="example-password" error={t("signIn.passwordError")} />
              <a href="#forms" className={cx(INLINE_LINK, "self-end text-[13px]")}>
                {t("signIn.forgot")}
              </a>
            </div>
            <Button type="button" className="w-full">
              {t("signIn.submit")}
            </Button>
            <p className="text-center text-[13px] text-ink-2">
              {t("signIn.noAccount")}{" "}
              <a href="#forms" className={INLINE_LINK}>
                {t("signIn.create")}
              </a>
            </p>
          </div>
        </State>
        <State label={t("states.reason")}>
          <p className="max-w-[24em] font-medium type-h3">{r("reason")}</p>
          <ul className="border-t border-line">
            {SIGN_IN_REASONS.map(({ key, Icon }) => (
              <li key={key} className="flex items-start gap-2.5 border-b border-line py-2.5 type-small">
                <Icon aria-hidden="true" className="mt-1.5 size-3.5 shrink-0 text-ink-2" />
                {r(`reasons.${key}`)}
              </li>
            ))}
          </ul>
        </State>
      </div>
    </DsBlock>
  );
}

/* ----------------------------------------------------------- onboarding -- */

async function OnboardingBlock({ t, locale }: { t: T; locale: Locale }) {
  const o = await getTranslations({ locale, namespace: "Onboarding" });
  return (
    <DsBlock title={t("onboarding.title")} intro={t("onboarding.intro")}>
      <State label={t("states.consent")} className="max-w-[40rem]">
        <div className="flex flex-col gap-5 border-t-2 border-rule pt-5">
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2">
              <TextField type="tel" dir="ltr" label={o("phone")} defaultValue={t("sample.phone")} />
              <FieldHint id="ds-onboarding-phone-hint">
                {o.rich("phoneHint", { number: (chunks) => <bdi dir="ltr">{chunks}</bdi> })}
              </FieldHint>
            </div>
            <Select label={o("orgType")} mark={o("optional")} defaultValue="">
              <option value="">{o("orgTypeNone")}</option>
              {ORG_TYPES.map((type) => (
                <option key={type} value={type}>
                  {o(`orgTypes.${type}`)}
                </option>
              ))}
            </Select>
            <TextField label={o("orgName")} mark={o("optional")} />
            <TextField label={o("jobTitle")} mark={o("optional")} />
          </div>
          <Checkbox
            label={o.rich("terms", {
              privacy: (chunks) => (
                <a href="#forms" className={INLINE_LINK}>
                  {chunks}
                </a>
              ),
              terms: (chunks) => (
                <a href="#forms" className={INLINE_LINK}>
                  {chunks}
                </a>
              ),
            })}
            error={o("termsRequired")}
          />
          <div className="flex justify-end">
            <Button type="button">{o("submit")}</Button>
          </div>
        </div>
      </State>
    </DsBlock>
  );
}
