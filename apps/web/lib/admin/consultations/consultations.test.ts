import { PERMISSIONS, type Consultation, type Meeting, type Permission } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en/AdminConsultationErrors.json";
import { createMeeting, updateConsultation, updateMeeting, zoneOf } from "./handlers";
import { sendMeetingReminders, type DueMeeting, type ReminderDb } from "./reminders";
import type { AdminConsultationStore, Recipient } from "./store";

vi.mock("server-only", () => ({}));

const ID = "11111111-1111-4111-8111-111111111111";
const UNASSIGNED = "22222222-2222-4222-8222-222222222222";
const CLOSED = "33333333-3333-4333-8333-333333333333";
const MEETING = "44444444-4444-4444-8444-444444444444";
const NEW_MEETING = "55555555-5555-4555-8555-555555555555";

const ADMIN = "user_admin";
const ASSISTANT = "user_assistant";
const ASSISTANT_2 = "user_assistant_2";
const EDITOR = "user_editor";
const CLIENT = "user_client";
const DISABLED_ASSISTANT = "user_assistant_disabled";

const PERMS: Record<string, Permission[]> = {
  [ADMIN]: Object.values(PERMISSIONS),
  [ASSISTANT]: [PERMISSIONS.CONSULTATIONS_REPLY],
  [ASSISTANT_2]: [PERMISSIONS.CONSULTATIONS_REPLY],
  [EDITOR]: [PERMISSIONS.CONTENT_MANAGE],
};

const PEOPLE: Record<string, Recipient> = {
  [CLIENT]: { email: "client@example.invalid", locale: "ar", timezone: "Asia/Riyadh", notifyOptional: true, active: true },
  [ASSISTANT]: { email: "assistant@example.invalid", locale: "en", timezone: "Europe/London", notifyOptional: true, active: true },
  [ASSISTANT_2]: { email: "assistant2@example.invalid", locale: "en", timezone: "not/a-zone", notifyOptional: true, active: true },
};

function consultation(id: string, over: Partial<Consultation> = {}): Consultation {
  return {
    id,
    kind: "consultation",
    clientId: CLIENT,
    serviceId: null,
    title: "Test consultation",
    description: "Fake",
    organization: null,
    status: "in_review",
    assignedTo: ASSISTANT,
    firstReplyAt: null,
    closedAt: null,
    createdAt: "2026-11-14T10:00:00.000Z",
    ...over,
  };
}

