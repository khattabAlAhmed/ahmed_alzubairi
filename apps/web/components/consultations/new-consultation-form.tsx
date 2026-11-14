"use client";

import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE, MAX_LONG_TEXT_LENGTH, MAX_SHORT_TEXT_LENGTH } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState, type FormEvent } from "react";
import { Button, buttonClasses, Select, TextArea, TextField } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { allowedTypeNames, FileChip, formatBytes } from "@/components/workspace";
import { attachmentAccept, joinList } from "@/components/workspace/format";
import { PaperclipIcon } from "@/components/workspace/icons";
import { useRouter } from "@/i18n/navigation";
import { consultationApi, type ConsultationApi } from "./api";
import { useFiles } from "./use-files";

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
  const limitsId = useId();

  const [serviceId, setServiceId] = useState(() => preselectedService(services, initialService));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [org, setOrg] = useState(organization ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Once created, a second send reuses it: never two consultations.
  const [createdId, setCreatedId] = useState<string | null>(null);

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
      }

      const uploaded = await filesState.uploadAll(id);
      if ("failed" in uploaded) {
        setFormError(uploaded.failed ? `${uploaded.failed} ${t("retry")}` : t("fileFailed"));
        return;
      }
      if (uploaded.ids.length > 0) await api.sendMessage(id, { attachmentIds: uploaded.ids });
      router.push(`/account/consultations/${id}`);
    } catch (error) {
      const message = (error as { serverMessage?: unknown }).serverMessage;
      setFormError(typeof message === "string" ? message : t("failed"));
    } finally {
      setSending(false);
    }
  }

  const locked = sending || createdId !== null;

  return (
    <form noValidate onSubmit={submit} className="space-y-5 rounded-lg border border-text/10 bg-surface p-4 shadow-sm sm:p-6">
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
        rows={6}
        maxLength={MAX_LONG_TEXT_LENGTH}
        disabled={locked}
        dir="auto"
        required
      />

      <TextField
        label={t("organization")}
        value={org}
        onChange={(event) => setOrg(event.target.value)}
        maxLength={MAX_SHORT_TEXT_LENGTH}
        disabled={locked}
        dir="auto"
        autoComplete="organization"
      />

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">{t("attachments")}</legend>
        {filesState.chips.length > 0 && (
          <ul aria-label={tc("files")} className="grid gap-2 sm:grid-cols-2">
            {filesState.chips.map((chip) => (
              <li key={chip.id} className="min-w-0">
                <FileChip file={chip} onRemove={sending ? undefined : filesState.remove} />
              </li>
            ))}
          </ul>
        )}
        <p id={limitsId} className="text-xs text-text-secondary">
          {tc("limits", {
            count: MAX_ATTACHMENTS_PER_MESSAGE,
            size: formatBytes(MAX_ATTACHMENT_BYTES, locale),
            types: joinList(allowedTypeNames(), locale),
          })}
        </p>
        {/* A real file input behind a styled label, as in the Composer. */}
        <label
          className={cx(
            buttonClasses({ variant: "secondary", size: "sm" }),
            "cursor-pointer has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring",
            (full || sending) && "pointer-events-none opacity-50",
          )}
        >
          <PaperclipIcon />
          {tc("attach")}
          <input
            type="file"
            multiple
            accept={attachmentAccept()}
            disabled={full || sending}
            aria-describedby={limitsId}
            className="sr-only"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (picked.length > 0) filesState.attach(picked);
            }}
          />
        </label>
      </fieldset>

      {formError && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {formError}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={uploading} loading={sending} loadingLabel={t("submitting")}>
          {sending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
