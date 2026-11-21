"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type MouseEvent } from "react";
import { InlineNotice } from "@/components/account/notice";
import { Button, DatedDivider } from "@/components/ui";
import { ChatMessage, Composer, type FileChipData } from "@/components/workspace";
import { useInBrowser } from "@/components/workspace/use-in-browser";
import { formatDateTime } from "@/lib/time/format";
import { useRouter } from "@/i18n/navigation";
import { consultationApi, type ConsultationApi } from "./api";
import { useFiles } from "./use-files";

export { attachmentHref } from "./paths";

export type ThreadMessage = {
  id: string;
  senderName: string;
  mine: boolean;
  body: string | null;
  sentAt: string;
  attachments: FileChipData[];
};

const HREF_PATTERN = /^\/api\/attachments\/([^/?#]+)$/;

/**
 * The chat (§6.17): messages in time order, then the reply box, or a closed
 * note instead of it. A file link fetches its 60-second signed URL from
 * `GET /api/attachments/:id` and opens it. After a reply, the page reloads its
 * data; there is no realtime.
 */
export function ConsultationThread({
  consultationId,
  messages,
  closed,
  api: apiProp,
}: {
  consultationId: string;
  messages: ThreadMessage[];
  closed: boolean;
  api?: ConsultationApi;
}) {
  const t = useTranslations("AccountConsultations.detail");
  const locale = useLocale();
  const inBrowser = useInBrowser();
  // A message's calendar day in the viewer's own zone, to group by day.
  const dayOf = (sentAt: string) => new Date(sentAt).toLocaleDateString("en-CA");
  const router = useRouter();
  const api = useMemo(() => apiProp ?? consultationApi(), [apiProp]);
  const filesState = useFiles(api);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const failed = filesState.chips.some((chip) => chip.state === "refused" && chip.reason === "failed");

  async function openFile(event: MouseEvent<HTMLElement>) {
    const link = (event.target as HTMLElement).closest("a");
    const match = link && HREF_PATTERN.exec(link.getAttribute("href") ?? "");
    if (!match) return;
    event.preventDefault();
    setDownloadError(null);
    try {
      window.location.assign(await api.downloadUrl(decodeURIComponent(match[1]!)));
    } catch {
      setDownloadError(t("downloadFailed"));
    }
  }

  async function send() {
    // Only this draft is cleared on success: text typed meanwhile stays.
    const submitted = text;
    setSending(true);
    setError(undefined);
    try {
      const uploaded = await filesState.uploadAll(consultationId);
      if ("failed" in uploaded) {
        setError(uploaded.failed ?? t("sendFailed"));
        return;
      }
      const body = text.trim();
      await api.sendMessage(consultationId, {
        ...(body ? { body } : {}),
        ...(uploaded.ids.length > 0 ? { attachmentIds: uploaded.ids } : {}),
      });
      setText((current) => (current === submitted ? "" : current));
      filesState.clear();
      router.refresh();
    } catch (failure) {
      const message = (failure as { serverMessage?: unknown }).serverMessage;
      setError(typeof message === "string" ? message : t("sendFailed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Clicks on file links are caught here (Enter on a link fires click too); the links stay plain anchors. */}
      <div className="space-y-4" onClick={openFile}>
        {messages.length === 0 ? (
          <p className="border border-dashed border-line-strong p-4 text-sm text-ink-2">{t("noMessages")}</p>
        ) : (
          // The ChatThread board: messages as correspondence, grouped by day
          // under a dated rule. The order and the text-only rendering are unchanged;
          // the days are the viewer's own, so they appear once in the browser.
          <ol className="border-t border-line">
            {messages.map((message, index) => {
              const day = inBrowser ? dayOf(message.sentAt) : null;
              const newDay = day !== null && (index === 0 || dayOf(messages[index - 1].sentAt) !== day);
              return (
                <li key={message.id}>
                  {newDay && (
                    <DatedDivider className="my-3">
                      <time dateTime={message.sentAt}>{formatDateTime(message.sentAt, locale, { date: "long", time: false })}</time>
                    </DatedDivider>
                  )}
                  <ChatMessage
                    senderName={message.senderName}
                    mine={message.mine}
                    body={message.body}
                    sentAt={message.sentAt}
                    attachments={message.attachments}
                  />
                </li>
              );
            })}
          </ol>
        )}
        {downloadError && (
          <div className="mt-3">
            <InlineNotice tone="danger" title={downloadError} />
          </div>
        )}
      </div>

      {closed ? (
        <p role="status" className="border border-dashed border-line-strong p-4 text-sm text-ink-2">
          {t("closed")}
        </p>
      ) : (
        <div className="space-y-2">
          <Composer
            label={t("reply")}
            value={text}
            onChange={setText}
            files={filesState.chips}
            onAttach={filesState.attach}
            onRemoveFile={filesState.remove}
            onSend={send}
            sending={sending}
            error={error}
          />
          {/* A reply whose only file failed has nothing "ready", so the Composer can't send it: retry here. */}
          {failed && !sending && (
            <div className="flex justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={send}>
                {t("retry")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
