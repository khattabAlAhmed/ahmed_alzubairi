import type { Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLE_KEYS,
  ROLE_PERMISSIONS,
  type Permission,
  type RoleKey,
} from "../../shared/permissions";
import { createTestDb, type ApiRole, type TestDb } from "../supabase-pglite";

const TABLES = [
  "roles",
  "role_permissions",
  "profiles",
  "audit_log",
  "notifications",
];
const ALL_PERMISSIONS = Object.values(PERMISSIONS);
const NO_ACCESS = /permission denied/;

let db: TestDb;

const memberId = (role: string) => `user_${role}`;

async function addProfile(
  clerkUserId: string,
  options: { roleKey?: string; status?: string } = {},
) {
  await db.owner.query(
    `insert into public.profiles
       (clerk_user_id, full_name, email, phone, timezone, terms_accepted_at, status, role_id)
     values ($1, 'Test', $1 || '@example.com', '+966500000000', 'Asia/Riyadh', now(), $2,
       (select id from public.roles where key = $3))`,
    [clerkUserId, options.status ?? "active", options.roleKey ?? null],
  );
}

async function addRole(key: string, permissions: Permission[]) {
  await db.owner.query(
    `insert into public.roles (key, name_ar, name_en) values ($1, $1, $1)`,
    [key],
  );
  for (const permission of permissions) {
    await db.owner.query(
      `insert into public.role_permissions (role_id, permission)
       select id, $2 from public.roles where key = $1`,
      [key, permission],
    );
  }
}

const hasPermission = (clerkUserId: string | null, key: string) =>
  db.runAs("authenticated", clerkUserId, async (tx) => {
    const { rows } = await tx.query<{ allowed: boolean }>(
      "select public.has_permission($1) as allowed",
      [key],
    );
    return rows[0]?.allowed;
  });

const profileIdsSeenBy = (clerkUserId: string) =>
  db.runAs("authenticated", clerkUserId, async (tx) => {
    const { rows } = await tx.query<{ clerk_user_id: string }>(
      "select clerk_user_id from public.profiles",
    );
    return rows.map((row) => row.clerk_user_id).toSorted();
  });

const countSeenBy = (clerkUserId: string, table: string) =>
  db.runAs("authenticated", clerkUserId, async (tx) => {
    const { rows } = await tx.query<{ count: number }>(
      `select count(*)::int as count from public.${table}`,
    );
    return rows[0]?.count;
  });

const exec = (sql: string) => (tx: Transaction) => tx.exec(sql);

