import type { Locale } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { InlineNotice } from "@/components/account/notice";
import { SIDE_LINK } from "@/components/dashboard/side-link";
import { FilterChips } from "@/components/public/listing/filter-chips";
import { Badge, DatedDivider, LanguageTabs, MonthlyChart, StatTile, TextArea, TextField } from "@/components/ui";
import { cx, INLINE_LINK } from "@/components/ui/cx";
import { ChatMessage } from "@/components/workspace/chat-message";
import { DocumentCard } from "@/components/workspace/document-card";
import type { FileChipData } from "@/components/workspace/file-chip";
import { MeetingCard } from "@/components/workspace/meeting-card";
import { StatusPill } from "@/components/workspace/status-pill";
import { formatCount } from "@/lib/time/format";
import { DsBlock, DsCode, DsNote, DsSection } from "../parts";
import { DemoComposer, DemoDataTable } from "./workspace-client";

/*
 * components.md group 8: the account and dashboard, restyled with the tokens
 * and the shared components, not redesigned. Times are fixed to Mecca time so
 * the page reads the same for everyone.
 */

type Props = { locale: Locale };

const ZONE = "Asia/Riyadh";
const PDF = "application/pdf";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function WorkspaceSection({ locale }: Props) {
  const ds = await getTranslations({ locale, namespace: "DesignSystem" });
  const t = await getTranslations({ locale, namespace: "DesignSystemWorkspace" });
  // The workspace components read their labels on the client.
  const { Workspace } = await getMessages({ locale });

  return (
    <DsSection id="workspace" title={ds("workspace.title")} intro={t("intro")}>
      <ShellBlock locale={locale} />
      <NextIntlClientProvider locale={locale} messages={{ Workspace }}>
        <ChatBlock locale={locale} />
        <MeetingBlock locale={locale} />
        <DocumentsBlock locale={locale} />
        <TableBlock locale={locale} />
        <StatsBlock locale={locale} />
        <EditorBlock locale={locale} />
      </NextIntlClientProvider>
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

/* ---------------------------------------------------------------- shell -- */

async function ShellBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemWorkspace" });
  const link = (key: string, current = false, count?: number) => (
    <a href="#workspace" aria-current={current ? "page" : undefined} className={SIDE_LINK}>
      {t(`shell.${key}` as "shell.home")}
      {count !== undefined && (
        <span className="inline-flex h-5 min-w-5.5 items-center justify-center bg-ink px-1.5 text-xs font-medium text-bg tabular-nums">
          {formatCount(count, locale)}
        </span>
      )}
    </a>
  );
  return (
    <DsBlock title={t("shell.title")}>
      {/* A still picture of the frame: the real one wraps the whole page. */}
      <div className="grid min-h-110 border border-line md:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label={t("shell.panel")} className="flex flex-col border-b border-line bg-surface md:border-e md:border-b-0">
          <div className="border-t-2 border-b border-rule border-b-line px-4.5 py-3.5">
            <p className="font-semibold type-small">{t("shell.panel")}</p>
            <p className="text-[13px] text-ink-2">{t("shell.who")}</p>
          </div>
          <p className="px-4.5 pt-3.5 pb-1 text-xs font-medium text-ink-2">{t("shell.work")}</p>
          {link("home")}
          {link("consultations", true, 3)}
          {link("documents", false, 2)}
          {link("messages")}
          <p className="px-4.5 pt-3.5 pb-1 text-xs font-medium text-ink-2">{t("shell.content")}</p>
          {link("projects")}
          {link("articles")}
          {link("trust")}
          <p className="mt-auto border-t border-line px-4.5 py-4 text-[13px] text-ink-2">{t("shell.permissions")}</p>
        </nav>
        <div className="flex flex-col">
          <div className="flex items-center justify-between border-t-2 border-b border-rule border-b-line px-6 py-3">
            <p className="type-h3">{t("shell.consultations")}</p>
          </div>
          <div aria-hidden="true" className="grid grid-cols-3 gap-4 p-6">
            <div className="h-22 bg-surface" />
            <div className="h-22 bg-surface" />
            <div className="h-22 bg-surface" />
            <div className="col-span-full h-55 bg-surface" />
          </div>
        </div>
      </div>
      <DsNote className="mt-3">{t("shell.note")}</DsNote>
    </DsBlock>
  );
}

/* ----------------------------------------------------------------- chat -- */

async function ChatBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemWorkspace" });
  const day = new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-arab" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ZONE,
  }).format(new Date("2026-03-12T07:04:00Z"));
  const file = (id: string, name: string, size: number, mime: string, extra: Partial<FileChipData> = {}): FileChipData => ({
    id,
    name,
    sizeBytes: size,
    mime,
    state: "ready",
    ...extra,
  });

  return (
    <DsBlock title={t("chat.title")}>
      <div className="flex max-w-215 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-b border-rule border-b-line py-3.5">
          <div>
            <p className="type-h3">{t("chat.subject")}</p>
            <p className="text-[13px] text-ink-2">{t("chat.meta")}</p>
          </div>
          <StatusPill kind="consultation" status="scheduled" />
        </div>
        <DatedDivider className="my-3">{day}</DatedDivider>
        <ChatMessage
          senderName={t("chat.client")}
          mine={false}
          body={t("chat.first")}
          sentAt="2026-03-12T07:04:00Z"
          timeZone={ZONE}
          attachments={[
            file("d", t("chat.fileDraft"), 2_516_582, PDF, { href: "#workspace" }),
            file("c", t("chat.fileChart"), 317_440, XLSX, { href: "#workspace" }),
          ]}
        />
        <ChatMessage senderName={t("chat.team")} mine body={t("chat.reply")} sentAt="2026-03-12T11:15:00Z" timeZone={ZONE} />
      </div>
      <div className="mt-8 grid gap-x-8 gap-y-6 lg:grid-cols-2">
        <Labeled label={t("chat.states.empty")}>
          <DemoComposer />
        </Labeled>
        <Labeled label={t("chat.states.typing")}>
          <DemoComposer value={t("chat.typed")} />
        </Labeled>
        <Labeled label={t("chat.states.attaching")}>
          <DemoComposer
            value={t("chat.typed")}
            files={[file("u", t("chat.fileDraft"), 2_516_582, PDF, { state: "uploading", progress: 64 })]}
          />
        </Labeled>
        <Labeled label={t("chat.states.sending")}>
          <DemoComposer value={t("chat.typed")} sending />
        </Labeled>
        <Labeled label={t("chat.states.failed")}>
          <DemoComposer value={t("chat.typed")} error={t("chat.composerError")} />
        </Labeled>
      </div>
      <DsNote className="mt-4">{t("chat.note")}</DsNote>
    </DsBlock>
  );
}

