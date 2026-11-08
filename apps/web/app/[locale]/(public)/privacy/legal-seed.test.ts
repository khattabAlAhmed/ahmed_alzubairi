import { readFileSync } from "node:fs";
import { createTestDb, type TestDb } from "@repo/db/supabase-pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The legal text lives only in this dev seed, as a draft for Ahmed (§6.25, §14 #8).
describe("legal draft seed", () => {
  const seed = (name: string) =>
    readFileSync(new URL(`../../../../../../supabase/seed/${name}`, import.meta.url), "utf8");
  let db: TestDb;

  type Node = { type: string; text?: string; content?: Node[]; marks?: { type: string }[] };
  const textOf = (node: Node): string => node.text ?? (node.content ?? []).map(textOf).join(" ");
  const headings = (body: Node) =>
    (body.content ?? []).filter((node) => node.type === "heading").map(textOf);

  beforeAll(async () => {
    db = await createTestDb();
    await db.owner.exec(seed("dev-content.sql"));
    await db.owner.exec(seed("legal-draft.sql"));
    // Twice: it must be idempotent.
    await db.owner.exec(seed("legal-draft.sql"));
  });
  afterAll(() => db.close());

  async function page(key: string) {
    const { rows } = await db.owner.query<Record<string, unknown>>(
      "select * from public.pages where key = $1",
      [key],
    );
    expect(rows).toHaveLength(1);
    return rows[0];
  }

  it("leaves the other pages alone", async () => {
    const { rows } = await db.owner.query("select key from public.pages order by key");
    expect(rows).toEqual([{ key: "about" }, { key: "privacy" }, { key: "terms" }]);
  });

  it.each(["privacy", "terms"])("%s is published in both languages and opens with a bold draft notice", async (key) => {
    const row = await page(key);
    expect(row.status).toBe("published");
    for (const [locale, word] of [["ar", "مسودة"], ["en", "Draft"]] as const) {
      expect(String(row[`title_${locale}`])).toContain(locale === "ar" ? "مسودة" : "draft");
      const first = (row[`body_${locale}`] as Node).content?.[0] as Node;
      expect(first.type).toBe("paragraph");
      expect(first.content?.[0]?.marks?.[0]?.type).toBe("bold");
      expect(textOf(first)).toContain(word);
      expect(textOf(first)).toContain("§14 #8");
    }
  });

  it("covers every §6.25 point, in the same order in both languages", async () => {
    const privacy = await page("privacy");
    const terms = await page("terms");
    expect(headings(privacy.body_en as Node)).toEqual([
      "Data we collect",
      "Why we use it",
      "How long we keep it",
      "Your rights",
      "Consent",
      "Cookies",
      "Contact",
    ]);
    expect(headings(terms.body_en as Node)).toEqual([
      "Nature of consultations",
      "Confidentiality of chats",
      "Granted documents",
      "Financial agreements",
      "Your account",
      "Changes to these terms",
    ]);
    expect(headings(privacy.body_ar as Node)).toHaveLength(7);
    expect(headings(terms.body_ar as Node)).toHaveLength(6);
    expect(textOf(privacy.body_en as Node)).toContain("until a site admin deletes it");
    expect(textOf(privacy.body_ar as Node)).toContain("إلى أن يحذفها أحد مسؤولي الموقع");
    expect(textOf(privacy.body_en as Node)).toContain("PostHog runs without any cookies");
    expect(textOf(terms.body_en as Node)).toContain("happens outside the site");
  });
});