function world(viewer: string | null) {
  const rows = [consultation(ID), consultation(UNASSIGNED, { assignedTo: null, status: "new" }), consultation(CLOSED, { status: "closed" })];
  const meetings: (Meeting & { consultationId: string })[] = [
    { id: MEETING, consultationId: ID, platform: "Zoom", url: "https://example.invalid/m1", startsAt: "2026-11-20T09:00:00.000Z", durationMinutes: 45, createdAt: "2026-11-14T10:00:00.000Z" },
  ];
  // RLS: assigned to the viewer, or everything with view_all.
  const visible = (item: Consultation) =>
    viewer !== null && (item.assignedTo === viewer || (PERMS[viewer] ?? []).includes(PERMISSIONS.CONSULTATIONS_VIEW_ALL));
  const writes: string[] = [];
  const notifications: unknown[] = [];

  const store: AdminConsultationStore = {
    get: vi.fn(async (id: string) => rows.find((row) => row.id === id && visible(row)) ?? null),
    hasPermission: vi.fn(async (key: Permission) => (viewer ? (PERMS[viewer] ?? []).includes(key) : false)),
    notify: vi.fn(async (row) => {
      notifications.push(row);
    }),
    recipient: vi.fn(async (userId: string) => PEOPLE[userId] ?? null),
    isEligibleAssignee: vi.fn(async (userId: string) => (PERMS[userId] ?? []).includes(PERMISSIONS.CONSULTATIONS_REPLY) && userId !== DISABLED_ASSISTANT),
    setStatus: vi.fn(async (id, from, to) => {
      const row = rows.find((item) => item.id === id && item.status === from);
      if (!row) return false;
      row.status = to;
      if (to === "closed") row.closedAt = "2026-11-14T12:00:00.000Z";
      writes.push(`status:${to}`);
      return true;
    }),
    setAssignee: vi.fn(async (id, from, to) => {
      const row = rows.find((item) => item.id === id && item.assignedTo === from);
      if (!row) return false;
      row.assignedTo = to;
      writes.push(`assign:${to}`);
      return true;
    }),
    createMeeting: vi.fn(async (consultationId, fields) => {
      const meeting = { id: NEW_MEETING, consultationId, ...fields, createdAt: "2026-11-14T12:00:00.000Z" };
      meetings.push(meeting);
      writes.push("meeting");
      const { consultationId: _ignored, ...rest } = meeting;
      void _ignored;
      return rest;
    }),
    getMeeting: vi.fn(async (meetingId, consultationId) => {
      const found = meetings.find((item) => item.id === meetingId && item.consultationId === consultationId);
      return found ? { id: found.id, platform: found.platform, url: found.url, startsAt: found.startsAt, durationMinutes: found.durationMinutes, createdAt: found.createdAt } : null;
    }),
    updateMeeting: vi.fn(async (meetingId, consultationId, changes) => {
      const found = meetings.find((item) => item.id === meetingId && item.consultationId === consultationId);
      if (!found) return null;
      Object.assign(found, changes);
      writes.push(`meeting-update:${Object.keys(changes).sort().join(",")}`);
      return { id: found.id, platform: found.platform, url: found.url, startsAt: found.startsAt, durationMinutes: found.durationMinutes, createdAt: found.createdAt };
    }),
  };
  const emails: { event: string; to: string; locale: string; payload: Record<string, unknown> }[] = [];
  const queueEmail = vi.fn(async ({ event, to, payload }: { event: string; to: { email: string; locale: string }; payload: unknown }) => {
    emails.push({ event, to: to.email, locale: to.locale, payload: payload as Record<string, unknown> });
    return true;
  });
  const audit = vi.fn(async () => {});
  const deps = { locale: "en" as const, userId: viewer, store, queueEmail: queueEmail as never, audit };
  return { rows, meetings, writes, notifications, emails, audit, deps };
}

const auditActions = (w: ReturnType<typeof world>) =>
  (w.audit.mock.calls as unknown as [{ action: string; metadata?: unknown }][]).map(([entry]) => entry.action);

