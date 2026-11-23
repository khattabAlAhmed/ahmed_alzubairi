import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { ConsultationThread, type ThreadMessage } from "@/components/consultations/consultation-thread";
import { attachmentHref } from "@/components/consultations/paths";
import { RefreshButton } from "@/components/consultations/refresh-button";
import { AssignControl, StatusControl } from "@/components/dashboard/consultations/consultation-controls";
import {
  consultationsAccess,
  loadAssignees,
  loadConsultation,
  mayWorkOn,
} from "@/components/dashboard/consultations/data";
import { DeleteConsultation } from "@/components/dashboard/consultations/delete-consultation";
import { Meetings } from "@/components/dashboard/consultations/meetings";
import { Refusal } from "@/components/dashboard/refusal";
import { LocalTime } from "@/components/dashboard/team/local-time";
import { ButtonLink, Card } from "@/components/ui";
import { StatusPill, type FileChipData } from "@/components/workspace";
import { Link } from "@/i18n/navigation";
import { requireTeamMember } from "@/lib/auth/gates";
import { getServices } from "@/lib/content";

type Params = Promise<{ locale: string; id: string }>;

/**
 * One consultation (§6.17): the client and their contact (what RLS allows),
 * status and close (reply rights), assignment (`consultations.assign`), the
 * chat, meetings, delete (`data.delete`) and a manual refresh. Every route
 * checks its own permission again.
 */
