"use client";

import {
  CONSENT_CONTENT_TYPES,
  CONTENT_STATUSES,
  LOCALES,
  type ContentType,
  type Locale,
} from "@repo/shared";
import { useLocale } from "next-intl";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Badge, Button, Card, LanguageTabs, Select } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { FieldInput } from "./field-input";
import { useFieldText, type FieldContext, type RefOption } from "./field-text";
import {
  buildBody,
  inputNames,
  publishState,
  requiredInputNames,
  rowToValues,
  type FieldErrors,
  type Row,
} from "./form-values";
import { CONTENT_CONFIG, editPath, type FieldDef } from "./registry";
import { saveContent } from "./save";

/** What every content editor gets from its page: the generic one and custom ones. */
export type ContentEditorProps = {
  type: ContentType;
  /** The row being edited, or null for a new one. */
  row: Row | null;
  refOptions: Partial<Record<ContentType, RefOption[]>>;
  mediaBase: string;
  /** Set after a create, to say so on the edit page it lands on. */
  justCreated?: boolean;
};

type Message = { tone: "success" | "error"; text: string; problems?: string[] };

/**
 * The state and save of a content form. Custom editors (home sections,
 * testimonials) use it too, and draw their own fields.
 */
export function useContentEditor({
  type,
  row,
  mediaBase,
  refOptions,
  justCreated = false,
}: ContentEditorProps) {
  const text = useFieldText();
  const router = useRouter();
  const [values, setValues] = useState<Row>(() => rowToValues(type, row));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(
    justCreated ? { tone: "success", text: text.t("editor.created") } : null,
  );

  const publish = useMemo(() => publishState(type, values, row), [type, values, row]);

  const ctx: FieldContext = {
    type,
    values,
    original: row,
    errors,
    refOptions,
    mediaBase,
    requiredNames: requiredInputNames(type, values),
    setValue: (name, value) => {
      setValues((current) => ({ ...current, [name]: value }));
      setErrors((current) => {
        if (!(name in current)) return current;
        const next = { ...current };
        delete next[name];
        return next;
      });
    },
  };

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (saving) return;
    const built = buildBody(type, values, row);
    setErrors(built.errors);
    if (Object.keys(built.errors).length > 0 || built.formError) {
      setMessage({ tone: "error", text: text.t("editor.fixErrors") });
      return;
    }
    if (values.status === "published" && publish.problems.length > 0) {
      setMessage({
        tone: "error",
        text: text.t("editor.cantPublish"),
        problems: publish.problems.map((problem) => text.t(`editor.problems.${problem}`)),
      });
      return;
    }

    setSaving(true);
    setMessage(null);
    const result = await saveContent(type, built.body, row === null);
    setSaving(false);
    if (!result.ok) {
      setMessage({
        tone: "error",
        text: result.message ?? text.t("editor.networkError"),
      });
      return;
    }
    if (row === null && result.id) {
      router.replace(`${editPath(type, result.id)}&created=1`);
      return;
    }
    setMessage({ tone: "success", text: text.t("editor.saved") });
    // Reload the row from the server, so `original` matches what was saved.
    router.refresh();
  }

  return { ctx, values, errors, saving, message, publish, save };
}

export type ContentEditorState = ReturnType<typeof useContentEditor>;

function isLocalized(field: FieldDef): boolean {
  return "localized" in field && field.localized;
}