/* -------------------------------------------------------------- meeting -- */

async function MeetingBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemWorkspace" });
  return (
    <DsBlock title={t("meeting.title")}>
      <div className="flex max-w-160 flex-col gap-4.5">
        <MeetingCard
          platform="Google Meet"
          url="https://meet.google.com/abc-defg-hij"
          startsAt="2026-03-16T08:00:00Z"
          durationMinutes={60}
          timeZone={ZONE}
        />
        <InlineNotice tone="info" title={t("meeting.changed")} />
      </div>
      <DsNote className="mt-4">{t("meeting.note")}</DsNote>
    </DsBlock>
  );
}

/* ------------------------------------------------------------ documents -- */

async function DocumentsBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemWorkspace" });
  const more = (label: string) => (
    <a href="#workspace" className="border-b border-current py-1 text-sm text-accent transition-state hover:text-ink focus-ring">
      {label}
    </a>
  );
  return (
    <DsBlock title={t("documents.title")}>
      <div className="grid gap-8 lg:grid-cols-[4fr_8fr]">
        <div className="flex flex-col gap-1.5">
          <p className="text-ink-2 type-small">{t("documents.list")}</p>
          <div className="border-t-2 border-rule">
            <DocumentCard
              title={t("documents.letter")}
              category="thank_you_letter"
              accessMode="view"
              status="granted"
              note={t("documents.until")}
              actions={more(t("documents.open"))}
            />
            <DocumentCard
              title={t("documents.certificate")}
              category="experience_certificate"
              accessMode="view_download"
              status="granted"
              note={t("documents.noExpiry")}
              actions={more(t("documents.open"))}
            />
            <DocumentCard
              title={t("documents.expired")}
              category="course_certificate"
              accessMode="view"
              status="expired"
              note={t("documents.endedOn")}
              actions={more(t("documents.requestAgain"))}
            />
          </div>
        </div>
        {/* A still picture of the viewer's frame around a watermarked page. */}
        <div className="flex flex-col border border-line">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-b border-rule border-b-line px-3.5 py-2.5">
            <p className="font-medium type-small">{t("documents.letter")}</p>
            <div className="flex items-center gap-2.5">
              <Badge>{t("documents.pageOf")}</Badge>
            </div>
          </div>
          <div className="flex justify-center bg-surface px-3 py-5">
            <div
              aria-hidden="true"
              className="relative flex aspect-[1/1.414] w-full max-w-75 flex-col gap-2.5 overflow-hidden border border-line bg-white p-7"
            >
              {["w-2/5", "w-full", "w-full", "w-4/5", "w-full", "w-3/5"].map((width, index) => (
                <span key={index} className={cx("h-1.5 bg-[#e3e5e6]", width)} />
              ))}
              <span className="pointer-events-none absolute -inset-[40%] grid -rotate-30 grid-cols-2 place-content-center gap-15 text-[13px] text-[rgb(26_28_30/0.13)]">
                {Array.from({ length: 6 }, (_, index) => (
                  <span key={index}>{t("documents.watermarkSample")}</span>
                ))}
              </span>
            </div>
          </div>
          <p className="border-t border-line px-3.5 py-2.5 text-[13px] leading-[1.7] text-ink-2">{t("documents.viewerNote")}</p>
        </div>
      </div>
      <DsNote className="mt-4">{t("documents.note")}</DsNote>
    </DsBlock>
  );
}

