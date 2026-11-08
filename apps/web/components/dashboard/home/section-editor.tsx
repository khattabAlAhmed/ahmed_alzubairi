"use client";

import type { HomeSectionKey, Locale } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useMemo, useState, type FormEvent } from "react";
import { LanguageTabs, TextArea, TextField } from "@/components/ui";
import {
  EditorActions,
  PublishPanel,
  type ContentEditorState,
} from "../content/content-editor";
import { isolate, useFieldText, type FieldContext } from "../content/field-text";
import type { Row } from "../content/form-values";
import { saveContent } from "../content/save";
import { UploadInput } from "../content/upload-input";
import { useRouter } from "@/i18n/navigation";
import {
  buildSection,
  inputName,
  sectionFields,
  sectionPublishState,
  sectionValues,
  type SectionErrors,
  type SectionField,
  type SectionValues,
} from "./section-content";

const PHOTO_FIELD = { name: "imageKey", kind: "image", target: "media" } as const;

/**
 * One home section's form. Its state has the shape of `useContentEditor`'s, so
 * it shares the publish panel (where P2P-T16 adds the preview) and the save
 * actions with every other content editor. It saves through the content API.
 */
function useSectionEditor(
  key: HomeSectionKey,
  row: Row,
  mediaBase: string,
): ContentEditorState & { content: SectionValues; setContent: (next: SectionValues) => void } {
  const text = useFieldText();
  const router = useRouter();
  const [content, setContentState] = useState<SectionValues>(() => sectionValues(key, row));
  const [status, setStatus] = useState(String(row.status ?? "draft"));
  const [errors, setErrors] = useState<SectionErrors>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<ContentEditorState["message"]>(null);

  const publish = useMemo(
    () => sectionPublishState(key, content, status, row),
    [key, content, status, row],
  );

  const values: Row = { status };
  const ctx: FieldContext = {
    type: "home_sections",
    values,
    original: row,
    errors: {},
    refOptions: {},
    mediaBase,
    requiredNames: new Set(),
    setValue: (name, value) => {
      if (name === "status") setStatus(String(value));
    },
  };

  function setContent(next: SectionValues) {
    setContentState(next);
    setErrors((current) => (Object.keys(current).length === 0 ? current : {}));
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (saving) return;
    const built = buildSection(key, content, status, row);
    setErrors(built.errors);
    if (Object.keys(built.errors).length > 0) {
      setMessage({ tone: "error", text: text.t("editor.fixErrors") });
      return;
    }
    if (status === "published" && publish.problems.length > 0) {
      setMessage({
        tone: "error",
        text: text.t("editor.cantPublish"),
        problems: publish.problems.map((problem) => text.t(`editor.problems.${problem}`)),
      });
      return;
    }
    setSaving(true);
    setMessage(null);
    const result = await saveContent("home_sections", built.body, false);
    setSaving(false);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.message ?? text.t("editor.networkError") });
      return;
    }
    setMessage({ tone: "success", text: text.t("editor.saved") });
    router.refresh();
  }

  return {
    ctx,
    values,
    errors,
    saving,
    message,
    publish,
    save,
    content,
    setContent,
  };
}

export function SectionEditor({
  sectionKey,
  row,
  mediaBase,
}: {
  sectionKey: HomeSectionKey;
  row: Row;
  mediaBase: string;
}) {
  const t = useTranslations("DashboardHome");
  const text = useFieldText();
  const editor = useSectionEditor(sectionKey, row, mediaBase);
  const { content, setContent, errors } = editor;
  const fields = sectionFields(sectionKey);

  const input = (locale: Locale, field: SectionField) => {
    const name = inputName(locale, field.path);
    const problem = errors[name];
    const props = {
      name,
      label: isolate(t(`fields.${field.label}`) + (field.required ? ` ${text.t("editor.requiredMark")}` : "")),
      value: content[locale][field.path] ?? "",
      error: problem ? isolate(text.t(`editor.${problem}`)) : undefined,
      onChange: (event: { target: { value: string } }) =>
        setContent({ ...content, [locale]: { ...content[locale], [field.path]: event.target.value } }),
    };
    return field.long ? <TextArea key={name} rows={3} {...props} /> : <TextField key={name} {...props} />;
  };

  const panel = (locale: Locale) => {
    const own = fields.filter((field) => field.item === undefined);
    const items = [...new Set(fields.flatMap((field) => (field.item === undefined ? [] : [field.item])))];
    return {
      label: text.t(`locales.${locale}`),
      invalid: Object.keys(errors).some((name) => name.startsWith(`${locale}.`)),
      content: (
        <div className="space-y-4">
          {own.map((field) => input(locale, field))}
          {items.length > 0 && <p className="text-sm text-text-secondary">{isolate(t("fields.audiencesHint"))}</p>}
          {items.map((item) => (
            <fieldset key={item} className="space-y-3 rounded-md border border-text/10 p-3">
              <legend className="px-1 text-sm font-semibold">
                {isolate(t("fields.audience", { number: item + 1 }))}
              </legend>
              {fields.filter((field) => field.item === item).map((field) => input(locale, field))}
            </fieldset>
          ))}
        </div>
      ),
    };
  };

  // The photo goes through the shared upload input, on a one-field context.
  const photoCtx: FieldContext = {
    ...editor.ctx,
    values: { imageKey: content.photoKey },
    original: { imageKey: sectionValues(sectionKey, row).photoKey },
    setValue: (_name, value) => setContent({ ...content, photoKey: String(value ?? "") }),
  };

  return (
    <form noValidate onSubmit={(event) => void editor.save(event)} className="mt-4 space-y-6">
      {sectionKey !== "hero" && <p className="text-sm text-text-secondary">{t("sections.rowsNote")}</p>}
      <LanguageTabs
        label={text.t("editor.languageTabs")}
        invalidLabel={text.t("editor.invalidTab")}
        arabic={panel("ar")}
        english={panel("en")}
      />
      {sectionKey === "hero" && (
        <div className="space-y-1">
          <UploadInput field={PHOTO_FIELD} name="imageKey" ctx={photoCtx} />
          <p className="text-sm text-text-secondary">{t("fields.photoHint")}</p>
        </div>
      )}
      <PublishPanel editor={editor} />
      <EditorActions editor={editor} />
    </form>
  );
}
