import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../../../../../packages/db/supabase-pglite";

/**
 * The delete route removes a consultation with one `delete` on the row and
 * relies on the foreign keys for the rest, so nothing is ever half-deleted.
 * This checks those keys against the real migrations.
 */
const CLIENT = "user_cascade_client";
const C = "123e4567-e89b-42d3-a456-426614174101";
const MSG = "123e4567-e89b-42d3-a456-426614174102";
const DOC = "123e4567-e89b-42d3-a456-426614174103";
const REQ = "123e4567-e89b-42d3-a456-426614174104";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  await db.owner.exec(`
    insert into public.profiles (clerk_user_id, full_name, email, phone, timezone, terms_accepted_at)
      values ('${CLIENT}', 'Test Client', 'client@example.invalid', '+10000000000', 'UTC', now());
    insert into public.consultations (id, kind, client_id, title, description)
      values ('${C}', 'document_request', '${CLIENT}', 'T', 'D');
    insert into public.consultation_messages (id, consultation_id, sender_id, body)
      values ('${MSG}', '${C}', '${CLIENT}', 'hello');
    insert into public.consultation_attachments (consultation_id, message_id, storage_key, file_name, mime, size_bytes, status, uploaded_by)
      values ('${C}', '${MSG}', '${C}/a.pdf', 'a.pdf', 'application/pdf', 10, 'ready', '${CLIENT}'),
             ('${C}', null, '${C}/b.pdf', 'b.pdf', 'application/pdf', 10, 'ready', '${CLIENT}');
    insert into public.meetings (consultation_id, platform, url, starts_at, duration_minutes)
      values ('${C}', 'Zoom', 'https://zoom.example/j/1', now() + interval '1 day', 30);
    insert into public.documents (id, category, title_ar, title_en, storage_key, mime, access_mode)
      values ('${DOC}', 'thank_you_letter', 'خطاب', 'Letter', 'originals/x.pdf', 'application/pdf', 'view');
    insert into public.document_requests (id, client_id, document_id, purpose, consultation_id)
      values ('${REQ}', '${CLIENT}', '${DOC}', 'Need it', '${C}');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

const count = async (table: string) =>
  (await db.owner.query<{ n: number }>(`select count(*)::int as n from public.${table} where consultation_id = $1`, [C]))
    .rows[0]!.n;

describe("deleting a consultation row", () => {
  it("takes its messages, attachments and meetings, and unlinks its document request, in one statement", async () => {
    const deleted = await db.runAs("service_role", null, async (tx) =>
      tx.query("delete from public.consultations where id = $1 returning id", [C]),
    );
    expect(deleted.rows).toHaveLength(1);
    expect(await count("consultation_messages")).toBe(0);
    expect(await count("consultation_attachments")).toBe(0);
    expect(await count("meetings")).toBe(0);
    const request = await db.owner.query<{ consultation_id: string | null }>(
      "select consultation_id from public.document_requests where id = $1",
      [REQ],
    );
    // The request itself stays: it belongs to the document, not the chat.
    expect(request.rows).toEqual([{ consultation_id: null }]);
  });
});