export default async function ConsultationPage({ params }: { params: Params }) {
  await requireTeamMember(params, "/dashboard/consultations/[id]");
  const access = await consultationsAccess(params);
  if (!access.allowed) return <Refusal />;
  const { locale } = access;
  const { id } = await params;

  const [t, all, view] = await Promise.all([
    getTranslations("DashboardConsultations"),
    getMessages(),
    loadConsultation(id, access.userId, locale),
  ]);

  if (!view) {
    return (
      <div className="space-y-6">
        <ButtonLink href="/dashboard/consultations" variant="quiet" size="sm">
          {t("detail.back")}
        </ButtonLink>
        <Card as="section" role="alert">
          <p>{t("detail.notFound")}</p>
        </Card>
      </div>
    );
  }

  const { consultation } = view;
  const closed = consultation.status === "closed";
  const canWork = mayWorkOn(access, consultation);
  const [assignees, services] = await Promise.all([
    access.assign ? loadAssignees() : Promise.resolve([]),
    consultation.serviceId ? getServices(locale) : Promise.resolve([]),
  ]);
  // The current assignee stays selectable even if they can no longer be assigned.
  if (consultation.assignedTo && !assignees.some((member) => member.id === consultation.assignedTo)) {
    assignees.unshift({ id: consultation.assignedTo, name: view.assigneeName ?? "" });
  }
  const serviceTitle = services.find((service) => service.id === consultation.serviceId)?.title ?? null;

  const files = new Map<string, FileChipData[]>();
  for (const file of view.attachments) {
    files.set(file.messageId, [
      ...(files.get(file.messageId) ?? []),
      { id: file.id, name: file.fileName, sizeBytes: file.sizeBytes, mime: file.mime, state: "ready", href: attachmentHref(file.id) },
    ]);
  }
  const thread: ThreadMessage[] = view.messages.map((message) => ({
    id: message.id,
    senderName: message.senderName,
    mine: message.senderId === access.userId,
    body: message.body,
    sentAt: message.createdAt,
    attachments: files.get(message.id) ?? [],
  }));

  // The chat and refresh come from the client's page (T06); their words are the team's here.
  const account = all.AccountConsultations;
  const messages = {
    Workspace: all.Workspace,
    DashboardConsultations: all.DashboardConsultations,
    AccountConsultations: { ...account, detail: { ...account.detail, ...all.DashboardConsultations.thread } },
  };
  const client = view.client.name || t("list.noName");

  // The client, service and opened date: inside the pinned header from `sm` up, below it on a phone.
  const meta = (
    <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
      <span>
        {t("detail.client")}: <bdi className="font-semibold text-ink">{client}</bdi>
      </span>
      {serviceTitle && (
        <span>
          {t("detail.service")}: <span className="font-semibold text-ink">{serviceTitle}</span>
        </span>
      )}
      <span>
        {t("detail.opened")}: <LocalTime value={consultation.createdAt} locale={locale} />
      </span>
    </p>
  );

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="space-y-6">
        <ButtonLink href="/dashboard/consultations" variant="quiet" size="sm">
          {t("detail.back")}
        </ButtonLink>

        {/* The status is always visible at the top (§6.17): the header stays in view while the chat scrolls.
            On a phone the pinned part is one compact row, the status and the title on one line; the full
            title, the details and Refresh follow below it, in the page flow. */}
        <header className="sticky top-0 z-10 -mx-4 border-b border-ink/10 bg-bg px-4 py-3.5 sm:mx-0 sm:border sm:px-5 sm:py-4">
          <div className="flex items-center justify-between gap-3 sm:flex-wrap">
            <div className="flex min-w-0 items-center gap-3 sm:flex-wrap">
              <span className="sr-only">{t("status.label")}</span>
              <StatusPill kind="consultation" status={consultation.status} className="shrink-0" />
              <h1
                dir="auto"
                className="min-w-0 truncate text-start text-lg sm:overflow-visible sm:text-2xl sm:whitespace-normal sm:wrap-anywhere"
              >
                {consultation.title}
              </h1>
            </div>
            <div className="hidden sm:block">
              <RefreshButton />
            </div>
          </div>
          <div className="mt-2 hidden sm:block">{meta}</div>
        </header>
        {/* The full title is in the h1 for screen readers; this copy is for sighted phone users. */}
        <div className="-mt-2 space-y-3 sm:hidden">
          <p aria-hidden="true" dir="auto" className="text-start text-2xl leading-tight font-bold wrap-anywhere">
            {consultation.title}
          </p>
          {meta}
          <RefreshButton />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-6">
            <Card as="section" compact aria-labelledby="request-heading" className="space-y-2">
              <h2 id="request-heading" className="text-lg">
                {t("detail.request")}
              </h2>
              {/* Text, never HTML (§9). */}
              <p dir="auto" className="text-start leading-relaxed whitespace-pre-wrap wrap-anywhere">
                {consultation.description}
              </p>
              {view.documentRequestId && (
                <Link
                  href={`/dashboard/document-requests?request=${view.documentRequestId}`}
                  className="inline-block text-sm font-semibold underline-offset-2 hover:underline"
                >
                  {t("detail.documentRequest")}
                </Link>
              )}
            </Card>

            <section aria-labelledby="meetings-heading" className="space-y-3">
              <h2 id="meetings-heading" className="text-xl">
                {t("detail.meetings")}
              </h2>
              <Meetings consultationId={consultation.id} meetings={view.meetings} editable={canWork && !closed} />
            </section>

            <section aria-labelledby="chat-heading" className="space-y-3">
              <h2 id="chat-heading" className="text-xl">
                {t("detail.chat")}
              </h2>
              <ConsultationThread consultationId={consultation.id} messages={thread} closed={closed || !canWork} />
            </section>
          </div>

          {/* A column of labelled sections, not a second landmark next to the menu. */}
          <div className="space-y-4">
            <Card as="section" compact aria-labelledby="client-heading" className="space-y-3">
              <h2 id="client-heading" className="text-lg">
                {t("detail.client")}
              </h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-ink-2">{t("detail.client")}</dt>
                  <dd className="font-semibold wrap-anywhere">
                    <bdi>{client}</bdi>
                  </dd>
                </div>
                {view.client.email && (
                  <div>
                    <dt className="text-xs text-ink-2">{t("detail.email")}</dt>
                    <dd dir="ltr" className="text-start wrap-anywhere">
                      <a href={`mailto:${view.client.email}`} className="underline-offset-2 hover:underline">
                        {view.client.email}
                      </a>
                    </dd>
                  </div>
                )}
                {view.client.phone && (
                  <div>
                    <dt className="text-xs text-ink-2">{t("detail.phone")}</dt>
                    <dd dir="ltr" className="text-start">
                      {view.client.phone}
                    </dd>
                  </div>
                )}
                {(consultation.organization || view.client.orgName) && (
                  <div>
                    <dt className="text-xs text-ink-2">{t("detail.organization")}</dt>
                    <dd dir="auto" className="text-start wrap-anywhere">
                      {consultation.organization || view.client.orgName}
                    </dd>
                  </div>
                )}
              </dl>
            </Card>

            <Card as="section" compact aria-labelledby="manage-heading" className="space-y-4">
              <h2 id="manage-heading" className="text-lg">
                {t("status.label")}
              </h2>
              {closed ? (
                <p className="text-sm text-ink-2">{t("status.closed")}</p>
              ) : (
                // Keyed on the saved value: after a refresh the draft starts from what's stored.
                canWork && <StatusControl key={consultation.status} id={consultation.id} status={consultation.status} />
              )}
              {access.assign && !closed && (
                <AssignControl
                  key={consultation.assignedTo ?? ""}
                  id={consultation.id}
                  assignedTo={consultation.assignedTo}
                  assignees={assignees}
                />
              )}
              {(closed || !access.assign) && (
                <p className="text-sm">
                  <span className="text-ink-2">{t("assign.label")}: </span>
                  {view.assigneeName === null ? t("list.unassigned") : <bdi>{view.assigneeName}</bdi>}
                </p>
              )}
              {access.delete && <DeleteConsultation id={consultation.id} title={consultation.title} />}
            </Card>
          </div>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
