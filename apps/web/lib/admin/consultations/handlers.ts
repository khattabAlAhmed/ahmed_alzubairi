import {
  createMeetingRequestSchema,
  isIanaTimeZone,
  PERMISSIONS,
  updateConsultationRequestSchema,
  updateMeetingRequestSchema,
  uuidSchema,
  type Consultation,
  type IdResponse,
  type Locale,
  type Meeting,
  type OkResponse,
} from "@repo/shared";
import type { AuditEntry } from "@/lib/admin/audit";
import type { queueEmail } from "@/lib/email/queue";
import { baseFail, ownFail, type Failure, type Result } from "./errors";
import type { AdminConsultationStore, MeetingFields } from "./store";

export type AdminConsultationDeps = {
  locale: Locale;
  /** The signed-in user from the session, or null. */
  userId: string | null;
  store: AdminConsultationStore;
  /** lib/email/queue.ts, behind an interface so tests can replace it. */
  queueEmail: typeof queueEmail;
  audit: (entry: AuditEntry) => Promise<void>;
};

/** Logs what failed and a code only: never an address, a name or a link. */
function logFailure(what: string, error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  console.error(`admin consultations: ${what} failed (${typeof code === "string" ? code : "error"})`);
}

/** The recipient's saved zone, or UTC when it isn't a real IANA zone. */
export function zoneOf(timezone: string): string {
  return isIanaTimeZone(timezone) ? timezone : "UTC";
}

/**
 * True when the member may work on this consultation as its consultant:
 * `consultations.view_all`, or `consultations.reply` on one assigned to them.
 */
async function mayWorkOn(
  consultation: Consultation,
  userId: string,
  store: AdminConsultationStore,
): Promise<boolean> {
  const [viewAll, reply] = await Promise.all([
    store.hasPermission(PERMISSIONS.CONSULTATIONS_VIEW_ALL),
    store.hasPermission(PERMISSIONS.CONSULTATIONS_REPLY),
  ]);
  return viewAll || (reply && consultation.assignedTo === userId);
}

/** The consultation RLS shows the member, or the error to return. */
async function visibleConsultation(
  id: string,
  { locale, store }: AdminConsultationDeps,
): Promise<Consultation | Failure> {
  if (!uuidSchema.safeParse(id).success) return ownFail("not_found", 404, "notFound", locale);
  const consultation = await store.get(id);
  return consultation ?? ownFail("not_found", 404, "notFound", locale);
}

const isFailure = (value: unknown): value is Failure =>
  typeof value === "object" && value !== null && "body" in value && "status" in value;

/**
 * `PATCH /api/admin/consultations/:id` (§8). A status change needs
 * `consultations.reply` on an assigned consultation or `consultations.view_all`;
 * an assignment needs `consultations.assign`, and the assignee must be an
 * active member holding `consultations.reply`. Every check runs before any
 * write. Closing sets `closed_at`; a closed consultation is never reopened.
 * Each change is written to the audit log; an assignment emails the assignee
 * and adds a dashboard notification.
 */
export async function updateConsultation(
  id: string,
  body: unknown,
  deps: AdminConsultationDeps,
): Promise<Result<OkResponse>> {
  const { locale, userId, store } = deps;
  if (!userId) return baseFail("unauthenticated", 401, locale);
  const parsed = updateConsultationRequestSchema.safeParse(body);
  const consultation = await visibleConsultation(id, deps);
  if (isFailure(consultation)) return consultation;
  if (!parsed.success) return baseFail("validation_failed", 400, locale);
  const { status, assignedTo } = parsed.data;
  // The values before this request, for the CAS writes and the audit.
  const before = { status: consultation.status, assignedTo: consultation.assignedTo };

  if (status !== undefined && !(await mayWorkOn(consultation, userId, store))) {
    return ownFail("forbidden", 403, "statusForbidden", locale);
  }
  if (assignedTo !== undefined && !(await store.hasPermission(PERMISSIONS.CONSULTATIONS_ASSIGN))) {
    return ownFail("forbidden", 403, "assignForbidden", locale);
  }

  const statusChanges = status !== undefined && status !== before.status;
  const assigneeChanges = assignedTo !== undefined && assignedTo !== before.assignedTo;
  if (statusChanges && before.status === "closed") {
    return ownFail("conflict", 409, "reopenRefused", locale);
  }
  if (assigneeChanges && assignedTo !== null && !(await store.isEligibleAssignee(assignedTo))) {
    return ownFail("validation_failed", 400, "assigneeInvalid", locale);
  }

  if (statusChanges) {
    if (!(await store.setStatus(id, before.status, status))) {
      return ownFail("conflict", 409, "changedMeanwhile", locale);
    }
    await deps.audit({
      actorId: userId,
      action: "consultation.status",
      entity: "consultations",
      entityId: id,
      metadata: { from: before.status, to: status },
    });
  }

  if (assigneeChanges) {
    if (!(await store.setAssignee(id, before.assignedTo, assignedTo))) {
      return ownFail("conflict", 409, "changedMeanwhile", locale);
    }
    await deps.audit({
      actorId: userId,
      action: "consultation.assign",
      entity: "consultations",
      entityId: id,
      metadata: { from: before.assignedTo, to: assignedTo },
    });
    if (assignedTo !== null) await notifyAssignee(consultation, assignedTo, deps);
  }

  return { status: 200, body: { ok: true } };
}