describe("PATCH /api/admin/consultations/:id", () => {
  it("refuses a signed-out caller", async () => {
    const w = world(null);
    expect((await updateConsultation(ID, { status: "in_progress" }, w.deps)).status).toBe(401);
    expect(w.writes).toEqual([]);
  });

  it("the assigned assistant changes the status, audited", async () => {
    const w = world(ASSISTANT);
    expect(await updateConsultation(ID, { status: "in_progress" }, w.deps)).toEqual({ status: 200, body: { ok: true } });
    expect(w.rows[0]!.status).toBe("in_progress");
    expect(w.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "consultation.status", entity: "consultations", entityId: ID, metadata: { from: "in_review", to: "in_progress" } }),
    );
  });

  it("an assistant can't touch an unassigned consultation (RLS: 404)", async () => {
    const w = world(ASSISTANT);
    expect((await updateConsultation(UNASSIGNED, { status: "in_progress" }, w.deps)).status).toBe(404);
    expect(w.writes).toEqual([]);
  });

  it("a member who sees it without reply or view_all can't change the status", async () => {
    const w = world(EDITOR);
    w.rows[0]!.assignedTo = EDITOR;
    expect(await updateConsultation(ID, { status: "closed" }, w.deps)).toEqual({
      status: 403,
      body: { error: { code: "forbidden", message: en.statusForbidden } },
    });
    expect(w.writes).toEqual([]);
  });

  it("a member without consultations.assign can't assign, even their own", async () => {
    const w = world(ASSISTANT);
    expect(await updateConsultation(ID, { assignedTo: ASSISTANT_2 }, w.deps)).toEqual({
      status: 403,
      body: { error: { code: "forbidden", message: en.assignForbidden } },
    });
    expect(w.writes).toEqual([]);
  });

  it.each([
    ["a member without consultations.reply", EDITOR],
    ["a disabled member", DISABLED_ASSISTANT],
    ["a client", CLIENT],
  ])("refuses %s as the assignee", async (_label, assignee) => {
    const w = world(ADMIN);
    expect(await updateConsultation(UNASSIGNED, { assignedTo: assignee }, w.deps)).toEqual({
      status: 400,
      body: { error: { code: "validation_failed", message: en.assigneeInvalid } },
    });
    expect(w.writes).toEqual([]);
    expect(w.emails).toEqual([]);
  });

  it("assigning emails the assignee and adds their notification, audited", async () => {
    const w = world(ADMIN);
    expect((await updateConsultation(UNASSIGNED, { assignedTo: ASSISTANT }, w.deps)).status).toBe(200);
    expect(w.rows[1]!.assignedTo).toBe(ASSISTANT);
    expect(w.emails).toEqual([
      { event: "consultation_assigned", to: "assistant@example.invalid", locale: "en", payload: { consultationId: UNASSIGNED, title: "Test consultation" } },
    ]);
    expect(w.notifications).toEqual([{ userId: ASSISTANT, type: "consultation_assigned", consultationId: UNASSIGNED }]);
    expect(w.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "consultation.assign", metadata: { from: null, to: ASSISTANT } }));
  });

  it("unassigning sends nothing", async () => {
    const w = world(ADMIN);
    expect((await updateConsultation(ID, { assignedTo: null }, w.deps)).status).toBe(200);
    expect(w.rows[0]!.assignedTo).toBeNull();
    expect(w.emails).toEqual([]);
  });

  it("closing sets closed_at", async () => {
    const w = world(ADMIN);
    await updateConsultation(ID, { status: "closed" }, w.deps);
    expect(w.rows[0]).toMatchObject({ status: "closed", closedAt: "2026-11-14T12:00:00.000Z" });
  });

  it("refuses to reopen a closed consultation, and writes nothing", async () => {
    const w = world(ADMIN);
    expect(await updateConsultation(CLOSED, { status: "in_progress" }, w.deps)).toEqual({
      status: 409,
      body: { error: { code: "conflict", message: en.reopenRefused } },
    });
    expect(w.writes).toEqual([]);
  });

  it("checks every permission before writing anything", async () => {
    const w = world(ASSISTANT);
    // The status part is allowed, the assignment isn't: nothing is written.
    expect((await updateConsultation(ID, { status: "in_progress", assignedTo: ASSISTANT_2 }, w.deps)).status).toBe(403);
    expect(w.writes).toEqual([]);
  });

  it("the same values change nothing and audit nothing", async () => {
    const w = world(ADMIN);
    expect((await updateConsultation(ID, { status: "in_review", assignedTo: ASSISTANT }, w.deps)).status).toBe(200);
    expect(w.writes).toEqual([]);
    expect(w.audit).not.toHaveBeenCalled();
  });

  it("answers 409 when the status changed meanwhile", async () => {
    const w = world(ADMIN);
    (w.deps.store.setStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    expect((await updateConsultation(ID, { status: "in_progress" }, w.deps)).status).toBe(409);
    expect(w.audit).not.toHaveBeenCalled();
  });

  it("refuses an empty body", async () => {
    const w = world(ADMIN);
    expect((await updateConsultation(ID, {}, w.deps)).status).toBe(400);
  });
});

const NEW_MEETING_BODY = {
  platform: "Google Meet",
  url: "https://meet.example.invalid/abc",
  startsAt: "2026-11-21T13:30:00.000Z",
  durationMinutes: 60,
};

