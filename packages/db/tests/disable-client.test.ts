import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type ApiRole, type TestDb } from "../supabase-pglite";

const NO_ACCESS = /permission denied/;
const uuid = (n: number) =>
  `123e4567-e89b-42d3-a456-4266141741${String(n).padStart(2, "0")}`;

/** client_a: three open (one a document request) and one already closed. */
const A_NEW = uuid(1);
const A_SCHEDULED = uuid(2);
const A_DOCUMENT = uuid(3);
const A_CLOSED = uuid(4);
/** client_b: one open, never touched. */
const B_NEW = uuid(5);
const CLOSED_AT = "2026-01-01T00:00:00.000Z";

let db: TestDb;

async function addProfile(clerkUserId: string, roleKey: string | null = null) {
  await db.owner.query(
    `insert into public.profiles
       (clerk_user_id, full_name, email, phone, timezone, terms_accepted_at, role_id)
     values ($1, 'Test', $1 || '@example.com', '+966500000000', 'Asia/Riyadh', now(),
       (select id from public.roles where key = $2))`,
    [clerkUserId, roleKey],
  );
}

const disableClient = (clientId: string, role: ApiRole = "service_role") =>
  db.runAs(role, null, async (tx) => {
    const { rows } = await tx.query<{ closed: number | null }>(
      "select public.disable_client($1) as closed",
      [clientId],
    );
    return rows[0]?.closed;
  });

async function statusOf(clerkUserId: string) {
  const { rows } = await db.owner.query<{ status: string }>(
    "select status from public.profiles where clerk_user_id = $1",
    [clerkUserId],
  );
  return rows[0]?.status;
}

async function consultationsOf(clientId: string) {
  const { rows } = await db.owner.query<{
    id: string;
    status: string;
    closed_at: Date | null;
  }>(
    "select id, status, closed_at from public.consultations where client_id = $1",
    [clientId],
  );
  return new Map(rows.map((row) => [row.id, row]));
}

beforeAll(async () => {
  db = await createTestDb();

  await addProfile("client_a");
  await addProfile("client_b");
  await addProfile("user_assistant", "assistant_consultant");

  await db.owner.exec(`
    insert into public.consultations
      (id, kind, client_id, title, description, status, assigned_to, closed_at)
    values
      ('${A_NEW}', 'consultation', 'client_a', 'T', 'D', 'new', null, null),
      ('${A_SCHEDULED}', 'consultation', 'client_a', 'T', 'D', 'scheduled', 'user_assistant', null),
      ('${A_DOCUMENT}', 'document_request', 'client_a', 'T', 'D', 'in_review', null, null),
      ('${A_CLOSED}', 'consultation', 'client_a', 'T', 'D', 'closed', null, '${CLOSED_AT}'),
      ('${B_NEW}', 'consultation', 'client_b', 'T', 'D', 'new', 'user_assistant', null);
  `);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("disable_client grants", () => {
  it.each(["anon", "authenticated"] as const)(
    "can't be executed by %s",
    async (role) => {
      await expect(disableClient("client_a", role)).rejects.toThrow(NO_ACCESS);
      expect(await statusOf("client_a")).toBe("active");
    },
  );

  it("is granted to service_role only", async () => {
    const { rows } = await db.owner.query<{ role: string; allowed: boolean }>(
      `select r as role,
              has_function_privilege(r, 'public.disable_client(text)', 'execute') as allowed
       from unnest(array['anon', 'authenticated', 'service_role']) r`,
    );
    expect(rows).toEqual([
      { role: "anon", allowed: false },
      { role: "authenticated", allowed: false },
      { role: "service_role", allowed: true },
    ]);
  });

  it("isn't executable by PUBLIC", async () => {
    const { rows } = await db.owner.query<{ acl: string }>(
      `select proacl::text as acl from pg_proc
       where oid = 'public.disable_client(text)'::regprocedure`,
    );
    expect(rows[0]?.acl).not.toMatch(/[{,]=X/);
  });

  it("is SECURITY INVOKER with an empty search_path", async () => {
    const { rows } = await db.owner.query(
      `select prosecdef, proconfig from pg_proc
       where oid = 'public.disable_client(text)'::regprocedure`,
    );
    expect(rows).toEqual([{ prosecdef: false, proconfig: ['search_path=""'] }]);
  });
});

describe("disable_client", () => {
  it("returns null for an unknown id, and changes nothing", async () => {
    expect(await disableClient("nobody")).toBeNull();
  });

  it("leaves a team member untouched", async () => {
    expect(await disableClient("user_assistant")).toBeNull();
    expect(await statusOf("user_assistant")).toBe("active");
  });

  it("disables the client and returns how many consultations it closed", async () => {
    const before = Date.now();
    expect(await disableClient("client_a")).toBe(3);
    expect(await statusOf("client_a")).toBe("disabled");

    const rows = await consultationsOf("client_a");
    for (const id of [A_NEW, A_SCHEDULED, A_DOCUMENT]) {
      expect(rows.get(id)?.status).toBe("closed");
      expect(rows.get(id)?.closed_at?.getTime()).toBeGreaterThanOrEqual(
        before - 1000,
      );
    }
  });

  it("leaves an already closed consultation as it was", async () => {
    const closed = (await consultationsOf("client_a")).get(A_CLOSED);
    expect(closed?.status).toBe("closed");
    expect(closed?.closed_at?.toISOString()).toBe(CLOSED_AT);
  });

  it("keeps the consultation's other fields", async () => {
    const { rows } = await db.owner.query<{ assigned_to: string; kind: string }>(
      "select assigned_to, kind from public.consultations where id = $1",
      [A_SCHEDULED],
    );
    expect(rows[0]).toEqual({
      assigned_to: "user_assistant",
      kind: "consultation",
    });
  });

  it("leaves another client and their consultations alone", async () => {
    expect(await statusOf("client_b")).toBe("active");
    const other = (await consultationsOf("client_b")).get(B_NEW);
    expect(other).toMatchObject({ status: "new", closed_at: null });
  });

  it("gives the same result when run twice", async () => {
    const first = await consultationsOf("client_a");
    expect(await disableClient("client_a")).toBe(0);
    expect(await statusOf("client_a")).toBe("disabled");
    expect(await consultationsOf("client_a")).toEqual(first);
  });

  it("closes a consultation opened after a reactivation", async () => {
    await db.owner.exec(`
      update public.profiles set status = 'active' where clerk_user_id = 'client_a';
      insert into public.consultations (client_id, title, description)
        values ('client_a', 'Again', 'D');
    `);
    expect(await disableClient("client_a")).toBe(1);
    expect(await statusOf("client_a")).toBe("disabled");
  });

  it("rolls back with the caller's transaction", async () => {
    await expect(
      db.runAs("service_role", null, async (tx) => {
        await tx.query("select public.disable_client($1)", ["client_b"]);
        throw new Error("later step failed");
      }),
    ).rejects.toThrow("later step failed");
    expect(await statusOf("client_b")).toBe("active");
    expect((await consultationsOf("client_b")).get(B_NEW)?.status).toBe("new");
  });
});
