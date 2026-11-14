"use client";

import { MAX_SHORT_TEXT_LENGTH, type Meeting } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useId, useState, type ChangeEvent, type FormEvent } from "react";
import { Button, Card, Label, TextField } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { MeetingCard } from "@/components/workspace";
import { useRouter } from "@/i18n/navigation";
import { createMeeting, updateMeeting } from "./send";

const pad = (value: number) => String(value).padStart(2, "0");

/** A UTC time as the `date` and `time` inputs show it, in the browser's zone. */
export function toLocalInputs(iso: string): { date: string; time: string } {
  const at = new Date(iso);
  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  };
}

/** The `date` and `time` inputs, read in the browser's zone, as UTC ISO 8601. Null when unreadable. */
export function toUtc(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const at = new Date(`${date}T${time}`);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

function isHttps(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * A time input styled as the kit's fields. `TextField` doesn't take
 * `type="time"`, and the kit is shared, so the field lives here.
 */
function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type="time"
        required
        value={value}
        onChange={onChange}
        className={cx(
          "mt-1 block h-11 w-full rounded-md border border-text/50 bg-surface px-3 text-text",
          "focus:outline-2 focus:outline-offset-1 focus:outline-ring",
        )}
      />
    </div>
  );
}

type Fields = { platform: string; url: string; date: string; time: string; duration: string };

/**
 * The meeting form (§6.17): platform, https link, date, time, duration. The
 * member types in their own zone, which is named; it is stored in UTC. It
 * opens only after a click, so it always runs in the browser.
 */
export function MeetingForm({
  consultationId,
  meeting,
  onDone,
  create = createMeeting,
  update = updateMeeting,
}: {
  consultationId: string;
  /** Editing this meeting; without it, a new one. */
  meeting?: Meeting;
  onDone: () => void;
  create?: typeof createMeeting;
  update?: typeof updateMeeting;
}) {
  const t = useTranslations("DashboardConsultations.meeting");
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(() => ({
    platform: meeting?.platform ?? "",
    url: meeting?.url ?? "",
    ...(meeting ? toLocalInputs(meeting.startsAt) : { date: "", time: "" }),
    duration: meeting ? String(meeting.durationMinutes) : "60",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const set = (key: keyof Fields) => (event: { target: { value: string } }) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const platform = fields.platform.trim();
    const url = fields.url.trim();
    // Unchanged date and time keep the stored start, to the second: editing
    // only the link never moves the meeting.
    const initial = meeting ? toLocalInputs(meeting.startsAt) : null;
    const startsAt =
      meeting && initial && initial.date === fields.date && initial.time === fields.time
        ? meeting.startsAt
        : toUtc(fields.date, fields.time);
    const durationMinutes = Number(fields.duration);
    if (!platform || !url || !startsAt || !fields.duration) return setError(t("required"));
    if (!isHttps(url)) return setError(t("invalidUrl"));
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) return setError(t("invalidDuration"));

    setBusy(true);
    setError(null);
    const body = { platform, url, startsAt, durationMinutes };
    const result = meeting
      ? await update(consultationId, { meetingId: meeting.id, ...body })
      : await create(consultationId, body);
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? t("failed"));
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <Card as="section" compact aria-label={meeting ? t("editTitle") : t("addTitle")}>
      <form noValidate onSubmit={submit} className="space-y-4">
        <h3 className="text-lg">{meeting ? t("editTitle") : t("addTitle")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t("platform")}
            hint={t("platformHint")}
            value={fields.platform}
            onChange={set("platform")}
            maxLength={MAX_SHORT_TEXT_LENGTH}
            required
          />
          <TextField
            label={t("url")}
            hint={t("urlHint")}
            type="url"
            dir="ltr"
            value={fields.url}
            onChange={set("url")}
            required
          />
          <TextField label={t("date")} type="date" value={fields.date} onChange={set("date")} required />
          <TimeField label={t("time")} value={fields.time} onChange={set("time")} />
          <TextField
            label={t("duration")}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={fields.duration}
            onChange={set("duration")}
            required
          />
        </div>
        <p className="text-sm text-text-secondary">{t("zone", { zone })}</p>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={busy} loadingLabel={t("saving")}>
            {t("save")}
          </Button>
          <Button variant="quiet" onClick={onDone} disabled={busy}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * The consultation's meetings, in the viewer's zone (zone named), with Add
 * and Edit when the member may work on it and it isn't closed.
 */
export function Meetings({
  consultationId,
  meetings,
  editable,
}: {
  consultationId: string;
  meetings: Meeting[];
  editable: boolean;
}) {
  const t = useTranslations("DashboardConsultations");
  // "new", a meeting id being edited, or nothing.
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {meetings.length === 0 && open !== "new" && (
        <p className="text-sm text-text-secondary">{t("detail.noMeetings")}</p>
      )}
      {meetings.map((meeting) =>
        open === meeting.id ? (
          <MeetingForm key={meeting.id} consultationId={consultationId} meeting={meeting} onDone={() => setOpen(null)} />
        ) : (
          <MeetingCard
            key={meeting.id}
            platform={meeting.platform}
            url={meeting.url}
            startsAt={meeting.startsAt}
            durationMinutes={meeting.durationMinutes}
            actions={
              editable && (
                <Button variant="secondary" size="sm" onClick={() => setOpen(meeting.id)}>
                  {t("meeting.edit")}
                </Button>
              )
            }
          />
        ),
      )}
      {editable &&
        (open === "new" ? (
          <MeetingForm consultationId={consultationId} onDone={() => setOpen(null)} />
        ) : (
          <Button variant="secondary" onClick={() => setOpen("new")}>
            {t("meeting.add")}
          </Button>
        ))}
    </div>
  );
}
