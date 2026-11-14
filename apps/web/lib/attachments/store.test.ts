import { describe, expect, it, vi } from "vitest";
import { createCleanupDb } from "./cleanup";
import { createAttachmentStore } from "./store";

vi.mock("server-only", () => ({}));

/** A supabase-js client that records each call and resolves to `result`. */
function recorder(name: string, result: unknown, log: unknown[][]) {
  const query: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => resolve(result),
  };
  for (const method of ["from", "select", "eq", "or", "in", "is", "order", "limit", "insert", "update", "delete", "maybeSingle", "createSignedUrl", "remove"]) {
    query[method] = (...args: unknown[]) => {
      log.push([name, method, ...args]);
      return query;
    };
  }
  query.storage = { from: (...args: unknown[]) => (log.push([name, "storage.from", ...args]), query) };
  return query as never;
}

describe("createAttachmentStore", () => {
  it("checks visibility through the user client, without the storage key", async () => {
    const log: unknown[][] = [];
    const store = createAttachmentStore(
      recorder("user", { data: { id: "a", status: "ready" }, error: null }, log),
      recorder("service", { data: null, error: null }, log),
    );
    expect(await store.visible("a")).toEqual({ status: "ready" });
    expect(log.every((call) => call[0] === "user")).toBe(true);
    expect(log).toContainEqual(["user", "select", "id, status"]);
  });

  it("signs a 60-second link that downloads the file under its name", async () => {
    const log: unknown[][] = [];
    const store = createAttachmentStore(
      recorder("user", { data: null, error: null }, log),
      recorder("service", { data: { signedUrl: "https://storage.test/x" }, error: null }, log),
    );
    expect(await store.signDownload("c/a.pdf", "report.pdf")).toBe("https://storage.test/x");
    expect(log).toContainEqual(["service", "storage.from", "attachments"]);
    expect(log).toContainEqual(["service", "createSignedUrl", "c/a.pdf", 60, { download: "report.pdf" }]);
  });

  it("marks ready only a row still uploading", async () => {
    const log: unknown[][] = [];
    const store = createAttachmentStore(
      recorder("user", { data: null, error: null }, log),
      recorder("service", { data: [], error: null }, log),
    );
    expect(await store.markReady("a", 10)).toBe(false);
    expect(log).toContainEqual(["service", "eq", "status", "uploading"]);
  });
});

describe("createCleanupDb", () => {
  it("deletes by id with the same conditions re-checked, and returns the deleted keys", async () => {
    const log: unknown[][] = [];
    let call = 0;
    const results = [
      { data: [{ id: "a" }], error: null },
      { data: [{ storage_key: "c/a.pdf" }], error: null },
    ];
    const client = recorder("service", null, log) as unknown as Record<string, unknown>;
    client.then = (resolve: (value: unknown) => unknown) => resolve(results[call++]);
    const db = createCleanupDb(client as never);
    const keys = await db.deleteAbandoned({ uploading: "2026-11-14T11:00:00.000Z", unlinked: "2026-11-13T12:00:00.000Z" });
    expect(keys).toEqual(["c/a.pdf"]);
    const filter =
      "and(status.eq.uploading,created_at.lt.2026-11-14T11:00:00.000Z),and(status.eq.ready,message_id.is.null,created_at.lt.2026-11-13T12:00:00.000Z)";
    expect(log.filter((entry) => entry[1] === "or")).toEqual([
      ["service", "or", filter],
      ["service", "or", filter],
    ]);
    expect(log).toContainEqual(["service", "in", "id", ["a"]]);
  });
});
