"use client";

import {
  CONTENT_STATUSES,
  COURSE_TYPES,
  MAX_LONG_TEXT_LENGTH,
  MAX_SHORT_TEXT_LENGTH,
  type AdminCourse,
  type ContentStatus,
  type CourseType,
} from "@repo/shared";
import { useTranslations } from "next-intl";
import { useId, useState, type ChangeEvent, type FormEvent } from "react";
import { Button, FieldError, Label, LanguageTabs, Select, TextArea, TextField } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { useRouter } from "@/i18n/navigation";
import { CoursePreview } from "./course-preview";
import {
  courseProblems,
  courseValues,
  coursePagePath,
  createBody,
  SCHEDULED_TYPES,
  updateBody,
  type CourseField,
  type CourseValues,
} from "./format";
import { createCourse, updateCourse } from "./send";

/**
 * A time input styled as the kit's fields. `TextField` doesn't take
 * `type="time"`, and the kit is shared, so the field lives here.
 */
function TimeField({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type="time"
        value={value}
        onChange={onChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cx(
          "mt-1 block h-11 w-full border border-ink/50 bg-surface px-3 text-ink",
          "focus:outline-2 focus:outline-offset-1 focus:outline-focus aria-invalid:border-2 aria-invalid:border-danger",
        )}
      />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

type Notice = { ok: boolean; text: string };

/**
 * Adds a course (`POST /api/admin/courses`) or edits one (`PATCH`, only the
 * changed fields). Arabic and English fields sit in LanguageTabs; the
 * preview shows the unsaved values. The routes check `training.manage`;
 * showing this form is not the check. Every value is rendered as text.
 */
export function CourseForm({
  course,
  panelHeadingLevel = 3,
}: {
  course?: AdminCourse;
  /** The language panels' heading level: 2 when no h2 sits above the form. */
  panelHeadingLevel?: 2 | 3;
}) {
  const t = useTranslations("DashboardTraining.form");
  const tTypes = useTranslations("DashboardTraining.types");
  const tStatus = useTranslations("DashboardTraining.status");
  const router = useRouter();
  const [values, setValues] = useState<CourseValues>(() => courseValues(course));
  const [errors, setErrors] = useState<Partial<Record<CourseField, string>>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const registrations = course?.registrationCount ?? 0;
  // Publish/Unpublish elsewhere on the page changes the saved status. The form
  // isn't remounted for that (unsaved edits stay); it takes the new status, so
  // a later save doesn't undo the publish.
  const [savedStatus, setSavedStatus] = useState(course?.status);
  if (course && savedStatus !== course.status) {
    setSavedStatus(course.status);
    setValues((current) => ({ ...current, status: course.status }));
  }

  const scheduled = SCHEDULED_TYPES.includes(values.type);
  const recorded = values.type === "recorded";
  const online = values.type === "online_live";

  function set<Key extends keyof CourseValues>(key: Key) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value as CourseValues[Key];
      setValues((current) => ({ ...current, [key]: value }));
      // An edit clears that field's error (time problems show on the date),
      // and the "fix the marked fields" alert once none is left.
      const field = (key === "time" ? "date" : key) as CourseField;
      if (!errors[field]) return;
      const rest = { ...errors };
      delete rest[field];
      setErrors(rest);
      if (Object.keys(rest).length === 0) setNotice((shown) => (shown && !shown.ok ? null : shown));
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problems = courseProblems(values, registrations);
    const found = Object.fromEntries(
      Object.entries(problems).map(([field, problem]) => [field, t(`errors.${problem}`, { count: registrations })]),
    ) as Partial<Record<CourseField, string>>;
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setNotice({ ok: false, text: t("fixErrors") });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      if (!course) {
        const result = await createCourse(createBody(values));
        if (!result.ok) {
          setNotice({ ok: false, text: result.message ?? t("failed") });
          return;
        }
        router.push(coursePagePath(result.body.id));
        return;
      }
      const body = updateBody(course, values);
      if (!body) {
        setNotice({ ok: true, text: t("unchanged") });
        return;
      }
      const result = await updateCourse(body);
      if (!result.ok) {
        setNotice({ ok: false, text: result.message ?? t("failed") });
        return;
      }
      setNotice({ ok: true, text: t("saved") });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const arInvalid = Boolean(errors.titleAr || errors.descriptionAr);
  const enInvalid = Boolean(errors.titleEn || errors.descriptionEn);

  function languagePanel(suffix: "Ar" | "En") {
    return (
      <>
        <TextField
          label={t("title")}
          value={values[`title${suffix}`]}
          onChange={set(`title${suffix}`)}
          error={errors[`title${suffix}`]}
          maxLength={MAX_SHORT_TEXT_LENGTH}
        />
        <TextArea
          label={t("description")}
          value={values[`description${suffix}`]}
          onChange={set(`description${suffix}`)}
          error={errors[`description${suffix}`]}
          maxLength={MAX_LONG_TEXT_LENGTH}
          rows={6}
        />
        <TextArea
          label={t("audience")}
          hint={t("audienceHint")}
          value={values[`audience${suffix}`]}
          onChange={set(`audience${suffix}`)}
          maxLength={MAX_LONG_TEXT_LENGTH}
          rows={3}
        />
        {!recorded && !online && (
          <TextField
            label={t("place")}
            value={values[`place${suffix}`]}
            onChange={set(`place${suffix}`)}
            maxLength={MAX_SHORT_TEXT_LENGTH}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <form noValidate onSubmit={submit} className="space-y-6">
        {/* Locked while a save runs, so nothing typed meanwhile is lost. */}
        <fieldset disabled={busy} className="min-w-0 space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label={t("slug")}
              hint={t("slugHint")}
              dir="ltr"
              value={values.slug}
              onChange={set("slug")}
              error={errors.slug}
              maxLength={MAX_SHORT_TEXT_LENGTH}
              required
            />
            <Select label={t("type")} value={values.type} onChange={set("type")}>
              {COURSE_TYPES.map((type: CourseType) => (
                <option key={type} value={type}>
                  {tTypes(type)}
                </option>
              ))}
            </Select>
            <Select label={t("status")} hint={t("statusHint")} value={values.status} onChange={set("status")}>
              {CONTENT_STATUSES.map((status: ContentStatus) => (
                <option key={status} value={status}>
                  {tStatus(status)}
                </option>
              ))}
            </Select>
          </div>

          <LanguageTabs
            label={t("languages")}
            invalidLabel={t("hasErrors")}
            headingLevel={panelHeadingLevel}
            arabic={{ label: t("locales.ar"), content: languagePanel("Ar"), invalid: arInvalid }}
            english={{ label: t("locales.en"), content: languagePanel("En"), invalid: enInvalid }}
          />

          {recorded ? (
            <p className="text-sm text-ink-2">{t("recordedNote")}</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label={t("date")}
                hint={scheduled ? t("dateHint") : t("dateOptional")}
                type="date"
                value={values.date}
                onChange={set("date")}
                error={errors.date}
              />
              <TimeField label={t("time")} value={values.time} onChange={set("time")} />
              {online && (
                <TextField
                  label={t("onlineUrl")}
                  hint={t("onlineUrlHint")}
                  type="url"
                  dir="ltr"
                  inputMode="url"
                  value={values.onlineUrl}
                  onChange={set("onlineUrl")}
                  error={errors.onlineUrl}
                  maxLength={2048}
                />
              )}
              {scheduled && (
                <TextField
                  label={t("seats")}
                  hint={registrations > 0 ? t("seatsHintTaken", { count: registrations }) : t("seatsHint")}
                  type="number"
                  inputMode="numeric"
                  min={Math.max(1, registrations)}
                  step={1}
                  value={values.seats}
                  onChange={set("seats")}
                  error={errors.seats}
                />
              )}
            </div>
          )}
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={busy} loadingLabel={course ? t("saving") : t("creating")}>
            {course ? t("save") : t("create")}
          </Button>
          {notice && (
            <p
              role={notice.ok ? "status" : "alert"}
              className={cx("text-sm font-semibold", notice.ok ? "text-ink" : "text-danger")}
            >
              {notice.text}
            </p>
          )}
        </div>
      </form>

      <CoursePreview values={values} registrationCount={registrations} />
    </div>
  );
}
