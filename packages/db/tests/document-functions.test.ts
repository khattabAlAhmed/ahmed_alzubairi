import { readFileSync } from "node:fs";
import type { Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  DECIDE_DOCUMENT_REQUEST_DECISIONS,
  DOCUMENT_REQUEST_STATUSES,
  PERMISSIONS,
} from "../../shared/index";
import { createTestDb, type ApiRole, type TestDb } from "../supabase-pglite";

/**
 * The Phase 4 document functions (request_document, decide_document_request,
 * revoke_document_request, expire_document_grants) and the RLS of the client
 * work tables, role by role, after the functions have made real rows.
 */

const uuid = (n: number) =>
  `123e4567-e89b-42d3-a456-4266141742${String(n).padStart(2, "0")}`;
const DOC_1 = uuid(1);
const DOC_2 = uuid(2);
const DRAFT_DOC = uuid(3);
const CONSULT_A = uuid(4); // client_a's consultation, assigned to the assistant
const CONSULT_B = uuid(5); // client_b's, unassigned
const MISSING = uuid(99);
const NO_EXECUTE = /permission denied for function/;

type Row = {
  id: string;
  client_id: string;
  document_id: string;
  status: string;
  consultation_id: string | null;
  decided_by: string | null;
  granted_at: Date | null;
  expires_at: Date | null;
  revoked_at: Date | null;
};

type RequestResult = {
  request_id: string;
  document_id: string;
  status: string;
  merged: boolean;
};

let db: TestDb;

async function addProfile(
  clerkUserId: string,
  roleKey: string | null,
  { status = "active", locale = "ar" } = {},
) {
  await db.owner.query(
    `insert into public.profiles
       (clerk_user_id, full_name, email, phone, timezone, terms_accepted_at, status, locale, role_id)
     values ($1, 'Test', $1 || '@example.com', '+966500000000', 'Asia/Riyadh', now(), $2, $3,
       (select id from public.roles where key = $4))`,
    [clerkUserId, status, locale, roleKey],
  );
}

/** A role holding exactly these permissions, and one active member with it. */
async function addMemberWith(clerkUserId: string, permissions: string[]) {
  await db.owner.query(
    "insert into public.roles (key, name_ar, name_en) values ($1, $1, $1)",
    [`role_${clerkUserId}`],
  );
  for (const permission of permissions) {
    await db.owner.query(
      `insert into public.role_permissions (role_id, permission)
       select id, $2 from public.roles where key = $1`,
      [`role_${clerkUserId}`, permission],
    );
  }
  await addProfile(clerkUserId, `role_${clerkUserId}`);
}

const asService = <T>(fn: (tx: Transaction) => Promise<T>) =>
  db.runAs("service_role", null, fn);

const requestDocuments = (clientId: string, documentIds: string[], purpose = "For a tender") =>
  asService(async (tx) => {
    const { rows } = await tx.query<RequestResult>(
      "select * from public.request_document($1, $2::uuid[], $3)",
      [clientId, documentIds, purpose],
    );
    return rows;
  });

const decide = (
  requestId: string,
  decision: string,
  { by = "admin", expiresAt = null as string | null } = {},
) =>
  asService(async (tx) => {
    const { rows } = await tx.query<Row>(
      "select * from public.decide_document_request($1, $2, $3, $4)",
      [requestId, by, decision, expiresAt],
    );
    return rows[0] as Row;
  });

const revoke = (requestId: string, by = "admin") =>
  asService(async (tx) => {
    const { rows } = await tx.query<Row>(
      "select * from public.revoke_document_request($1, $2)",
      [requestId, by],
    );
    return rows[0] as Row;
  });

const expireGrants = () =>
  asService(async (tx) => {
    const { rows } = await tx.query<{ n: number }>(
      "select public.expire_document_grants() as n",
    );
    return rows[0]?.n;
  });

async function requestRow(id: string) {
  const { rows } = await db.owner.query<Row>(
    "select * from public.document_requests where id = $1",
    [id],
  );
  return rows[0];
}

async function sqlState(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    const { code, message } = error as { code?: string; message?: string };
    return `${code} ${message}`;
  }
  return "no error";
}

