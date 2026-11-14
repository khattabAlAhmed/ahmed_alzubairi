import { describe, expect, it, vi } from "vitest";
import { createConsultationStore } from "./store";

vi.mock("server-only", () => ({}));

/** A supabase-js client that records each call and resolves to `result`. */
function recorder(name: string, result: unknown, log: unknown[][]) {
  const query: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => resolve(result),
  };
  for (const method of ["from", "select", "eq", "not", "is", "in", "order", "insert", "update", "delete", "rpc", "maybeSingle", "single"]) {
    query[method] = (...args: unknown[]) => {
      log.push([name, method, ...args]);
      return query;
    };
  }
  return query as never;
}

const ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "consultation",
  client_id: "user_client_a",
  service_id: null,
  title: "Test",
  description: "Fake",
  organization: null,
  status: "new",
  assigned_to: null,
  first_reply_at: null,
  closed_at: null,
  created_at: "2026-11-14T10:00:00+00:00",
};

describe("createConsultationStore", () => {
  it("reads consultations, messages, attachments and meetings through the user client only", async () => {
    const log: unknown[][] = [];
    const store = createConsultationStore(
      recorder("user", { data: [], error: null }, log),
      recorder("service", { data: [], error: null }, log),
    );
    await store.list();
    await store.messages(ROW.id);
    await store.attachments(ROW.id);
    await store.meetings(ROW.id);
    expect(log.filter((call) => call[0] === "service")).toEqual([]);
    const tables = log.filter((call) => call[1] === "from").map((call) => call[2]);
    expect(tables).toEqual(["consultations", "consultation_messages", "consultation_attachments", "meetings"]);
  });

  it("never selects the attachment's storage key, and lists only ready, linked files", async () => {
    const log: unknown[][] = [];
    const store = createConsultationStore(recorder("user", { data: [], error: null }, log), recorder("service", { data: [], error: null }, log));
    await store.attachments(ROW.id);
    const select = log.find((call) => call[1] === "select");
    expect(String(select?.[2])).not.toContain("storage_key");
    expect(log).toContainEqual(["user", "eq", "status", "ready"]);
    expect(log).toContainEqual(["user", "not", "message_id", "is", null]);
  });

  it("reads only full_name for the senders with the service client", async () => {
    const log: unknown[][] = [];
    const store = createConsultationStore(
      recorder("user", { data: [], error: null }, log),
      recorder("service", { data: [{ clerk_user_id: "user_admin", full_name: "Test Admin" }], error: null }, log),
    );
    expect(await store.senderNames(["user_admin"])).toEqual(new Map([["user_admin", "Test Admin"]]));
    expect(log).toContainEqual(["service", "select", "clerk_user_id, full_name"]);
    expect(log).toContainEqual(["service", "in", "clerk_user_id", ["user_admin"]]);
  });

  it("links only the sender's own ready, unlinked files on this consultation, in one update", async () => {
    const log: unknown[][] = [];
    const store = createConsultationStore(
      recorder("user", { data: [], error: null }, log),
      recorder("service", { data: [{ id: "a" }], error: null }, log),
    );
    const linked = await store.linkAttachments({ messageId: "m", consultationId: ROW.id, uploadedBy: "user_client_a", ids: ["a", "b"] });
    expect(linked).toBe(1);
    expect(log).toEqual(
      expect.arrayContaining([
        ["service", "update", { message_id: "m" }],
        ["service", "eq", "consultation_id", ROW.id],
        ["service", "eq", "uploaded_by", "user_client_a"],
        ["service", "eq", "status", "ready"],
        ["service", "is", "message_id", null],
      ]),
    );
  });

  it("maps a row's times to UTC ISO strings", async () => {
    const log: unknown[][] = [];
    const store = createConsultationStore(recorder("user", { data: ROW, error: null }, log), recorder("service", { data: null, error: null }, log));
    expect((await store.get(ROW.id))?.createdAt).toBe("2026-11-14T10:00:00.000Z");
  });

  it("throws with the error code only", async () => {
    const log: unknown[][] = [];
    const store = createConsultationStore(recorder("user", { data: null, error: { code: "42501", message: "secret" } }, log), recorder("service", { data: null, error: null }, log));
    await expect(store.list()).rejects.toThrow("consultation list failed: 42501");
  });
});
