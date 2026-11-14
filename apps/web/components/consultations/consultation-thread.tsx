"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui";
import { ChatMessage, Composer, type FileChipData } from "@/components/workspace";
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
          <p className="rounded-lg border border-dashed border-text/20 p-4 text-sm text-text-secondary">
            {t("noMessages")}
          </p>
        ) : (
          <ol className="space-y-4">
            {messages.map((message) => (
              <li key={message.id}>
                <ChatMessage
                  senderName={message.senderName}
                  mine={message.mine}
                  body={message.body}
                  sentAt={message.sentAt}
                  attachments={message.attachments}
                />
              </li>
            ))}
          </ol>
        )}
        {downloadError && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {downloadError}
          </p>
        )}
      </div>

      {closed ? (
        <p role="status" className="rounded-lg border border-dashed border-text/40 p-4 text-sm text-text-secondary">
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