/* ---------------------------------------------------------------- table -- */

async function TableBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemWorkspace" });
  const rows = t.raw("table.rows") as { title: string; client: string; activity: string }[];
  const statuses = ["scheduled", "new", "in_review", "closed"] as const;
  const columns = [
    { key: "title", label: t("table.colTitle"), primary: true, sortable: true },
    { key: "client", label: t("table.colClient") },
    { key: "status", label: t("table.colStatus") },
    { key: "activity", label: t("table.colActivity"), sortable: true, numeric: true },
  ];
  return (
    <DsBlock title={t("table.title")}>
      <DemoDataTable
        caption={t("table.caption")}
        locale={locale}
        columns={columns}
        rows={rows.map((row, index) => ({
          id: String(index),
          cells: {
            title: row.title,
            client: row.client,
            status: <StatusPill kind="consultation" status={statuses[index]} />,
            activity: row.activity,
          },
          sortValues: { title: row.title, activity: rows.length - index },
          action: (
            <a href="#workspace" className={INLINE_LINK}>
              {t("table.openRow")}
            </a>
          ),
        }))}
        labels={{
          selectAll: t("table.selectAll"),
          selectRow: t.raw("table.selectRow") as string,
          actions: t("table.actions"),
          selected: t.raw("table.selectedCount") as string,
        }}
        toolbar={
          <FilterChips
            label={t("table.caption")}
            pathname="/design-system"
            param="ds-table"
            options={[
              { value: "open", label: t("table.open"), count: formatCount(12, locale) },
              { value: "mine", label: t("table.mine"), count: formatCount(4, locale) },
            ]}
          />
        }
        bulk={
          <>
            <a href="#workspace" className={INLINE_LINK}>
              {t("table.assign")}
            </a>
            {" · "}
            <a href="#workspace" className={INLINE_LINK}>
              {t("table.changeStatus")}
            </a>
          </>
        }
      />
      <DsNote className="mt-4">{t("table.note")}</DsNote>
    </DsBlock>
  );
}

/* ---------------------------------------------------------------- stats -- */

