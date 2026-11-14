import { describe, expect, it, vi } from "vitest";
import { createReminderDb } from "./reminders";
import { createAdminConsultationStore } from "./store";

vi.mock("server-only", () => ({}));

/** A supabase-js client that records each call and resolves to the next result. */
function recorder(results: unknown[], log: unknown[][]) {
  let index = 0;
  const query: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => resolve(results[Math.min(index++, results.length - 1)]),
  };
  for (const method of ["from", "select", "eq", "is", "gte", "lte", "update", "insert", "maybeSingle", "single", "rpc"]) {
    query[method] = (...args: unknown[]) => {
      log.push([method, ...args]);
      return query;
    };
  }
  return query as never;
}

describe("createReminderDb", () => {
  it("claims due meetings in one update: unreminded, in the window, returning them", async () => {
    const log: unknown[][] = [];
    const db = createReminderDb(
      recorder([{ data: [{ consultation_id: "c", platform: "Zoom", url: "https://x.test", starts_at: "2026-11-15T12:00:00+00:00" }], error: null }], log),
    );
    expect(await db.claimDue("2026-11-15T11:00:00.000Z", "2026-11-15T13:00:00.000Z")).toEqual([
      { consultationId: "c", platform: "Zoom", url: "https://x.test", startsAt: "2026-11-15T12:00:00.000Z" },
    ]);
    expect(log.map((call) => call[0])).toEqual(["from", "update", "is", "gte", "lte", "select"]);
    expect(log).toContainEqual(["is", "reminder_sent_at", null]);
    expect(log).toContainEqual(["gte", "starts_at", "2026-11-15T11:00:00.000Z"]);
    expect(log).toContainEqual(["lte", "starts_at", "2026-11-15T13:00:00.000Z"]);
  });
});

describe("createAdminConsultationStore", () => {
  it("accepts as assignee only an active member whose role holds consultations.reply", async () => {
    const cases: [unknown[], boolean][] = [
      [[{ data: { role_id: "r", status: "active" }, error: null }, { data: { permission: "consultations.reply" }, error: null }], true],
      [[{ data: { role_id: "r", status: "active" }, error: null }, { data: null, error: null }], false],
      [[{ data: { role_id: "r", status: "disabled" }, error: null }], false],
      [[{ data: { role_id: null, status: "active" }, error: null }], false],
      [[{ data: null, error: null }], false],
    ];
    for (const [results, expected] of cases) {
      const log: unknown[][] = [];
      const store = createAdminConsultationStore(recorder([], []), recorder(results, log));
      expect(await store.isEligibleAssignee("user_x")).toBe(expected);
    }
  });

  it("unassigned compare-and-set uses IS NULL", async () => {
    const log: unknown[][] = [];
    const store = createAdminConsultationStore(recorder([], []), recorder([{ data: [{ id: "c" }], error: null }], log));
    expect(await store.setAssignee("c", null, "user_a")).toBe(true);
    expect(log).toContainEqual(["is", "assigned_to", null]);
  });

  it("closing sets closed_at, and a new start clears reminder_sent_at", async () => {
    const log: unknown[][] = [];
    const store = createAdminConsultationStore(
      recorder([], []),
      recorder([{ data: [{ id: "c" }], error: null }, { data: { id: "m", platform: "Zoom", url: "https://x.test", starts_at: "2026-11-20T10:00:00Z", duration_minutes: 30, created_at: "2026-11-14T10:00:00Z" }, error: null }], log),
    );
    await store.setStatus("c", "in_progress", "closed");
    const update = log.find((call) => call[0] === "update")?.[1] as Record<string, unknown>;
    expect(update.status).toBe("closed");
    expect(typeof update.closed_at).toBe("string");
    await store.updateMeeting("m", "c", { startsAt: "2026-11-20T10:00:00.000Z" });
    expect(log.filter((call) => call[0] === "update")[1]?.[1]).toEqual({ starts_at: "2026-11-20T10:00:00.000Z", reminder_sent_at: null });
  });
});