beforeAll(async () => {
  db = await createTestDb();

  for (const client of ["client_a", "client_b", "client_c", "client_d"]) {
    await addProfile(client, null);
  }
  await addProfile("client_en", null, { locale: "en" });
  await addProfile("disabled_client", null, { status: "disabled" });
  await addProfile("admin", "admin");
  await addProfile("disabled_admin", "admin", { status: "disabled" });
  await addProfile("assistant", "assistant_consultant");
  await addProfile("other_assistant", "assistant_consultant");
  await addMemberWith("recommender", [PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND]);
  await addMemberWith("decider", [PERMISSIONS.DOCUMENT_REQUESTS_DECIDE]);
  await addMemberWith("viewer", [PERMISSIONS.CONSULTATIONS_VIEW_ALL]);
  await addMemberWith("doc_viewer", [PERMISSIONS.DOCUMENTS_VIEW]);
  await addMemberWith("nobody", []);

  await db.owner.exec(`
    insert into public.documents (id, category, title_ar, title_en, storage_key, mime, access_mode, status) values
      ('${DOC_1}', 'thank_you_letter', 'خطاب شكر', 'Thank-you letter', 'documents/1', 'application/pdf', 'view', 'published'),
      ('${DOC_2}', 'course_certificate', 'شهادة', 'Certificate', 'documents/2', 'image/png', 'view_download', 'published'),
      ('${DRAFT_DOC}', 'event_photo', 'صورة', 'Photo', 'documents/3', 'image/jpeg', 'view', 'draft');
    insert into public.consultations (id, client_id, title, description, assigned_to) values
      ('${CONSULT_A}', 'client_a', 'A', 'A', 'assistant'),
      ('${CONSULT_B}', 'client_b', 'B', 'B', null);
    insert into public.consultation_messages (consultation_id, sender_id, body) values
      ('${CONSULT_A}', 'client_a', 'A'), ('${CONSULT_B}', 'client_b', 'B');
    insert into public.consultation_attachments
      (consultation_id, storage_key, file_name, mime, size_bytes, status, uploaded_by) values
      ('${CONSULT_A}', 'attachments/a', 'a.pdf', 'application/pdf', 1, 'ready', 'client_a'),
      ('${CONSULT_B}', 'attachments/b', 'b.pdf', 'application/pdf', 1, 'ready', 'client_b');
    insert into public.meetings (consultation_id, platform, url, starts_at, duration_minutes) values
      ('${CONSULT_A}', 'Zoom', 'https://example.com/a', now(), 30),
      ('${CONSULT_B}', 'Zoom', 'https://example.com/b', now(), 30);
  `);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("the contract has no reject", () => {
  it("lists only grant and contact_first as decisions, and no rejected status", () => {
    expect(DECIDE_DOCUMENT_REQUEST_DECISIONS).toEqual(["grant", "contact_first"]);
    expect(DOCUMENT_REQUEST_STATUSES).not.toContain("rejected");
  });

  it("refuses a reject decision", async () => {
    const [row] = await requestDocuments("client_d", [DOC_1]);
    expect(await sqlState(decide(row?.request_id ?? "", "reject"))).toBe(
      "22023 invalid_decision",
    );
  });

  it("has no function or constraint value that mentions reject", async () => {
    const { rows } = await db.owner.query<{ src: string }>(
      `select prosrc as src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
       union all
       select pg_get_constraintdef(c.oid) from pg_constraint c
        where c.conrelid = 'public.document_requests'::regclass`,
    );
    for (const { src } of rows) expect(src).not.toMatch(/reject/i);
  });
});

describe("only service_role may execute the functions", () => {
  const calls = [
    `select * from public.request_document('client_a', array['${DOC_1}']::uuid[], 'p')`,
    `select * from public.decide_document_request('${MISSING}', 'admin', 'grant')`,
    `select * from public.revoke_document_request('${MISSING}', 'admin')`,
    "select public.expire_document_grants()",
  ];

  it.each(["anon", "authenticated"] as ApiRole[])("refuses %s", async (role) => {
    for (const sql of calls) {
      await expect(
        db.runAs(role, role === "authenticated" ? "admin" : null, (tx) => tx.query(sql)),
      ).rejects.toThrow(NO_EXECUTE);
    }
  });

  it("are SECURITY INVOKER with an empty search_path", async () => {
    const { rows } = await db.owner.query<{
      proname: string;
      prosecdef: boolean;
      proconfig: string[] | null;
    }>(
      `select proname, prosecdef, proconfig from pg_proc
        where proname in ('request_document', 'decide_document_request',
                          'revoke_document_request', 'expire_document_grants')`,
    );
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.prosecdef, row.proname).toBe(false);
      expect(row.proconfig, row.proname).toEqual(['search_path=""']);
    }
  });
});

