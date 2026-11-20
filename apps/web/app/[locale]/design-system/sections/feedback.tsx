import type { Locale } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { InlineNotice, NoticeLine } from "@/components/account/notice";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton, type ListSkeletonKind } from "@/components/feedback/list-skeletons";
import { NotFoundContent } from "@/components/not-found-content";
import { ButtonLink, TextField } from "@/components/ui";
import { ArrowForwardIcon } from "@/components/icons";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import { DsBlock, DsCode, DsNote, DsSection } from "../parts";
import {
  DemoButton,
  DemoCloseButton,
  DemoConfirmTwice,
  DemoDialog,
  DemoFormDialog,
} from "./feedback-client";

/*
 * components.md group 7: what shows when there's nothing yet, when it's slow,
 * or when it fails. The dialogs open for real from the buttons; the still
 * pictures next to them show both looks at once, as on the Dialog board.
 */

type Props = { locale: Locale };

export async function FeedbackSection({ locale }: Props) {
  const ds = await getTranslations({ locale, namespace: "DesignSystem" });
  const t = await getTranslations({ locale, namespace: "DesignSystemFeedback" });
  // ConfirmTwice reads its labels on the client.
  const { Workspace } = await getMessages({ locale });

  return (
    <DsSection id="feedback" title={ds("feedback.title")} intro={t("intro")}>
      <EmptyBlock locale={locale} />
      <ErrorBlock locale={locale} />
      <NoticeBlock locale={locale} />
      <NextIntlClientProvider locale={locale} messages={{ Workspace }}>
        <DialogBlock locale={locale} />
      </NextIntlClientProvider>
      <ListsBlock locale={locale} />
      <NotFoundBlock locale={locale} />
    </DsSection>
  );
}

function Labeled({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-2", className)}>
      <DsCode>{label}</DsCode>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- empty -- */

async function EmptyBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemFeedback" });
  return (
    <DsBlock title={t("empty.title")}>
      <div className="grid gap-8 md:grid-cols-3">
        <EmptyState
          level={3}
          title={t("empty.englishTitle")}
          text={t("empty.englishText")}
          action={
            // Always the Arabic blog, whatever the page language.
            <Link
              href="/blog"
              locale="ar"
              hrefLang="ar"
              className="inline-flex items-center gap-2 border-b border-current py-1 text-[15px] text-accent transition-state hover:text-ink focus-ring"
            >
              {t("empty.englishAction")}
              <ArrowForwardIcon aria-hidden="true" className="size-4" />
            </Link>
          }
        />
        <EmptyState
          level={3}
          title={t("empty.filterTitle")}
          text={t("empty.filterText")}
          action={<DemoButton label={t("empty.filterAction")} />}
        />
        <EmptyState
          level={3}
          title={t("empty.consultTitle")}
          text={t("empty.consultText")}
          action={
            <ButtonLink href="/design-system" size="sm">
              {t("empty.consultAction")}
            </ButtonLink>
          }
        />
      </div>
      <DsNote className="mt-3.5">{t("empty.note")}</DsNote>
    </DsBlock>
  );
}

/* ---------------------------------------------------------------- error -- */

async function ErrorBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemFeedback" });
  return (
    <DsBlock title={t("error.title")}>
      <div className="grid items-start gap-8 lg:grid-cols-[3fr_5fr_4fr]">
        <Labeled label={t("error.field")}>
          <TextField
            label={t("error.phone")}
            name="ds-error-phone"
            type="tel"
            defaultValue={t("error.phoneValue")}
            error={t("error.phoneError")}
          />
        </Labeled>
        <Labeled label={t("error.section")}>
          <ErrorState
            size="section"
            title={t("error.sectionTitle")}
            text={t("error.sectionText")}
            action={<DemoButton label={t("error.retry")} />}
          />
        </Labeled>
        <Labeled label={t("error.page")}>
          <ErrorState
            size="page"
            // Inside a DsBlock (h3), so the example's title sits under it.
            level={4}
            title={t("error.pageTitle")}
            text={t("error.pageText")}
            reference={t("error.reference")}
            action={
              <>
                <DemoButton label={t("error.reload")} variant="primary" />
                <ButtonLink href="/" variant="quiet" size="sm">
                  {t("error.home")}
                </ButtonLink>
              </>
            }
          />
        </Labeled>
      </div>
    </DsBlock>
  );
}

/* --------------------------------------------------------------- notice -- */

async function NoticeBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemFeedback" });
  return (
    <DsBlock title={t("notice.title")}>
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
        <InlineNotice
          tone="success"
          title={t("notice.successTitle")}
          text={t("notice.successText")}
          action={<DemoCloseButton label={t("notice.close")} />}
        />
        <InlineNotice tone="info" title={t("notice.infoTitle")} text={t("notice.infoText")} />
        <InlineNotice tone="warning" title={t("notice.warningTitle")} text={t("notice.warningText")} />
        <InlineNotice
          tone="danger"
          title={t("notice.dangerTitle")}
          text={t("notice.dangerText")}
          action={<DemoButton label={t("notice.resend")} variant="quiet" />}
        />
      </div>
      <div className="mt-6 flex flex-col gap-2">
        <NoticeLine notice={{ ok: true, text: t("notice.lineSuccess") }} />
        <NoticeLine notice={{ ok: false, text: t("notice.lineError") }} />
      </div>
      <DsNote className="mt-4">{t("notice.note")}</DsNote>
    </DsBlock>
  );
}

