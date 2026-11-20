import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { homeSectionContentSchemas, PERMISSIONS } from "../../shared/index";
import { createTestDb, type TestDb } from "../supabase-pglite";

/**
 * The home letter migration: 'letter' is a key, its row sits right after the
 * hero, hidden and draft, with the placeholder text in both languages.
 */

type Row = {
  key: string;
  position: number;
  is_visible: boolean;
  status: string;
  content_ar: unknown;
  content_en: unknown;
};

let db: TestDb;

const sections = async () =>
  (
    await db.owner.query<Row>(
      "select key, position, is_visible, status, content_ar, content_en from public.home_sections order by position",
    )
  ).rows;

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
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("letter row", () => {
  it("sits at position 2, after the hero, and the rest moved down by one", async () => {
    const rows = await sections();
    expect(rows.map((row) => [row.key, row.position])).toEqual([
      ["hero", 1],
      ["letter", 2],
      ["stats", 3],
      ["expertise", 4],
      ["audiences", 5],
      ["services", 6],
      ["projects", 7],
      ["partners", 8],
      ["testimonials", 9],
      ["media", 10],
      ["latest", 11],
      ["newsletter", 12],
      ["contact", 13],
    ]);
  });

  it("is hidden and draft", async () => {
    const letter = (await sections()).find((row) => row.key === "letter");
    expect(letter).toMatchObject({ is_visible: false, status: "draft" });
  });

  it("holds the placeholder text in both languages, valid for the shared schema", async () => {
    const letter = (await sections()).find((row) => row.key === "letter");
    const ar = homeSectionContentSchemas.letter.parse(letter?.content_ar);
    const en = homeSectionContentSchemas.letter.parse(letter?.content_en);
    expect(ar).toMatchObject({
      heading: "رسالة إلى من يزور هذه الصفحة",
      salutation: "إلى من يقرأ هذا،",
      signOff: "أحمد الزبيري",
      isPlaceholder: true,
    });
    expect(en).toMatchObject({
      heading: "A letter to whoever is reading this",
      salutation: "To whoever is reading this,",
      signOff: "Ahmed Alzubairi",
      isPlaceholder: true,
    });
    expect(ar.paragraphs).toHaveLength(3);
    expect(en.paragraphs).toHaveLength(3);
    expect(en.paragraphs[2]).toBe(
      "If something is worrying you, write to me. I read every message myself.",
    );
    for (const content of [ar, en]) {
      expect(content.signatureKey).toBeUndefined();
      expect(content.signatureDarkKey).toBeUndefined();
    }
  });

  it("the key check still refuses unknown keys", async () => {
    await expect(
      db.owner.query("insert into public.home_sections (key) values ('footer')"),
    ).rejects.toThrow(/home_sections_key_check/);
  });
});

describe("who can read it", () => {
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

  it("the public role reads no row, draft or not", async () => {
    await expect(
      db.runAs("anon", null, (tx) => tx.query("select key from public.home_sections")),
    ).rejects.toThrow(/permission denied/);
  });

  it("a signed-in client without content.manage reads no row", async () => {
    const rows = await db.runAs("authenticated", "client", async (tx) =>
      (await tx.query("select key from public.home_sections")).rows,
    );
    expect(rows).toEqual([]);
  });

  it("content.manage reads the draft letter", async () => {
    const rows = await db.runAs("authenticated", "content_user", async (tx) =>
      (await tx.query<{ key: string }>(
        "select key from public.home_sections where key = 'letter'",
      )).rows,
    );
    expect(rows).toEqual([{ key: "letter" }]);
  });
});