beforeAll(async () => {
  db = await createTestDb();

  await addProfile("client_a");
  await addProfile("client_b");
  for (const role of ROLE_KEYS) await addProfile(memberId(role), { roleKey: role });
  await addProfile("disabled_admin", { roleKey: "admin", status: "disabled" });

  await addRole("clients_only", [PERMISSIONS.CLIENTS_VIEW_ALL]);
  await addProfile("user_clients_only", { roleKey: "clients_only" });
  await addRole("team_only", [PERMISSIONS.TEAM_MANAGE]);
  await addProfile("user_team_only", { roleKey: "team_only" });

  await db.owner.exec(`
    insert into public.audit_log (actor_id, action, entity) values ('user_admin', 'seed', 'test');
    insert into public.notifications (user_id, type) values
      ('client_a', 'new_reply'), ('client_b', 'new_reply');
  `);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("seed", () => {
  it("has the four §5 roles, with their exact names", async () => {
    const { rows } = await db.owner.query(
      `select key, name_ar, name_en, is_system from public.roles
       where is_system order by key`,
    );
    expect(rows).toEqual([
      { key: "admin", name_ar: "المدير", name_en: "Admin", is_system: true },
      {
        key: "assistant_consultant",
        name_ar: "مستشار مساعد",
        name_en: "Assistant Consultant",
        is_system: true,
      },
      {
        key: "content_editor",
        name_ar: "محرر محتوى",
        name_en: "Content Editor",
        is_system: true,
      },
      {
        key: "training_coordinator",
        name_ar: "منسق تدريب",
        name_en: "Training Coordinator",
        is_system: true,
      },
    ]);
  });

  it("matches ROLE_PERMISSIONS exactly", async () => {
    const { rows } = await db.owner.query<{ key: RoleKey; permission: string }>(
      `select r.key, rp.permission
       from public.role_permissions rp
       join public.roles r on r.id = rp.role_id
       where r.is_system`,
    );
    const seeded = rows.map((row) => `${row.key}:${row.permission}`).toSorted();
    const expected = ROLE_KEYS.flatMap((role) =>
      ROLE_PERMISSIONS[role].map((permission) => `${role}:${permission}`),
    ).toSorted();
    expect(seeded).toEqual(expected);
  });
});

describe("has_permission", () => {
  it.each(
    ROLE_KEYS.flatMap((role) =>
      ALL_PERMISSIONS.map((key) => ({
        role,
        key,
        allowed: ROLE_PERMISSIONS[role].includes(key),
      })),
    ),
  )("$role / $key is $allowed", async ({ role, key, allowed }) => {
    expect(await hasPermission(memberId(role), key)).toBe(allowed);
  });

  it.each(ALL_PERMISSIONS)("refuses %s to a client", async (key) => {
    expect(await hasPermission("client_a", key)).toBe(false);
  });

  it.each(ALL_PERMISSIONS)("refuses %s without a profile", async (key) => {
    expect(await hasPermission("user_with_no_profile", key)).toBe(false);
  });

  it.each(ALL_PERMISSIONS)("refuses %s without a token", async (key) => {
    expect(await hasPermission(null, key)).toBe(false);
  });

  it.each(ALL_PERMISSIONS)("refuses %s to a disabled admin", async (key) => {
    expect(await hasPermission("disabled_admin", key)).toBe(false);
  });

  it("refuses an unknown key, even to an admin", async () => {
    expect(await hasPermission(memberId("admin"), "nope.nope")).toBe(false);
  });

  it.each<ApiRole>(["anon", "service_role"])(
    "can't be called as %s",
    async (role) => {
      await expect(
        db.runAs(role, null, exec("select public.has_permission('team.manage')")),
      ).rejects.toThrow(NO_ACCESS);
    },
  );

  it("is SECURITY DEFINER with an empty search_path", async () => {
    const { rows } = await db.owner.query(
      `select prosecdef, proconfig from pg_proc
       where oid = 'public.has_permission(text)'::regprocedure`,
    );
    expect(rows).toEqual([{ prosecdef: true, proconfig: ['search_path=""'] }]);
  });
});

describe("every table in public", () => {
  it("includes the five people tables", async () => {
    const { rows } = await db.owner.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public'",
    );
    expect(rows.map((row) => row.tablename)).toEqual(
      expect.arrayContaining(TABLES),
    );
  });

  it("has RLS on", async () => {
    const { rows } = await db.owner.query(
      `select c.relname from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });

  it("gives anon no privilege at all", async () => {
    const { rows } = await db.owner.query(
      `select table_name, privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and grantee in ('anon', 'PUBLIC')`,
    );
    expect(rows).toEqual([]);
  });

  it("gives authenticated SELECT only", async () => {
    const { rows } = await db.owner.query(
      `select table_name, privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and grantee = 'authenticated'
         and privilege_type <> 'SELECT'`,
    );
    expect(rows).toEqual([]);
  });
});

describe.each(TABLES)("%s", (table) => {
  it("can't be read by anon", async () => {
    await expect(
      db.runAs("anon", null, exec(`select * from public.${table}`)),
    ).rejects.toThrow(NO_ACCESS);
  });

  it.each<ApiRole>(["anon", "authenticated", "service_role"])(
    "can't be truncated by %s",
    async (role) => {
      await expect(
        db.runAs(role, memberId("admin"), exec(`truncate public.${table} cascade`)),
      ).rejects.toThrow(NO_ACCESS);
    },
  );

  it("can't be deleted from by an admin's token", async () => {
    await expect(
      db.runAs("authenticated", memberId("admin"), exec(`delete from public.${table}`)),
    ).rejects.toThrow(NO_ACCESS);
  });
});

describe("profiles", () => {
  it("shows a client only their own", async () => {
    expect(await profileIdsSeenBy("client_a")).toEqual(["client_a"]);
  });

  it("shows nothing to a user with no profile", async () => {
    expect(await profileIdsSeenBy("user_with_no_profile")).toEqual([]);
  });

  it("refuses other profiles to a team member without the permission", async () => {
    const member = memberId("content_editor");
    expect(await profileIdsSeenBy(member)).toEqual([member]);
  });

  it("refuses other profiles to a disabled admin", async () => {
    expect(await profileIdsSeenBy("disabled_admin")).toEqual(["disabled_admin"]);
  });

  it("shows clients, not the team, with clients.view_all", async () => {
    expect(await profileIdsSeenBy("user_clients_only")).toEqual([
      "client_a",
      "client_b",
      "user_clients_only",
    ]);
  });

  it("shows the team, not clients, with team.manage", async () => {
    const seen = await profileIdsSeenBy("user_team_only");
    expect(seen).toContain(memberId("content_editor"));
    expect(seen).toContain("disabled_admin");
    expect(seen).not.toContain("client_a");
  });

  it("shows an admin everyone", async () => {
    const seen = await profileIdsSeenBy(memberId("admin"));
    expect(seen).toContain("client_a");
    expect(seen).toContain(memberId("content_editor"));
  });
});

describe("a client has no write grant on", () => {
  it.each([
    [
      "their own profile",
      "update public.profiles set full_name = 'x' where clerk_user_id = 'client_a'",
    ],
    [
      "a role onto their own profile",
      "update public.profiles set role_id = (select id from public.roles where key = 'admin') where clerk_user_id = 'client_a'",
    ],
    [
      "a new profile",
      "insert into public.profiles (clerk_user_id, full_name, email, phone, timezone, terms_accepted_at) values ('x', 'x', 'x', 'x', 'UTC', now())",
    ],
    ["a role", "insert into public.roles (key, name_ar, name_en) values ('x', 'x', 'x')"],
    ["a role permission", "delete from public.role_permissions"],
    ["the audit log", "insert into public.audit_log (action, entity) values ('x', 'x')"],
    ["their notifications", "update public.notifications set read_at = now()"],
  ])("%s", async (_label, sql) => {
    await expect(
      db.runAs("authenticated", "client_a", exec(sql)),
    ).rejects.toThrow(NO_ACCESS);
  });
});

describe("roles, role_permissions and audit_log", () => {
  it.each(["roles", "role_permissions", "audit_log"])(
    "%s needs team.manage",
    async (table) => {
      expect(await countSeenBy("client_a", table)).toBe(0);
      expect(await countSeenBy(memberId("assistant_consultant"), table)).toBe(0);
      expect(await countSeenBy("disabled_admin", table)).toBe(0);
      expect(await countSeenBy("user_team_only", table)).toBeGreaterThan(0);
    },
  );
});

describe("notifications", () => {
  it("shows a user only their own", async () => {
    const seen = await db.runAs("authenticated", "client_a", async (tx) => {
      const { rows } = await tx.query<{ user_id: string }>(
        "select user_id from public.notifications",
      );
      return rows.map((row) => row.user_id);
    });
    expect(seen).toEqual(["client_a"]);
  });

  it("hides them from an admin", async () => {
    expect(await countSeenBy(memberId("admin"), "notifications")).toBe(0);
  });
});

describe("audit_log is append only", () => {
  it("lets service_role add a row and read it", async () => {
    const count = await db.runAs("service_role", null, async (tx) => {
      await tx.exec(
        "insert into public.audit_log (action, entity) values ('test', 'test')",
      );
      const { rows } = await tx.query<{ count: number }>(
        "select count(*)::int as count from public.audit_log where action = 'test'",
      );
      return rows[0]?.count;
    });
    expect(count).toBe(1);
  });

  it.each([
    ["update", "update public.audit_log set action = 'x'"],
    ["delete", "delete from public.audit_log"],
  ])("refuses %s, even to service_role", async (_label, sql) => {
    await expect(db.runAs("service_role", null, exec(sql))).rejects.toThrow(
      NO_ACCESS,
    );
  });
});

describe("service_role", () => {
  it("reads and writes past RLS", async () => {
    const name = await db.runAs("service_role", null, async (tx) => {
      await tx.exec(
        "update public.profiles set full_name = 'Changed' where clerk_user_id = 'client_b'",
      );
      const { rows } = await tx.query<{ full_name: string }>(
        "select full_name from public.profiles where clerk_user_id = 'client_b'",
      );
      return rows[0]?.full_name;
    });
    expect(name).toBe("Changed");
  });
});