async function StatsBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemWorkspace" });
  const n = (value: number) => formatCount(value, locale);
  const months = Array.from({ length: 12 }, (_, index) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-arab" : "en-GB", { month: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(2025, 3 + index, 1)),
    ),
  );
  const values = [4, 6, 5, 8, 7, 9, 6, 10, 11, 9, 12, 14];
  return (
    <DsBlock title={t("stats.title")}>
      <ul className="grid grid-cols-2 gap-x-5 lg:grid-cols-4">
        <li>
          <StatTile href="/design-system" label={t("stats.newRequests")} value={n(3)} hint={t("stats.newRequestsHint")} need />
        </li>
        <li>
          <StatTile href="/design-system" label={t("stats.docRequests")} value={n(2)} hint={t("stats.docRequestsHint")} need />
        </li>
        <li>
          <StatTile label={t("stats.active")} value={n(11)} hint={t("stats.activeHint")} />
        </li>
        <li>
          <StatTile label={t("stats.subscribers")} value={n(48)} hint={t("stats.subscribersHint")} />
        </li>
      </ul>
      <MonthlyChart
        className="mt-6"
        title={t("stats.chartTitle")}
        description={t("stats.chartDescription")}
        data={months.map((label, index) => ({ label, value: values[index] }))}
        locale={locale}
        monthHeader={t("stats.month")}
        valueHeader={t("stats.value")}
        emptyLabel=""
        tableToggleLabel={t("stats.showTable")}
      />
      <DsNote className="mt-4">{t("stats.note")}</DsNote>
    </DsBlock>
  );
}

/* --------------------------------------------------------------- editor -- */

async function EditorBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystemWorkspace" });
  return (
    <DsBlock title={t("editor.title")}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="mb-4.5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-b border-rule border-b-line py-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="type-h3">{t("editor.heading")}</p>
              <Badge tone="draft">{t("editor.draft")}</Badge>
            </div>
            <p className="text-[13px] text-ink-2">{t("editor.saved")}</p>
          </div>
          <LanguageTabs
            label={t("editor.language")}
            invalidLabel={t("editor.missing")}
            arabic={{
              label: t("editor.arabic"),
              content: (
                <>
                  <TextField label={t("editor.fieldTitle")} name="ds-ce-title-ar" defaultValue={t("editor.heading")} />
                  <TextArea label={t("editor.situation")} name="ds-ce-situation" rows={3} defaultValue={t("editor.situationValue")} />
                  <TextArea label={t("editor.did")} name="ds-ce-did" rows={3} defaultValue={t("editor.didValue")} />
                  <TextArea label={t("editor.changed")} name="ds-ce-changed" rows={3} defaultValue={t("editor.changedValue")} />
                </>
              ),
            }}
            english={{
              label: t("editor.english"),
              invalid: true,
              content: <TextField label={t("editor.fieldTitle")} name="ds-ce-title-en" error={t("editor.englishError")} />,
            }}
          />
        </div>
        <aside aria-label={t("editor.publishing")} className="flex flex-col gap-3.5 self-start border-t-2 border-rule bg-surface p-4.5">
          <p className="font-medium type-small">{t("editor.publishing")}</p>
          <dl className="border-t border-line">
            {[
              [t("editor.status"), t("editor.draft")],
              [t("editor.arabic"), t("editor.complete")],
              [t("editor.english"), t("editor.incomplete")],
            ].map(([term, value]) => (
              <div key={term} className="flex items-baseline justify-between gap-3 border-b border-line py-2.5">
                <dt className="text-sm text-ink-2">{term}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[13px] leading-[1.7] text-ink-2">{t("editor.publishNote")}</p>
          <a
            href="#workspace"
            className="inline-flex min-h-12 w-full items-center justify-center border border-ink px-6 font-medium transition-state hover:bg-surface-hover focus-ring"
          >
            {t("editor.preview")}
          </a>
          <a
            href="#workspace"
            className="inline-flex min-h-12 w-full items-center justify-center bg-accent px-6 font-medium text-on-accent transition-state hover:bg-ink hover:text-bg focus-ring"
          >
            {t("editor.publish")}
          </a>
        </aside>
      </div>
      <DsNote className="mt-4">{t("editor.note")}</DsNote>
    </DsBlock>
  );
}