/** `consultation_assigned` to the new assignee, plus a dashboard notification. Never throws. */
async function notifyAssignee(
  consultation: Consultation,
  assigneeId: string,
  { store, queueEmail }: AdminConsultationDeps,
) {
  try {
    const assignee = await store.recipient(assigneeId);
    if (!assignee) return;
    const queued = await queueEmail({
      event: "consultation_assigned",
      to: { email: assignee.email, locale: assignee.locale },
      payload: { consultationId: consultation.id, title: consultation.title },
    });
    if (queued) {
      await store.notify({ userId: assigneeId, type: "consultation_assigned", consultationId: consultation.id });
    }
  } catch (error) {
    logFailure("assignment email", error);
  }
}

/**
 * The `meeting` email to the client, in their language and saved zone. The
 * sender attaches the `.ics` (lib/email/meeting-ics.ts). Never throws.
 */
async function emailMeeting(
  consultation: Consultation,
  meeting: Meeting,
  { store, queueEmail }: AdminConsultationDeps,
) {
  try {
    const client = await store.recipient(consultation.clientId);
    if (!client) return;
    await queueEmail({
      event: "meeting",
      to: { email: client.email, locale: client.locale },
      payload: {
        consultationId: consultation.id,
        title: consultation.title,
        platform: meeting.platform,
        url: meeting.url,
        startsAt: meeting.startsAt,
        timezone: zoneOf(client.timezone),
      },
    });
  } catch (error) {
    logFailure("meeting email", error);
  }
}

/** The checks both meeting routes share. The consultation, or the error to return. */
async function meetingAccess(
  id: string,
  deps: AdminConsultationDeps & { userId: string },
): Promise<Consultation | Failure> {
  const consultation = await visibleConsultation(id, deps);
  if (isFailure(consultation)) return consultation;
  if (!(await mayWorkOn(consultation, deps.userId, deps.store))) {
    return ownFail("forbidden", 403, "meetingForbidden", deps.locale);
  }
  if (consultation.status === "closed") return ownFail("conflict", 409, "closed", deps.locale);
  return consultation;
}

/**
 * `POST /api/admin/consultations/:id/meetings`: `consultations.reply` on an
 * assigned consultation, or `consultations.view_all`. Stores the meeting
 * (times in UTC), moves the consultation to `scheduled`, audits, and emails
 * the client with the calendar file.
 */
export async function createMeeting(
  id: string,
  body: unknown,
  deps: AdminConsultationDeps,
): Promise<Result<IdResponse>> {
  const { locale, userId, store } = deps;
  if (!userId) return baseFail("unauthenticated", 401, locale);
  const consultation = await meetingAccess(id, { ...deps, userId });
  if (isFailure(consultation)) return consultation;
  const parsed = createMeetingRequestSchema.safeParse(body);
  if (!parsed.success) return baseFail("validation_failed", 400, locale);

  const meeting = await store.createMeeting(id, {
    ...parsed.data,
    startsAt: new Date(parsed.data.startsAt).toISOString(),
  });
  await deps.audit({
    actorId: userId,
    action: "meeting.create",
    entity: "meetings",
    entityId: meeting.id,
    metadata: { consultationId: id },
  });
  const statusBefore = consultation.status;
  if (statusBefore !== "scheduled") {
    if (await store.setStatus(id, statusBefore, "scheduled")) {
      await deps.audit({
        actorId: userId,
        action: "consultation.status",
        entity: "consultations",
        entityId: id,
        metadata: { from: statusBefore, to: "scheduled" },
      });
    }
  }
  await emailMeeting(consultation, meeting, deps);
  return { status: 201, body: { id: meeting.id } };
}

/**
 * `PATCH /api/admin/consultations/:id/meetings`: the same permission. Writes
 * the changed fields, audits which ones, and emails the client the new details
 * with an updated calendar file (same UID, higher SEQUENCE). A request that
 * changes nothing writes and sends nothing.
 */
export async function updateMeeting(
  id: string,
  body: unknown,
  deps: AdminConsultationDeps,
): Promise<Result<OkResponse>> {
  const { locale, userId, store } = deps;
  if (!userId) return baseFail("unauthenticated", 401, locale);
  const consultation = await meetingAccess(id, { ...deps, userId });
  if (isFailure(consultation)) return consultation;
  const parsed = updateMeetingRequestSchema.safeParse(body);
  if (!parsed.success) return baseFail("validation_failed", 400, locale);

  const { meetingId, ...fields } = parsed.data;
  const current = await store.getMeeting(meetingId, id);
  if (!current) return ownFail("not_found", 404, "meetingNotFound", locale);

  const wanted: Partial<MeetingFields> = {
    ...fields,
    ...(fields.startsAt !== undefined ? { startsAt: new Date(fields.startsAt).toISOString() } : {}),
  };
  const changes = Object.fromEntries(
    Object.entries(wanted).filter(
      ([key, value]) => value !== undefined && value !== current[key as keyof MeetingFields],
    ),
  ) as Partial<MeetingFields>;
  if (Object.keys(changes).length === 0) return { status: 200, body: { ok: true } };

  const updated = await store.updateMeeting(meetingId, id, changes);
  if (!updated) return ownFail("not_found", 404, "meetingNotFound", locale);
  await deps.audit({
    actorId: userId,
    action: "meeting.update",
    entity: "meetings",
    entityId: meetingId,
    metadata: { consultationId: id, fields: Object.keys(changes).sort() },
  });
  await emailMeeting(consultation, updated, deps);
  return { status: 200, body: { ok: true } };
}
