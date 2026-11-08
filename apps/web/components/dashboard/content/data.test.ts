import { readFileSync } from "node:fs";
import { CONTENT_TYPES } from "@repo/shared";
import { createTestDb, type TestDb } from "@repo/db/supabase-pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addMember, pgliteUserClient } from "./test-db-client";

const EDITOR = "user_dashboard_data_test_editor";
const SEED = readFileSync(
  new URL("../../../../../supabase/seed/dev-content.sql", import.meta.url),
  "utf8",
);

const clients = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: () => clients.user }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () =>
    new Proxy({}, {
      get() {
        throw new Error("dashboard reads must use the user client");
      },
    }),
}));

const { loadRow, loadRows } = await import("./data");

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  await db.owner.exec(SEED);
  await addMember(db, EDITOR, "content_editor");
  clients.user = pgliteUserClient(db, EDITOR);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("dashboard content reads, against the real grants", () => {
  it("loads the resources list and one resource for its editor, without the key", async () => {
    const rows = await loadRows("resources");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).not.toHaveProperty("key");
      expect(row).not.toHaveProperty("storage_key");
    }

    const row = await loadRow("resources", String(rows[0].id));
    expect(row).toMatchObject({ id: rows[0].id, titleEn: rows[0].titleEn });
    expect(row).not.toHaveProperty("key");
  });

  // The content page loads every type's list, so one refused read breaks it.
  // Projects embed their images, which the test client can't run; the store
  // test checks each part of their select.
  it.each(CONTENT_TYPES.filter((type) => type !== "projects"))(
    "loads the %s list",
    async (type) => {
      await expect(loadRows(type)).resolves.toBeInstanceOf(Array);
    },
  );
});
