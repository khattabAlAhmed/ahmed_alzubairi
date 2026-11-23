import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PERMISSIONS } from "../../shared/index";
import { createTestDb, type TestDb } from "../supabase-pglite";

/**
 * The page and area photo migration: five nullable columns on `pages` and
 * `expertise_areas`, with length checks, and no change to who reads them.
 */

const TABLES = ["pages", "expertise_areas"] as const;
const COLUMNS = [
  "image_path",
  "image_alt_ar",
  "image_alt_en",
  "image_caption_ar",
  "image_caption_en",
];

let db: TestDb;

async function addProfile(clerkUserId: string, roleKey: string | null) {
  await db.owner.query(
    `insert into public.profiles
       (clerk_user_id, full_name, email, phone, timezone, terms_accepted_at, status, role_id)
     values ($1, 'Test', $1 || '@example.com', '+966500000000', 'Asia/Riyadh', now(), 'active',
       (select id from public.roles where key = $2))`,
    [clerkUserId, roleKey],
  );
}

beforeAll(async () => {
  db = await createTestDb();
  await db.owner.query(
    "insert into public.pages (key, title_en, status) values ('about', 'About', 'draft')",
  );
  await db.owner.query(
    "insert into public.expertise_areas (slug, title_en, status) values ('governance', 'Governance', 'draft')",
  );
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe.each(TABLES)("%s photo columns", (table) => {
  it("exist as nullable text", async () => {
    const { rows } = await db.owner.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `select column_name, data_type, is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = $1 and column_name like 'image_%'
       order by column_name`,
      [table],
    );
    expect(rows.map((row) => row.column_name)).toEqual([...COLUMNS].sort());
    for (const row of rows) {
      expect(row).toMatchObject({ data_type: "text", is_nullable: "YES" });
    }
  });

  it("existing rows keep working with the columns empty", async () => {
    const { rows } = await db.owner.query<Record<string, unknown>>(
      `select ${COLUMNS.join(", ")} from public.${table}`,
    );
    expect(rows).toHaveLength(1);
    expect(Object.values(rows[0] ?? {})).toEqual([null, null, null, null, null]);
  });

  it("takes an alt of 300 and a caption of 200 characters", async () => {
    await db.owner.query(
      `update public.${table} set image_path = 'media/photo.webp',
         image_alt_ar = $1, image_alt_en = $1, image_caption_ar = $2, image_caption_en = $2`,
      ["a".repeat(300), "c".repeat(200)],
    );
    const { rows } = await db.owner.query<{ image_path: string }>(
      `select image_path from public.${table}`,
    );
    expect(rows[0]?.image_path).toBe("media/photo.webp");
  });

  it.each(["image_alt_ar", "image_alt_en"])("refuses a %s over 300 characters", async (column) => {
    await expect(
      db.owner.query(`update public.${table} set ${column} = $1`, ["a".repeat(301)]),
    ).rejects.toThrow(new RegExp(`${table}_${column}_check`));
  });

  it.each(["image_caption_ar", "image_caption_en"])(
    "refuses a %s over 200 characters",
    async (column) => {
      await expect(
        db.owner.query(`update public.${table} set ${column} = $1`, ["c".repeat(201)]),
      ).rejects.toThrow(new RegExp(`${table}_${column}_check`));
    },
  );
});

describe("who can read the photo columns", () => {
  beforeAll(async () => {
    await db.owner.query(
      "insert into public.roles (key, name_ar, name_en) values ('content_only', 'x', 'x')",
    );
    await db.owner.query(
      `insert into public.role_permissions (role_id, permission)
       select id, $1 from public.roles where key = 'content_only'`,
      [PERMISSIONS.CONTENT_MANAGE],
    );
    await addProfile("content_user", "content_only");
    await addProfile("client", null);
  });

  it.each(TABLES)("the public role reads no %s row, draft or not", async (table) => {
    await expect(
      db.runAs("anon", null, (tx) => tx.query(`select image_path from public.${table}`)),
    ).rejects.toThrow(/permission denied/);
  });

  it.each(TABLES)("a signed-in client without content.manage reads no %s row", async (table) => {
    const rows = await db.runAs("authenticated", "client", async (tx) =>
      (await tx.query(`select image_path from public.${table}`)).rows,
    );
    expect(rows).toEqual([]);
  });

  it.each(TABLES)("content.manage reads the draft %s row's photo", async (table) => {
    const rows = await db.runAs("authenticated", "content_user", async (tx) =>
      (await tx.query(`select image_path from public.${table}`)).rows,
    );
    expect(rows).toEqual([{ image_path: "media/photo.webp" }]);
  });

  it.each(TABLES)("a signed-in user can't write %s", async (table) => {
    await expect(
      db.runAs("authenticated", "content_user", (tx) =>
        tx.query(`update public.${table} set image_path = 'media/other.webp'`),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
