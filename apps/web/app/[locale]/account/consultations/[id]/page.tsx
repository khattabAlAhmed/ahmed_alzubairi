import { auth } from "@clerk/nextjs/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { attachmentHref, ConsultationThread, type ThreadMessage } from "@/components/consultations/consultation-thread";
import { LocalTime } from "@/components/consultations/local-time";
import { readOwnConsultation } from "@/components/consultations/read";
import { RefreshButton } from "@/components/consultations/refresh-button";
import { ButtonLink, Card } from "@/components/ui";
import { MeetingCard, StatusPill, type FileChipData } from "@/components/workspace";
import { requireProfile } from "@/lib/auth/gates";
import { pageLocale } from "../locale";

/**
 * One consultation (§6.17): the status always at the top, the request, the
 * meetings in the client's local time, and the chat with its files. Manual
 * refresh only.
 */
export default async function ConsultationPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  await requireProfile(params, "/account/consultations/[id]");
  const { id, locale: raw } = await params;
  const locale = pageLocale(raw);
  const [{ userId }, t, messages] = await Promise.all([
    auth(),
    getTranslations("AccountConsultations.detail"),
    getMessages(),
  ]);
  if (!userId) throw new Error("no session after the gate");
  const detail = await readOwnConsultation(id, userId, locale);
  if (!detail) notFound();

  const { consultation } = detail;
  const closed = consultation.status === "closed";
  const filesByMessage = new Map<string, FileChipData[]>();
  for (const file of detail.attachments) {
    const chips = filesByMessage.get(file.messageId) ?? [];
    chips.push({
      id: file.id,
      name: file.fileName,
      sizeBytes: file.sizeBytes,
      mime: file.mime,
      state: "ready",
      href: attachmentHref(file.id),
    });
    filesByMessage.set(file.messageId, chips);
  }
  const thread: ThreadMessage[] = detail.messages.map((message) => ({
    id: message.id,
    senderName: message.senderName,
    mine: message.senderId === userId,
    body: message.body,
    sentAt: message.createdAt,
    attachments: filesByMessage.get(message.id) ?? [],
  }));

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{ AccountConsultations: messages.AccountConsultations, Workspace: messages.Workspace }}
    >
      <div className="space-y-6">
        <ButtonLink href="/account/consultations" variant="quiet" size="sm">
          {t("back")}
        </ButtonLink>

        {/* The status stays in view while the chat scrolls (§6.17). */}
        <header className="sticky top-0 z-10 -mx-4 border-b border-text/10 bg-background/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <span className="sr-only">{t("status")}</span>
              <StatusPill kind="consultation" status={consultation.status} />
              <h1 dir="auto" className="min-w-0 text-start text-2xl wrap-anywhere">
                {consultation.title}
              </h1>
            </div>
            <RefreshButton />
          </div>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {detail.serviceTitle && (
              <div className="flex gap-1.5">
                <dt className="text-text-secondary">{t("service")}:</dt>
                <dd className="font-semibold">{detail.serviceTitle}</dd>
              </div>
            )}
            <div className="flex gap-1.5">
              <dt className="text-text-secondary">{t("opened")}:</dt>
              <dd className="font-semibold">
                <LocalTime value={consultation.createdAt} />
              </dd>
            </div>
          </dl>
        </header>

        <Card as="section" compact aria-labelledby="request-heading" className="space-y-2">
          <h2 id="request-heading" className="text-lg">
            {t("description")}
          </h2>
          {/* Text, never HTML (§9). */}
          <p dir="auto" className="text-start leading-relaxed whitespace-pre-wrap wrap-anywhere">
            {consultation.description}
          </p>
          {consultation.organization && (
            <p dir="auto" className="text-start text-sm text-text-secondary">
              {consultation.organization}
            </p>
          )}
        </Card>

        {detail.meetings.length > 0 && (
          <section aria-labelledby="meetings-heading" className="space-y-3">
            <h2 id="meetings-heading" className="text-xl">
              {t("meetings")}
            </h2>
            {detail.meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                platform={meeting.platform}
                url={meeting.url}
                startsAt={meeting.startsAt}
                durationMinutes={meeting.durationMinutes}
              />
            ))}
          </section>
        )}

        <section aria-labelledby="chat-heading" className="space-y-3">
          <h2 id="chat-heading" className="text-xl">
            {t("chat")}
          </h2>
          <ConsultationThread consultationId={consultation.id} messages={thread} closed={closed} />
        </section>
      </div>
    </NextIntlClientProvider>
  );
}