/* --------------------------------------------------------------- dialog -- */

async function DialogBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemFeedback" });
  const close = {
    open: t("dialog.open"),
    title: t("dialog.closeTitle"),
    text: t("dialog.closeText"),
    cancel: t("dialog.back"),
    confirm: t("dialog.closeConfirm"),
  };
  const form = {
    open: t("dialog.openForm"),
    title: t("dialog.formTitle"),
    text: t("dialog.formText"),
    cancel: t("dialog.back"),
    confirm: t("dialog.send"),
  };
  // A still picture: the panel the Dialog draws, without the modal.
  const still = (tone: "default" | "danger", children: ReactNode, footer: ReactNode) => (
    <div
      aria-hidden="true"
      className={cx("relative border-t-2 bg-bg text-ink shadow-overlay", tone === "danger" ? "border-danger" : "border-rule")}
    >
      <div className="flex flex-col gap-3 p-5">{children}</div>
      <div className="flex flex-wrap-reverse justify-end gap-2.5 border-t border-line px-5 py-3.5">{footer}</div>
    </div>
  );
  const fakeButton = (label: string, look: string) => (
    <span className={cx("inline-flex min-h-12 items-center border px-6 font-medium", look)}>{label}</span>
  );

  return (
    <DsBlock title={t("dialog.title")}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap gap-4">
          <DemoDialog text={close} />
          <DemoFormDialog text={form} field={t("dialog.formField")} hint={t("dialog.formHint")} />
          <DemoConfirmTwice
            open={t("dialog.openDelete")}
            title={t("dialog.deleteTitle")}
            question={t("dialog.deleteQuestion")}
            word={t("dialog.deleteWord")}
            confirm={t("dialog.deleteConfirm")}
          />
        </div>
        <div className="grid items-start gap-8 bg-scrim p-4 md:grid-cols-2 md:p-8">
          <Labeled label={t("dialog.stillDefault")} className="[&>span]:text-bg">
            {still(
              "default",
              <>
                <p className="type-h3">{t("dialog.closeTitle")}</p>
                <p className="type-small">{t("dialog.closeText")}</p>
              </>,
              <>
                {fakeButton(t("dialog.back"), "border-transparent px-0.5 text-accent underline decoration-1 underline-offset-6")}
                {fakeButton(t("dialog.closeConfirm"), "border-transparent bg-accent text-on-accent")}
              </>,
            )}
          </Labeled>
          <Labeled label={t("dialog.stillDanger")} className="[&>span]:text-bg">
            {still(
              "danger",
              <>
                <p className="type-h3">{t("dialog.deleteTitle")}</p>
                <p className="type-small">{t("dialog.deleteQuestion")}</p>
              </>,
              <>
                {fakeButton(t("dialog.back"), "border-transparent px-0.5 text-accent underline decoration-1 underline-offset-6")}
                {fakeButton(t("dialog.deleteConfirm"), "border-line bg-surface text-ink-2")}
              </>,
            )}
          </Labeled>
        </div>
      </div>
      <DsNote className="mt-4">{t("dialog.note")}</DsNote>
    </DsBlock>
  );
}

/* ---------------------------------------------------------------- lists -- */

const LISTS: { kind: ListSkeletonKind; rows: number }[] = [
  { kind: "projects", rows: 1 },
  { kind: "articles", rows: 3 },
  { kind: "resources", rows: 2 },
  { kind: "courses", rows: 1 },
  { kind: "documents", rows: 2 },
];

async function ListsBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemFeedback" });
  return (
    <DsBlock title={t("lists.title")} intro={t("lists.note")}>
      <div className="flex flex-col gap-10">
        {LISTS.map(({ kind, rows }) => (
          <section key={kind} aria-label={t(`lists.${kind}`)} className="flex flex-col gap-2.5">
            <p className="text-ink-2 type-caption">{t(`lists.${kind}`)}</p>
            <div className="grid items-start gap-6 md:grid-cols-3">
              <Labeled label={t("lists.empty")}>
                <EmptyState level={3} title={t(`lists.${kind}Empty`)} text={t(`lists.${kind}EmptyText`)} outline={false} />
              </Labeled>
              <Labeled label={t("lists.loading")}>
                <ListSkeleton kind={kind} rows={rows} label={t("lists.loadingLabel")} />
              </Labeled>
              <Labeled label={t("lists.failed")}>
                <InlineNotice
                  tone="danger"
                  title={t(`lists.${kind}Failed`)}
                  text={t(`lists.${kind}FailedText`)}
                  action={<DemoButton label={t("error.retry")} variant="quiet" />}
                />
              </Labeled>
            </div>
          </section>
        ))}
      </div>
    </DsBlock>
  );
}

/* ------------------------------------------------------------ not found -- */

async function NotFoundBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemFeedback" });
  return (
    <DsBlock title={t("notFound.title")}>
      <NotFoundContent embedded />
      <DsNote className="mt-4">
        {t("notFound.note")}{" "}
        <a href={`/${locale}/x-not-a-page`} className="text-accent underline decoration-1 underline-offset-5 focus-ring">
          {t("notFound.openLive")}
        </a>
      </DsNote>
    </DsBlock>
  );
}