describe("meetings", () => {
  it("refuses a signed-out caller", async () => {
    const w = world(null);
    expect((await createMeeting(ID, NEW_MEETING_BODY, w.deps)).status).toBe(401);
  });

  it("the assigned assistant adds a meeting: scheduled, audited, emailed in the client's zone and language", async () => {
    const w = world(ASSISTANT);
    expect(await createMeeting(ID, NEW_MEETING_BODY, w.deps)).toEqual({ status: 201, body: { id: NEW_MEETING } });
    expect(w.rows[0]!.status).toBe("scheduled");
    expect(auditActions(w)).toEqual(["meeting.create", "consultation.status"]);
    expect(w.emails).toEqual([
      {
        event: "meeting",
        to: "client@example.invalid",
        locale: "ar",
        payload: { consultationId: ID, title: "Test consultation", platform: NEW_MEETING_BODY.platform, url: NEW_MEETING_BODY.url, startsAt: NEW_MEETING_BODY.startsAt, timezone: "Asia/Riyadh" },
      },
    ]);
    // Exactly the fields lib/email/meeting-ics.ts finds the meeting by.
    expect(w.meetings.find((item) => item.id === NEW_MEETING)).toMatchObject({ startsAt: NEW_MEETING_BODY.startsAt, url: NEW_MEETING_BODY.url });
  });

  it("an assistant can't add one to an unassigned consultation", async () => {
    const w = world(ASSISTANT);
    expect((await createMeeting(UNASSIGNED, NEW_MEETING_BODY, w.deps)).status).toBe(404);
    expect(w.writes).toEqual([]);
  });

  it("a member who sees it without reply or view_all can't add one", async () => {
    const w = world(EDITOR);
    w.rows[0]!.assignedTo = EDITOR;
    expect(await createMeeting(ID, NEW_MEETING_BODY, w.deps)).toEqual({
      status: 403,
      body: { error: { code: "forbidden", message: en.meetingForbidden } },
    });
    expect(w.writes).toEqual([]);
  });

  it("view_all may add one to any consultation", async () => {
    const w = world(ADMIN);
    expect((await createMeeting(UNASSIGNED, NEW_MEETING_BODY, w.deps)).status).toBe(201);
  });

  it("refuses a closed consultation", async () => {
    const w = world(ADMIN);
    expect((await createMeeting(CLOSED, NEW_MEETING_BODY, w.deps)).status).toBe(409);
    expect(w.writes).toEqual([]);
  });

  it("refuses a link that isn't https", async () => {
    const w = world(ADMIN);
    expect((await createMeeting(ID, { ...NEW_MEETING_BODY, url: "http://meet.example.invalid/abc" }, w.deps)).status).toBe(400);
    expect(w.writes).toEqual([]);
  });

  it("editing the link writes it, audits the field, and queues a second email", async () => {
    const w = world(ASSISTANT);
    const result = await updateMeeting(ID, { meetingId: MEETING, url: "https://example.invalid/m2" }, w.deps);
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(w.writes).toEqual(["meeting-update:url"]);
    expect(w.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "meeting.update", entity: "meetings", entityId: MEETING, metadata: { consultationId: ID, fields: ["url"] } }),
    );
    expect(w.emails.map((email) => [email.event, email.payload.url])).toEqual([["meeting", "https://example.invalid/m2"]]);
  });

  it("an edit that changes nothing writes and sends nothing", async () => {
    const w = world(ASSISTANT);
    expect((await updateMeeting(ID, { meetingId: MEETING, url: "https://example.invalid/m1" }, w.deps)).status).toBe(200);
    expect(w.writes).toEqual([]);
    expect(w.emails).toEqual([]);
  });

  it("refuses a meeting of another consultation", async () => {
    const w = world(ADMIN);
    expect(await updateMeeting(UNASSIGNED, { meetingId: MEETING, url: "https://example.invalid/x" }, w.deps)).toEqual({
      status: 404,
      body: { error: { code: "not_found", message: en.meetingNotFound } },
    });
  });

  it("an assistant can't edit a meeting of an unassigned consultation", async () => {
    const w = world(ASSISTANT_2);
    expect((await updateMeeting(ID, { meetingId: MEETING, url: "https://example.invalid/x" }, w.deps)).status).toBe(404);
    expect(w.writes).toEqual([]);
  });

  it("falls back to UTC when the saved zone isn't a real one", () => {
    expect(zoneOf("not/a-zone")).toBe("UTC");
    expect(zoneOf("Asia/Riyadh")).toBe("Asia/Riyadh");
  });
});

