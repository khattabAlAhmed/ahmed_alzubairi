"use client";

import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE, MAX_LONG_TEXT_LENGTH, MAX_SHORT_TEXT_LENGTH } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type FormEvent } from "react";
import { Button, FileInput, Select, TextArea, TextField } from "@/components/ui";
import { InlineNotice } from "@/components/account/notice";
import { allowedTypeNames, FileChip, formatBytes } from "@/components/workspace";
import { attachmentAccept } from "@/components/workspace/format";
import { useRouter } from "@/i18n/navigation";
import { consultationApi, type ConsultationApi } from "./api";
import { useFiles } from "./use-files";
import { track } from "@/lib/analytics/track";

export type ServiceOption = { id: string; slug: string; title: string };

type Errors = Partial<Record<"service" | "title" | "description", string>>;

/** The service `?service=` names: a slug, or an id from an older link. Unknown is none. */
export function preselectedService(services: ServiceOption[], value: string | undefined): string {
  if (!value) return "";
  return services.find((service) => service.slug === value || service.id === value)?.id ?? "";
}

/**
 * "بدء استشارة جديدة" (§6.17). Files are checked in the browser when picked.
 * Send creates the consultation, uploads and finalizes each file, then posts
 * the first message with them, and opens the consultation. A failed file
 * shows its reason and everything typed stays; the consultation is kept, so
 * sending again only finishes the files.
 */
export function NewConsultationForm({
  services,
  initialService,
  organization,
  api: apiProp,
}: {
  services: ServiceOption[];
  /** From `?service=`: a slug or an id. */
  initialService?: string;
  /** Prefilled from the profile. */
  organization: string | null;
  api?: ConsultationApi;
}) {
  const t = useTranslations("AccountConsultations.form");
  const tc = useTranslations("Workspace.composer");
  const locale = useLocale();
  const router = useRouter();
  const api = useMemo(() => apiProp ?? consultationApi(), [apiProp]);
  const filesState = useFiles(api);

  const [serviceId, setServiceId] = useState(() => preselectedService(services, initialService));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [org, setOrg] = useState(organization ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Once created, a second send reuses it: never two consultations.
  const [createdId, setCreatedId] = useState<string | null>(null);
  // The first message was sent but its answer never came: it may have landed.
  const [messageUncertain, setMessageUncertain] = useState(false);

  const counted = filesState.chips.filter((chip) => chip.state !== "refused" || chip.reason === "failed").length;
  const full = counted >= MAX_ATTACHMENTS_PER_MESSAGE;
  const uploading = filesState.chips.some((chip) => chip.state === "uploading");

  function validate(): Errors {
    const next: Errors = {};
    if (!serviceId) next.service = t("serviceRequired");
    if (!title.trim()) next.title = t("titleRequired");
    if (!description.trim()) next.description = t("descriptionRequired");
    return next;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || uploading) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSending(true);
    setFormError(null);
    let sendingMessage = false;
    try {
      let id = createdId;
      if (!id) {
        const trimmedOrg = org.trim();
        id = await api.create({
          serviceId,
          title: title.trim(),
          description: description.trim(),
          ...(trimmedOrg ? { organization: trimmedOrg } : {}),
        });
        setCreatedId(id);
        // Once, when the server created it; a retry reuses the id.
        const slug = services.find((service) => service.id === serviceId)?.slug;
        track("consultation_requested", slug ? { service_slug: slug } : {});
      }

      const uploaded = await filesState.uploadAll(id);
      if ("failed" in uploaded) {
        setFormError(uploaded.failed ? `${uploaded.failed} ${t("retry")}` : t("fileFailed"));
        return;
      }
      if (uploaded.ids.length > 0) {
        // A message that landed holds its files; sending them again would be refused.
        const linked = messageUncertain ? await api.linkedAttachmentIds(id) : new Set<string>();
        if (!uploaded.ids.every((fileId) => linked.has(fileId))) {
          sendingMessage = true;
          await api.sendMessage(id, { attachmentIds: uploaded.ids });
        }
      }
      router.push(`/account/consultations/${id}`);
    } catch (error) {
      if (sendingMessage) setMessageUncertain(true);
      const message = (error as { serverMessage?: unknown }).serverMessage;
      setFormError(typeof message === "string" ? message : t("failed"));
    } finally {
      setSending(false);
    }
  }

  const locked = sending || createdId !== null;

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5.5 border-t-2 border-rule pt-5.5">
      {/* ConsultationRequest board: the service and the organization side by side, then the request. */}
      <div className="grid gap-x-6 gap-y-5.5 sm:grid-cols-2">
      <Select
        label={t("service")}
        value={serviceId}
        onChange={(event) => setServiceId(event.target.value)}
        error={errors.service}
        disabled={locked}
        required
      >
        <option value="">{t("servicePlaceholder")}</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.title}
          </option>
        ))}
      </Select>

      <TextField
        label={t("organization")}
        value={org}
        onChange={(event) => setOrg(event.target.value)}
        maxLength={MAX_SHORT_TEXT_LENGTH}
        disabled={locked}
        dir="auto"
        autoComplete="organization"
      />
      </div>

      <TextField
        label={t("consultationTitle")}
        hint={t("titleHint")}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        error={errors.title}
        maxLength={MAX_SHORT_TEXT_LENGTH}
        disabled={locked}
        dir="auto"
        required
      />

      <TextArea
        label={t("description")}
        hint={t("descriptionHint")}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        error={errors.description}
        rows={7}
        maxLength={MAX_LONG_TEXT_LENGTH}
        disabled={locked}
        dir="auto"
        required
      />

      {/* The FileInput board: the types and limits show before anything is picked; each file is a row under the zone. */}
      <FileInput
        label={t("attachments")}
        prompt={t("dropPrompt")}
        browse={t("dropBrowse")}
        dropHere={t("dropHere")}
        types={allowedTypeNames().join(" · ")}
        limits={t("dropLimits", { size: formatBytes(MAX_ATTACHMENT_BYTES, locale), count: MAX_ATTACHMENTS_PER_MESSAGE })}
        accept={attachmentAccept()}
        disabled={full || sending}
        onFiles={(picked) => filesState.attach(picked)}
      >
        {filesState.chips.length > 0 && (
          <ul aria-label={tc("files")} className="grid gap-2 sm:grid-cols-2">
            {filesState.chips.map((chip) => (
              <li key={chip.id} className="min-w-0">
                <FileChip file={chip} onRemove={sending ? undefined : filesState.remove} />
              </li>
            ))}
          </ul>
        )}
      </FileInput>

      {formError && <InlineNotice tone="danger" title={formError} />}

      <div className="flex justify-end">
        <Button type="submit" disabled={uploading} loading={sending} loadingLabel={t("submitting")}>
          {sending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
