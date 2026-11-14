"use client";

import { useCallback, useRef, useState } from "react";
import { attachmentRefusal, type FileChipData } from "@/components/workspace";
import type { ConsultationApi } from "./api";

/** A picked file: its chip, the file itself, and its attachment id once finalized. */
export type PickedFile = { chip: FileChipData; file: File; attachmentId?: string };

let counter = 0;
const nextId = () => `file-${Date.now().toString(36)}-${(counter += 1)}`;

/**
 * The files on a form or a reply (§6.17). Picking checks each file in the
 * browser first: a wrong type, a size over the limit or one file too many is
 * refused before upload, with its reason. `uploadAll` sends the rest and
 * keeps the ones already finalized, so a retry only uploads what failed.
 */
export function useFiles(api: ConsultationApi) {
  const [files, setFiles] = useState<PickedFile[]>([]);
  // The latest list, for `uploadAll` to read between its own updates.
  const latest = useRef<PickedFile[]>([]);
  const update = useCallback((change: (current: PickedFile[]) => PickedFile[]) => {
    latest.current = change(latest.current);
    setFiles(latest.current);
  }, []);

  const patch = useCallback((id: string, change: Omit<Partial<PickedFile>, "chip"> & { chip?: Partial<FileChipData> }) => {
    update((current) =>
      current.map((item) =>
        item.chip.id === id ? { ...item, ...change, chip: { ...item.chip, ...change.chip } } : item,
      ),
    );
  }, [update]);

  const attach = useCallback((picked: File[]) => {
    update((current) => {
      // A failed upload is still on the message: it is tried again on send.
      let counted = current.filter((item) => item.chip.state !== "refused" || item.chip.reason === "failed").length;
      const added = picked.map((file): PickedFile => {
        const reason = attachmentRefusal(file, counted);
        if (!reason) counted += 1;
        return {
          file,
          chip: {
            id: nextId(),
            name: file.name,
            sizeBytes: file.size,
            mime: file.type,
            // Picked and checked; it goes up on send.
            state: reason ? "refused" : "ready",
            reason: reason ?? undefined,
          },
        };
      });
      return [...current, ...added];
    });
  }, [update]);

  const remove = useCallback((id: string) => {
    update((current) => current.filter((item) => item.chip.id !== id));
  }, [update]);

  const clear = useCallback(() => update(() => []), [update]);

  /**
   * Uploads every file not yet finalized, one at a time. Returns the ids of
   * all finalized files, or `failed` when one failed: that chip then shows its
   * reason, and the server's message is returned for the error line.
   */
  const uploadAll = useCallback(
    async (consultationId: string): Promise<{ ids: string[] } | { failed: string | null }> => {
      const ids: string[] = [];
      for (const item of latest.current) {
        // Refused in the browser stays out; a failed upload is tried again.
        if (item.chip.state === "refused" && item.chip.reason !== "failed") continue;
        if (item.attachmentId) {
          ids.push(item.attachmentId);
          continue;
        }
        const id = item.chip.id;
        patch(id, { chip: { state: "uploading", progress: 0, reason: undefined } });
        try {
          const attachmentId = await api.upload(consultationId, item.file, (progress) =>
            patch(id, { chip: { progress } }),
          );
          patch(id, { attachmentId, chip: { state: "ready", progress: undefined } });
          ids.push(attachmentId);
        } catch (error) {
          patch(id, { chip: { state: "refused", reason: "failed", progress: undefined } });
          const message = (error as { serverMessage?: unknown }).serverMessage;
          return { failed: typeof message === "string" ? message : null };
        }
      }
      return { ids };
    },
    [api, patch],
  );

  return { files, chips: files.map((item) => item.chip), attach, remove, clear, uploadAll };
}
