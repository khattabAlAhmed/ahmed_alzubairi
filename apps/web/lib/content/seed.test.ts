import { readFileSync } from "node:fs";
import {
  CONTENT_TYPES,
  HOME_SECTION_KEYS,
  isAvailableIn,
  type ContentType,
} from "@repo/shared";
import { createTestDb, type TestDb } from "@repo/db/supabase-pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SEED = readFileSync(
  new URL("../../../../supabase/seed/dev-content.sql", import.meta.url),
  "utf8",
);

const TABLES = [
  ...CONTENT_TYPES,
  "site_settings",
  "project_images",
  "project_services",
  "courses",
  "documents",
] as const;

type Row = Record<string, unknown>;

/** `key_result_ar` → `keyResultAr`, the shape `isAvailableIn` reads. */
const camel = (row: Row) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      value,
    ]),
  );

let db: TestDb;

async function rows(table: string): Promise<Row[]> {
  return (await db.owner.query<Row>(`select * from public.${table}`)).rows;
}

async function counts() {
  const result: Record<string, number> = {};
  for (const table of TABLES) result[table] = (await rows(table)).length;
  return result;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.owner.exec(SEED);
});

afterAll(() => db.close());

describe("dev seed", () => {
  it("runs a second time without error and without new rows", async () => {
    const first = await counts();
    await db.owner.exec(SEED);
    expect(await counts()).toEqual(first);
  });

  it("fills every public table", async () => {
    for (const [table, count] of Object.entries(await counts())) {
      expect(count, table).toBeGreaterThan(0);
    }
  });

  it("makes all 12 home sections visible and available in both languages", async () => {
    const sections = await rows("home_sections");
    expect(sections.map((row) => row.key).sort()).toEqual([...HOME_SECTION_KEYS].sort());
    for (const row of sections) {
      expect(row.is_visible, String(row.key)).toBe(true);
      expect(row.status, String(row.key)).toBe("published");
      for (const locale of ["ar", "en"] as const) {
        expect(isAvailableIn("home_sections", camel(row), locale), `${row.key} ${locale}`).toBe(true);
      }
    }
  });

  it("has a draft in every table with a status", async () => {
    for (const table of CONTENT_TYPES.filter((type) => type !== "home_sections")) {
      const statuses = (await rows(table)).map((row) => row.status);
      if (table === "pages") continue; // three fixed pages, all published
      expect(statuses, table).toContain("draft");
    }
    expect((await rows("courses")).map((row) => row.status)).toContain("draft");
    expect((await rows("documents")).map((row) => row.status)).toContain("draft");
  });

  it("covers the cases lib/content must handle", async () => {
    const projects = await rows("projects");
    expect(projects.some((row) => row.hide_org_name && row.status === "published")).toBe(true);

    for (const table of ["testimonials", "partners"]) {
      const published = (await rows(table)).filter((row) => row.status === "published");
      expect(published.some((row) => !row.consent_confirmed), `${table} without consent`).toBe(true);
      expect(published.some((row) => !row.admin_approved), `${table} without approval`).toBe(true);
      expect(published.some((row) => row.consent_confirmed && row.admin_approved), `${table} public`).toBe(true);
    }

    const only = async (type: ContentType, table: string) => {
      const published = (await rows(table)).filter((row) => row.status === "published");
      const ar = published.filter((row) => isAvailableIn(type, camel(row), "ar"));
      const en = published.filter((row) => isAvailableIn(type, camel(row), "en"));
      return {
        englishOnly: en.some((row) => !ar.includes(row)),
        arabicOnly: ar.some((row) => !en.includes(row)),
      };
    };
    expect(await only("services", "services")).toEqual({ englishOnly: true, arabicOnly: true });

    const categories = new Set(
      (await rows("documents")).filter((row) => row.status === "published").map((row) => row.category),
    );
    expect(categories.size).toBeGreaterThanOrEqual(3);
  });

  it("uses only made-up content and placeholder storage keys", async () => {
    for (const table of ["resources", "documents"]) {
      for (const row of await rows(table)) {
        expect(String(row.storage_key), table).toMatch(/^dev-seed\//);
      }
    }
    for (const row of await rows("testimonials")) {
      expect(String(row.letter_path)).toMatch(/^dev-seed\//);
    }
    expect(SEED).not.toMatch(/@(?!example\.com)[a-z0-9.-]+\.[a-z]{2,}/i);
  });
});