/** The status select, the languages the row will show in, and why it can't be published. */
export function PublishPanel({ editor }: { editor: ContentEditorState }) {
  const text = useFieldText();
  const pageLocale = useLocale() as Locale;
  const { ctx, publish, values } = editor;
  const languages = new Intl.ListFormat(pageLocale, { type: "conjunction" }).format(
    publish.locales.map((locale) => text.t(`locales.${locale}`)),
  );
  const needsApproval = (CONSENT_CONTENT_TYPES as readonly string[]).includes(ctx.type);
  const approved = ctx.original?.adminApproved === true;
  const wantsPublish = values.status === "published";

  return (
    <Card as="section" compact aria-labelledby="publish-heading" className="space-y-4">
      <h2 id="publish-heading" className="text-lg">
        {text.t("editor.publishing")}
      </h2>
      <Select
        name="status"
        label={text.t("editor.statusLabel")}
        value={String(values.status)}
        onChange={(event) => ctx.setValue("status", event.target.value)}
      >
        {CONTENT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {text.t(`status.${status}`)}
          </option>
        ))}
      </Select>
      <p className="text-sm" aria-live="polite">
        {publish.locales.length > 0
          ? text.t("editor.availableIn", { languages })
          : text.t("editor.availableNone")}
      </p>
      {needsApproval && (
        <Badge tone={approved ? "strong" : "neutral"}>
          {approved ? text.t("editor.approved") : text.t("editor.notApproved")}
        </Badge>
      )}
      {wantsPublish && publish.problems.length > 0 && (
        <div className="rounded-md border border-danger p-3 text-sm">
          <p className="font-semibold text-danger">{text.t("editor.cantPublish")}</p>
          <ul className="mt-1 list-disc ps-5">
            {publish.problems.map((problem) => (
              <li key={problem}>{text.t(`editor.problems.${problem}`)}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** The save button and the result of the last save. */
export function EditorActions({ editor }: { editor: ContentEditorState }) {
  const text = useFieldText();
  const { message, saving } = editor;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Button type="submit" loading={saving} loadingLabel={text.t("editor.saving")}>
        {saving ? text.t("editor.saving") : text.t("editor.save")}
      </Button>
      <div aria-live="polite" className="min-w-0 flex-1">
        {message && (
          <div
            role={message.tone === "error" ? "alert" : "status"}
            className={
              message.tone === "error"
                ? "text-sm font-semibold text-danger"
                : "text-sm font-semibold"
            }
          >
            <p>{message.text}</p>
            {message.problems && (
              <ul className="mt-1 list-disc ps-5 font-normal">
                {message.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** A form section: the language tabs, then the other fields, then publishing. */
export function EditorForm({
  editor,
  children,
}: {
  editor: ContentEditorState;
  children: ReactNode;
}) {
  return (
    <form noValidate onSubmit={(event) => void editor.save(event)} className="space-y-6">
      {children}
      <PublishPanel editor={editor} />
      <EditorActions editor={editor} />
    </form>
  );
}

/**
 * The editor for plain-text types: every field from `CONTENT_CONFIG`, the
 * localized ones in the language tabs.
 */
export function GenericEditor(props: ContentEditorProps) {
  const text = useFieldText();
  const editor = useContentEditor(props);
  const { ctx, errors } = editor;
  const fields = CONTENT_CONFIG[props.type].fields;
  const localized = fields.filter(isLocalized);
  const others = fields.filter((field) => !isLocalized(field));

  const panel = (locale: Locale) => {
    const index = LOCALES.indexOf(locale);
    return {
      label: text.t(`locales.${locale}`),
      invalid: localized.some((field) => inputNames(field)[index] in errors),
      content: localized.map((field) => {
        const name = inputNames(field)[index];
        return <FieldInput key={name} field={field} name={name} ctx={ctx} />;
      }),
    };
  };

  return (
    <EditorForm editor={editor}>
      {localized.length > 0 && (
        <LanguageTabs
          label={text.t("editor.languageTabs")}
          invalidLabel={text.t("editor.invalidTab")}
          arabic={panel("ar")}
          english={panel("en")}
        />
      )}
      {others.length > 0 && (
        <Card as="section" compact aria-labelledby="other-heading" className="space-y-4">
          <h2 id="other-heading" className="text-lg">
            {text.t("editor.otherFields")}
          </h2>
          {others.map((field) => (
            <FieldInput key={field.name} field={field} name={field.name} ctx={ctx} />
          ))}
        </Card>
      )}
    </EditorForm>
  );
}