describe("types.ts", () => {
  it("names every function the migrations create in public", async () => {
    const types = readFileSync(new URL("../types.ts", import.meta.url), "utf8");
    const functions = types.slice(types.indexOf("    Functions: {"), types.indexOf("    Enums: {"));
    const typed = [...functions.matchAll(/^ {6}(\w+): \{/gm)].map(([, name]) => name).toSorted();
    const { rows } = await db.owner.query<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          -- The generator leaves trigger functions out.
          and p.prorettype <> 'trigger'::regtype
        order by p.proname`,
    );
    expect(typed).toEqual(rows.map((row) => row.proname));
  });
});

describe("request_document", () => {
  beforeEach(async () => {
    await db.owner.exec("delete from public.document_requests where client_id = 'client_c'");
  });

  it("makes one pending row per document, in order, duplicates counted once", async () => {
    const rows = await requestDocuments("client_c", [DOC_2, DOC_1, DOC_2]);
    expect(rows.map((row) => [row.document_id, row.status, row.merged])).toEqual([
      [DOC_2, "pending_review", false],
      [DOC_1, "pending_review", false],
    ]);
  });

  it.each(["pending_review", "in_contact", "granted"])(
    "merges into a %s request for the same client and document",
    async (status) => {
      const [first] = await requestDocuments("client_c", [DOC_1], "First purpose");
      await db.owner.query(
        "update public.document_requests set status = $2 where id = $1",
        [first?.request_id, status],
      );
      const rows = await requestDocuments("client_c", [DOC_1, DOC_2], "Second purpose");
      expect(rows[0]).toEqual({
        request_id: first?.request_id,
        document_id: DOC_1,
        status,
        merged: true,
      });
      expect(rows[1]?.merged).toBe(false);
      const { rows: kept } = await db.owner.query<{ purpose: string; n: number }>(
        `select purpose, count(*) over ()::int as n from public.document_requests
          where client_id = 'client_c' and document_id = $1`,
        [DOC_1],
      );
      expect(kept).toEqual([{ purpose: "First purpose", n: 1 }]);
    },
  );

  it.each(["expired", "revoked"])("makes a new row after the old one is %s", async (status) => {
    const [first] = await requestDocuments("client_c", [DOC_1]);
    await db.owner.query(
      "update public.document_requests set status = $2 where id = $1",
      [first?.request_id, status],
    );
    const [again] = await requestDocuments("client_c", [DOC_1]);
    expect(again?.merged).toBe(false);
    expect(again?.request_id).not.toBe(first?.request_id);
    expect(again?.status).toBe("pending_review");
  });

  it("expires a grant whose time has passed, then makes a new row", async () => {
    const [first] = await requestDocuments("client_c", [DOC_1]);
    await db.owner.query(
      `update public.document_requests
          set status = 'granted', granted_at = now() - interval '2 days',
              expires_at = now() - interval '1 day'
        where id = $1`,
      [first?.request_id],
    );
    const [again] = await requestDocuments("client_c", [DOC_1]);
    expect(again?.merged).toBe(false);
    expect((await requestRow(first?.request_id ?? ""))?.status).toBe("expired");
  });

  it("doesn't merge another client's request", async () => {
    const [mine] = await requestDocuments("client_c", [DOC_2]);
    const [theirs] = await requestDocuments("client_b", [DOC_2]);
    expect(theirs?.merged).toBe(false);
    expect(theirs?.request_id).not.toBe(mine?.request_id);
    await db.owner.exec("delete from public.document_requests where client_id = 'client_b'");
  });

  it.each([
    ["a draft document", "client_c", [DRAFT_DOC], "x", "P0002 document_unavailable"],
    ["a missing document", "client_c", [MISSING], "x", "P0002 document_unavailable"],
    ["no documents", "client_c", [], "x", "22023 documents_required"],
    ["an empty purpose", "client_c", [DOC_1], "  ", "22023 purpose_required"],
    ["a team member", "admin", [DOC_1], "x", "42501 not_a_client"],
    ["a disabled client", "disabled_client", [DOC_1], "x", "42501 not_a_client"],
    ["an unknown user", "ghost", [DOC_1], "x", "42501 not_a_client"],
  ] as const)("refuses %s and writes nothing", async (_label, client, docs, purpose, expected) => {
    expect(await sqlState(requestDocuments(client, [...docs], purpose))).toBe(expected);
    const { rows } = await db.owner.query<{ n: number }>(
      "select count(*)::int as n from public.document_requests where client_id = $1",
      [client],
    );
    expect(rows[0]?.n).toBe(0);
  });
});

describe("decide_document_request", () => {
  let requestId: string;

  beforeEach(async () => {
    await db.owner.exec(`
      delete from public.document_requests where client_id in ('client_c', 'client_en');
      delete from public.consultations where kind = 'document_request';
    `);
    const [row] = await requestDocuments("client_c", [DOC_1], "To check my file");
    requestId = row?.request_id ?? "";
  });

  it("grant sets the status, the dates and who decided", async () => {
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const row = await decide(requestId, "grant", { expiresAt });
    expect(row.status).toBe("granted");
    expect(row.granted_at).toBeInstanceOf(Date);
    expect(row.expires_at?.toISOString()).toBe(expiresAt);
    expect(row.decided_by).toBe("admin");
    expect(row.consultation_id).toBeNull();
  });

  it("grant without an expiry leaves expires_at empty", async () => {
    const row = await decide(requestId, "grant");
    expect(row.status).toBe("granted");
    expect(row.expires_at).toBeNull();
  });

  it("contact_first makes exactly one document_request consultation, and a second reuses it", async () => {
    const first = await decide(requestId, "contact_first", { by: "decider" });
    expect(first.status).toBe("in_contact");
    expect(first.consultation_id).not.toBeNull();
    const again = await decide(requestId, "contact_first");
    expect(again.consultation_id).toBe(first.consultation_id);
    const { rows } = await db.owner.query<{
      id: string;
      kind: string;
      client_id: string;
      title: string;
      description: string;
      status: string;
      assigned_to: string;
    }>("select * from public.consultations where kind = 'document_request'");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: first.consultation_id,
      client_id: "client_c",
      title: "خطاب شكر",
      description: "To check my file",
      status: "in_progress",
      assigned_to: "decider",
    });
  });

  it("titles the consultation in the client's language", async () => {
    const [row] = await requestDocuments("client_en", [DOC_1]);
    const decided = await decide(row?.request_id ?? "", "contact_first");
    const { rows } = await db.owner.query<{ title: string }>(
      "select title from public.consultations where id = $1",
      [decided.consultation_id],
    );
    expect(rows[0]?.title).toBe("Thank-you letter");
  });

  it("reopens a closed linked consultation instead of making a second one", async () => {
    const first = await decide(requestId, "contact_first");
    await db.owner.query(
      "update public.consultations set status = 'closed', closed_at = now() where id = $1",
      [first.consultation_id],
    );
    const again = await decide(requestId, "contact_first");
    expect(again.consultation_id).toBe(first.consultation_id);
    const { rows } = await db.owner.query<{ status: string; closed_at: Date | null }>(
      "select status, closed_at from public.consultations where id = $1",
      [first.consultation_id],
    );
    expect(rows[0]).toEqual({ status: "in_progress", closed_at: null });
  });

  it("can grant after contact_first, keeping the chat linked", async () => {
    const contacted = await decide(requestId, "contact_first");
    const granted = await decide(requestId, "grant");
    expect(granted.status).toBe("granted");
    expect(granted.consultation_id).toBe(contacted.consultation_id);
  });

  it.each(["granted", "expired", "revoked"])("refuses a %s request", async (status) => {
    await db.owner.query("update public.document_requests set status = $2 where id = $1", [
      requestId,
      status,
    ]);
    expect(await sqlState(decide(requestId, "grant"))).toBe("55000 request_not_open");
  });

  it.each([
    ["a past expiry", () => decide(requestId, "grant", { expiresAt: "2020-01-01T00:00:00Z" }), "22023 expiry_in_past"],
    ["an expiry on contact_first", () => decide(requestId, "contact_first", { expiresAt: "2999-01-01T00:00:00Z" }), "22023 expiry_needs_grant"],
    ["a missing request", () => decide(MISSING, "grant"), "P0002 request_not_found"],
    ["a recommender", () => decide(requestId, "grant", { by: "recommender" }), "42501 not_allowed"],
    ["a disabled admin", () => decide(requestId, "grant", { by: "disabled_admin" }), "42501 not_allowed"],
    ["a client", () => decide(requestId, "grant", { by: "client_c" }), "42501 not_allowed"],
  ] as const)("refuses %s and changes nothing", async (_label, call, expected) => {
    expect(await sqlState(call())).toBe(expected);
    expect((await requestRow(requestId))?.status).toBe("pending_review");
  });
});

describe("revoke_document_request", () => {
  let requestId: string;

  beforeEach(async () => {
    await db.owner.exec("delete from public.document_requests where client_id = 'client_c'");
    const [row] = await requestDocuments("client_c", [DOC_2]);
    requestId = row?.request_id ?? "";
  });

  it("revokes a granted request", async () => {
    await decide(requestId, "grant");
    const row = await revoke(requestId, "decider");
    expect(row.status).toBe("revoked");
    expect(row.revoked_at).toBeInstanceOf(Date);
    expect(row.decided_by).toBe("decider");
  });

  it.each(["pending_review", "in_contact", "expired", "revoked"])(
    "works only on granted: refuses %s",
    async (status) => {
      await db.owner.query("update public.document_requests set status = $2 where id = $1", [
        requestId,
        status,
      ]);
      expect(await sqlState(revoke(requestId))).toBe("55000 request_not_granted");
      expect((await requestRow(requestId))?.status).toBe(status);
    },
  );

  it("refuses a member without document_requests.decide", async () => {
    await decide(requestId, "grant");
    expect(await sqlState(revoke(requestId, "recommender"))).toBe("42501 not_allowed");
    expect((await requestRow(requestId))?.status).toBe("granted");
  });
});

describe("expire_document_grants", () => {
  it("expires only grants whose time has passed, and is safe to run twice", async () => {
    await db.owner.exec("delete from public.document_requests where client_id = 'client_c'");
    const [past, future, open] = await requestDocuments("client_c", [DOC_1, DOC_2]).then(
      async (rows) => [...rows, ...(await requestDocuments("client_d", [DOC_2]))],
    );
    await db.owner.query(
      `update public.document_requests set status = 'granted', granted_at = now(),
          expires_at = now() - interval '1 minute' where id = $1`,
      [past?.request_id],
    );
    await db.owner.query(
      `update public.document_requests set status = 'granted', granted_at = now(),
          expires_at = now() + interval '1 day' where id = $1`,
      [future?.request_id],
    );
    const { rows: before } = await db.owner.query<{ n: number }>(
      "select count(*)::int as n from public.document_requests where status = 'granted' and expires_at <= now()",
    );
    expect(await expireGrants()).toBe(before[0]?.n);
    expect((await requestRow(past?.request_id ?? ""))?.status).toBe("expired");
    expect((await requestRow(future?.request_id ?? ""))?.status).toBe("granted");
    expect((await requestRow(open?.request_id ?? ""))?.status).toBe("pending_review");
    expect(await expireGrants()).toBe(0);
  });
});

describe("RLS on the client work tables, role by role", () => {
  let contactConsultation: string;
  let requestA: string;

  beforeAll(async () => {
    await db.owner.exec(`
      delete from public.document_requests;
      delete from public.consultations where kind = 'document_request';
    `);
    const [a] = await requestDocuments("client_a", [DOC_1], "A's purpose");
    await requestDocuments("client_b", [DOC_2], "B's purpose");
    requestA = a?.request_id ?? "";
    contactConsultation = (await decide(requestA, "contact_first", { by: "decider" }))
      .consultation_id as string;
    await db.owner.query(
      `insert into public.document_recommendations (request_id, member_id, recommendation)
       values ($1, 'recommender', 'approve')`,
      [requestA],
    );
    await db.owner.query(
      `insert into public.document_access_log (request_id, document_id, client_id, action)
       values ($1, $2, 'client_a', 'view')`,
      [requestA, DOC_1],
    );
  });

  const seen = (user: string | null, sql: string) =>
    db.runAs(user ? "authenticated" : "anon", user, async (tx) => {
      const { rows } = await tx.query<{ v: string }>(sql);
      return rows.map((row) => row.v).toSorted();
    });

  const clientsOf = (user: string) =>
    seen(user, "select distinct client_id as v from public.consultations");

  it("a client sees only their own consultations, chat, files and meetings", async () => {
    expect(await clientsOf("client_a")).toEqual(["client_a"]);
    for (const table of ["consultation_messages", "consultation_attachments", "meetings"]) {
      const ids = await seen(
        "client_a",
        `select distinct t.consultation_id::text as v from public.${table} t`,
      );
      expect(ids, table).toEqual([CONSULT_A]);
    }
  });

  it("the client sees the contact_first consultation made for them; another client doesn't", async () => {
    const own = await seen("client_a", "select id::text as v from public.consultations");
    expect(own).toContain(contactConsultation);
    const other = await seen("client_b", "select id::text as v from public.consultations");
    expect(other).not.toContain(contactConsultation);
  });

  it("an assistant sees only assigned consultations", async () => {
    expect(await seen("assistant", "select id::text as v from public.consultations")).toEqual([
      CONSULT_A,
    ]);
    expect(await seen("other_assistant", "select id::text as v from public.consultations")).toEqual(
      [],
    );
  });

  it("the decider follows the contact_first chat, as its assignee", async () => {
    expect(await seen("decider", "select id::text as v from public.consultations")).toEqual([
      contactConsultation,
    ]);
  });

  it("consultations.view_all sees every consultation", async () => {
    expect(await clientsOf("viewer")).toEqual(["client_a", "client_b"]);
  });

  it("a client sees only their own requests, and no recommendation or log", async () => {
    expect(await seen("client_a", "select client_id as v from public.document_requests")).toEqual([
      "client_a",
    ]);
    expect(await seen("client_a", "select id::text as v from public.document_recommendations")).toEqual(
      [],
    );
    expect(await seen("client_a", "select id::text as v from public.document_access_log")).toEqual(
      [],
    );
  });

  it("document_requests.recommend sees every request and recommendation, not the log", async () => {
    expect(await seen("recommender", "select client_id as v from public.document_requests")).toEqual(
      ["client_a", "client_b"],
    );
    expect(
      await seen("recommender", "select request_id::text as v from public.document_recommendations"),
    ).toEqual([requestA]);
    expect(await seen("recommender", "select id::text as v from public.document_access_log")).toEqual(
      [],
    );
  });

  it("document_requests.decide sees requests, recommendations and the log", async () => {
    expect(await seen("decider", "select client_id as v from public.document_requests")).toHaveLength(2);
    expect(await seen("decider", "select request_id::text as v from public.document_access_log")).toEqual(
      [requestA],
    );
  });

  it("documents: documents.view sees all; a client only what they requested; nobody else nothing", async () => {
    expect(await seen("doc_viewer", "select id::text as v from public.documents")).toHaveLength(3);
    expect(await seen("client_a", "select id::text as v from public.documents")).toEqual([DOC_1]);
    expect(await seen("nobody", "select id::text as v from public.documents")).toEqual([]);
  });

  it("a member with no permission sees nothing", async () => {
    for (const table of [
      "consultations",
      "consultation_messages",
      "consultation_attachments",
      "meetings",
      "document_requests",
      "document_recommendations",
      "document_access_log",
    ]) {
      expect(await seen("nobody", `select id::text as v from public.${table}`), table).toEqual([]);
    }
  });

  it("anon reads nothing", async () => {
    for (const table of [
      "consultations",
      "consultation_messages",
      "meetings",
      "document_requests",
      "document_recommendations",
      "document_access_log",
    ]) {
      await expect(seen(null, `select id::text as v from public.${table}`), table).rejects.toThrow(
        /permission denied/,
      );
    }
  });
});
