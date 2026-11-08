import { readFileSync } from "node:fs";
import { CONTENT_TYPES, PERMISSIONS } from "@repo/shared";
import { createTestDb, type TestDb } from "@repo/db/supabase-pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  addMember,
  pgliteUserClient,
  selectParts,
} from "@/components/dashboard/content/test-db-client";
import { handleContentRequest } from "./route";
import { createContentStore, selectFor } from "./store";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const PROJECT = "3f8a7c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b";
type Result = { data?: unknown; error: { code: string } | null };

/** A supabase-js stand-in: records each call, answers `select`, `insert`, `delete`. */
function fakeClient(answers: { insert: Result }) {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      return {
        select: () => ({
          eq: async () => {
            calls.push(`${table}.select`);
            return { data: [{ id: "old-1" }], error: null };
          },
        }),
        insert: async () => {
          calls.push(`${table}.insert`);
          return answers.insert;
        },
        delete: () => ({
          in: async () => {
            calls.push(`${table}.delete`);
            return { error: null };
          },
        }),
      };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const image = { project_id: PROJECT, path: "media/a.jpg", position: 0 };

describe("replaceProjectImages", () => {
  it("adds the new images before removing the old ones", async () => {
    const { client, calls } = fakeClient({ insert: { error: null } });
    await createContentStore(client, client).replaceProjectImages(PROJECT, [image]);
    expect(calls).toEqual([
      "project_images.select",
      "project_images.insert",
      "project_images.delete",
    ]);
  });

  it("keeps the old images when the insert fails", async () => {
    const { client, calls } = fakeClient({ insert: { error: { code: "XX000" } } });
    await expect(
      createContentStore(client, client).replaceProjectImages(PROJECT, [image]),
    ).rejects.toThrow("project_images insert failed");
    expect(calls).not.toContain("project_images.delete");
  });
});

// The reads below run on pglite with every migration and the dev seed, as a
// content editor, so Postgres checks the real grants and RLS.

const EDITOR = "user_store_test_editor";
const SEED = readFileSync(
  new URL("../../../../../supabase/seed/dev-content.sql", import.meta.url),
  "utf8",
);

describe("content store reads, against the real grants", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
    await db.owner.exec(SEED);
    await addMember(db, EDITOR, "content_editor");
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  /** Content tables whose `authenticated` read is granted column by column. */
  async function columnGrantedTables(): Promise<string[]> {
    const { rows } = await db.owner.query<{ table_name: string }>(
      `select c.table_name from information_schema.column_privileges c
        where c.table_schema = 'public' and c.grantee = 'authenticated'
          and c.privilege_type = 'SELECT'
          and not exists (
            select 1 from information_schema.role_table_grants t
             where t.table_schema = 'public' and t.table_name = c.table_name
               and t.grantee = 'authenticated' and t.privilege_type = 'SELECT')
        group by c.table_name`,
    );
    return rows.map((row) => row.table_name);
  }

  it("never asks for every column of a table granted column by column", async () => {
    const granted = await columnGrantedTables();
    expect(granted).toContain("resources");
    for (const type of CONTENT_TYPES) {
      for (const part of selectParts(type, selectFor(type))) {
        if (!granted.includes(part.table)) continue;
        expect(part.columns.split(",").map((c) => c.trim()), `${type} → ${part.table}`).not.toContain("*");
      }
    }
  });

  it("never asks for a resource's storage key", () => {
    expect(selectFor("resources")).not.toMatch(/storage_key|\*/);
  });

  it.each(CONTENT_TYPES)("reads %s as a content editor without a refused column", async (type) => {
    for (const part of selectParts(type, selectFor(type))) {
      await expect(
        db.runAs("authenticated", EDITOR, (tx) =>
          tx.query(`select ${part.columns} from public.${part.table} limit 1`),
        ),
        `${type} → ${part.table}`,
      ).resolves.toBeDefined();
    }
  });

  it("lists and gets resources through the user client", async () => {
    const store = createContentStore(pgliteUserClient(db, EDITOR), unusedClient());
    const rows = await store.list("resources");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row).not.toHaveProperty("storage_key");

    const one = await store.get("resources", { column: "id", value: String(rows[0].id) });
    expect(one).toMatchObject({ id: rows[0].id });
    expect(one).not.toHaveProperty("storage_key");
  });

  it("answers the API GET for resources with 200 and no key", async () => {
    const response = await handleContentRequest(
      "GET",
      new Request("http://localhost/api/admin/content/resources", {
        headers: { referer: "http://localhost/en/dashboard" },
      }),
      "resources",
      {
        permission: {
          getUserId: async () => EDITOR,
          hasPermission: async (key) => key === PERMISSIONS.CONTENT_MANAGE,
        },
        createStore: () => createContentStore(pgliteUserClient(db, EDITOR), unusedClient()),
        revalidate: () => {},
      },
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toMatch(/storage_key|"key"/);
    const body = JSON.parse(text) as { rows: unknown[] };
    expect(body.rows.length).toBeGreaterThan(0);
  });
});

/** The service client: reads must never reach it. */
function unusedClient(): SupabaseClient {
  return new Proxy({}, {
    get() {
      throw new Error("reads must use the user client");
    },
  }) as SupabaseClient;
}