describe("sendMeetingReminders", () => {
  const NOW = Date.parse("2026-11-14T12:00:00Z");

  function reminderWorld(meetings: (DueMeeting & { remindedAt: string | null })[], over: Partial<Record<string, Recipient>> = {}) {
    const people: Record<string, Recipient | undefined> = { ...PEOPLE, ...over };
    const status: Record<string, Consultation["status"]> = { [ID]: "scheduled", [CLOSED]: "closed" };
    const db: ReminderDb = {
      claimDue: vi.fn(async (from, to) => {
        const due = meetings.filter((item) => item.remindedAt === null && item.startsAt >= from && item.startsAt <= to);
        for (const item of due) item.remindedAt = new Date(NOW).toISOString();
        return due.map(({ remindedAt: _r, ...rest }) => (void _r, rest));
      }),
      consultation: vi.fn(async (id) => ({ title: "Test consultation", clientId: CLIENT, assignedTo: ASSISTANT, status: status[id] ?? "scheduled" })),
      recipient: vi.fn(async (userId) => people[userId] ?? null),
    };
    const sent: { to: string; locale: string; timezone: unknown }[] = [];
    const queue = vi.fn(async ({ to, payload }: { to: { email: string; locale: string }; payload: { timezone?: unknown } }) => {
      sent.push({ to: to.email, locale: to.locale, timezone: payload.timezone });
      return true;
    });
    return { db, queue: queue as never, sent, meetings };
  }

  const at = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();
  const meeting = (startsAt: string, consultationId = ID) => ({
    consultationId,
    platform: "Zoom",
    url: "https://example.invalid/m",
    startsAt,
    remindedAt: null as string | null,
  });

  it("reminds the client and the assigned member, each in their language and zone", async () => {
    const w = reminderWorld([meeting(at(24))]);
    expect(await sendMeetingReminders(w.db, w.queue, NOW)).toEqual({ meetings: 1, emails: 2 });
    expect(w.sent).toEqual([
      { to: "client@example.invalid", locale: "ar", timezone: "Asia/Riyadh" },
      { to: "assistant@example.invalid", locale: "en", timezone: "Europe/London" },
    ]);
  });

  it("picks each meeting once, even when the job runs twice", async () => {
    const w = reminderWorld([meeting(at(24))]);
    await sendMeetingReminders(w.db, w.queue, NOW);
    expect(await sendMeetingReminders(w.db, w.queue, NOW)).toEqual({ meetings: 0, emails: 0 });
    expect(w.sent).toHaveLength(2);
  });

  it("asks only for meetings 23 to 25 hours ahead", async () => {
    const w = reminderWorld([meeting(at(22)), meeting(at(23.5)), meeting(at(26))]);
    expect((await sendMeetingReminders(w.db, w.queue, NOW)).meetings).toBe(1);
    expect(w.db.claimDue).toHaveBeenCalledWith("2026-11-15T11:00:00.000Z", "2026-11-15T13:00:00.000Z");
  });

  it("skips a recipient who turned optional emails off", async () => {
    const w = reminderWorld([meeting(at(24))], { [CLIENT]: { ...PEOPLE[CLIENT]!, notifyOptional: false } });
    await sendMeetingReminders(w.db, w.queue, NOW);
    expect(w.sent.map((item) => item.to)).toEqual(["assistant@example.invalid"]);
  });

  it("skips a disabled account and a closed consultation", async () => {
    const w = reminderWorld([meeting(at(24)), meeting(at(24), CLOSED)], { [ASSISTANT]: { ...PEOPLE[ASSISTANT]!, active: false } });
    expect(await sendMeetingReminders(w.db, w.queue, NOW)).toEqual({ meetings: 2, emails: 1 });
    expect(w.sent.map((item) => item.to)).toEqual(["client@example.invalid"]);
  });
});
