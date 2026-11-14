import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type ApiRole, type TestDb } from "../supabase-pglite";

const NO_ACCESS = /permission denied/;
const SIGNATURE = "public.set_role_permissions(uuid, text, text, text[])";
const UNKNOWN_ROLE = "123e4567-e89b-42d3-a456-426614174199";

/** The seeded permissions of `content_editor` (project.md §5), sorted. */
const EDITOR_SEED = [
  "content.manage",
  "document_requests.recommend",
  "documents.view",
];

type Changes = {
  nameAr?: string;
  nameEn?: string;
  permissions?: string[];
};

let db: TestDb;

async function roleId(key: string): Promise<string> {
  const { rows } = await db.owner.query<{ id: string }>(
    "select id from public.roles where key = $1",
    [key],
  );
  const role = rows[0];
  if (!role) throw new Error(`no role ${key}`);
  return role.id;
}

async function roleOf(key: string) {
  const { rows } = await db.owner.query<{
    name_ar: string;
    name_en: string;
    permissions: string[];
  }>(
    `select r.name_ar, r.name_en,
            coalesce(array_agg(rp.permission order by rp.permission)
              filter (where rp.permission is not null), '{}') as permissions
     from public.roles r
     left join public.role_permissions rp on rp.role_id = r.id
     where r.key = $1
     group by r.id`,
    [key],
  );
  const role = rows[0];
  if (!role) throw new Error(`no role ${key}`);
  return role;
}

const setRole = (id: string, changes: Changes, role: ApiRole = "service_role") =>
  db.runAs(role, null, async (tx) => {
    const { rows } = await tx.query<{ result: string }>(
      `select public.set_role_permissions(
         role_id => $1, name_ar => $2, name_en => $3, permissions => $4
       ) as result`,
      [
        id,
        changes.nameAr ?? null,
        changes.nameEn ?? null,
        changes.permissions ?? null,
      ],
    );
    return rows[0]?.result;
  });

const hasPermission = (clerkUserId: string, key: string) =>
  db.runAs("authenticated", clerkUserId, async (tx) => {
    const { rows } = await tx.query<{ allowed: boolean }>(
      "select public.has_permission($1) as allowed",
      [key],
    );
    return rows[0]?.allowed;
  });

beforeAll(async () => {
  db = await createTestDb();
  await db.owner.query(
    `insert into public.profiles
       (clerk_user_id, full_name, email, phone, timezone, terms_accepted_at, role_id)
     values ('user_editor', 'Test', 'user_editor@example.com', '+966500000000',
       'Asia/Riyadh', now(), (select id from public.roles where key = 'content_editor'))`,
  );
}, 60_000);

afterAll(async () => {
  await db.close();
});

/** Each test starts from the seeded content editor role. */
beforeEach(async () => {
  await db.owner.query(
    `update public.roles set name_ar = 'محرر محتوى', name_en = 'Content Editor'
     where key = 'content_editor'`,
  );
  await db.owner.query(
    `delete from public.role_permissions
     where role_id = (select id from public.roles where key = 'content_editor')`,
  );
  await db.owner.query(
    `insert into public.role_permissions (role_id, permission)
     select r.id, p from public.roles r, unnest($1::text[]) p
     where r.key = 'content_editor'`,
    [EDITOR_SEED],
  );
});

describe("set_role_permissions grants", () => {
  it.each(["anon", "authenticated"] as const)(
    "can't be executed by %s",
    async (role) => {
      const id = await roleId("content_editor");
      await expect(setRole(id, { permissions: [] }, role)).rejects.toThrow(
        NO_ACCESS,
      );
      expect((await roleOf("content_editor")).permissions).toEqual(EDITOR_SEED);
    },
  );

  it("is granted to service_role only", async () => {
    const { rows } = await db.owner.query<{ role: string; allowed: boolean }>(
      `select r as role,
              has_function_privilege(r, '${SIGNATURE}', 'execute') as allowed
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
       where oid = '${SIGNATURE}'::regprocedure`,
    );
    expect(rows[0]?.acl).not.toMatch(/[{,]=X/);
  });

  it("is SECURITY INVOKER with an empty search_path", async () => {
    const { rows } = await db.owner.query(
      `select prosecdef, proconfig from pg_proc
       where oid = '${SIGNATURE}'::regprocedure`,
    );
    expect(rows).toEqual([{ prosecdef: false, proconfig: ['search_path=""'] }]);
  });
});

describe("set_role_permissions", () => {
  it("adds and removes permissions in one call", async () => {
    const id = await roleId("content_editor");
    const result = await setRole(id, {
      permissions: ["documents.view", "messages.view", "training.manage"],
    });
    expect(result).toBe("updated");
    expect((await roleOf("content_editor")).permissions).toEqual([
      "documents.view",
      "messages.view",
      "training.manage",
    ]);
  });

  it("writes the names and the permissions together", async () => {
    const id = await roleId("content_editor");
    await setRole(id, {
      nameAr: "محرر",
      nameEn: "Editor",
      permissions: ["content.manage"],
    });
    expect(await roleOf("content_editor")).toEqual({
      name_ar: "محرر",
      name_en: "Editor",
      permissions: ["content.manage"],
    });
  });

  it("a null argument leaves that value as it is", async () => {
    const id = await roleId("content_editor");
    expect(await setRole(id, { nameEn: "Editor" })).toBe("updated");
    expect(await roleOf("content_editor")).toEqual({
      name_ar: "محرر محتوى",
      name_en: "Editor",
      permissions: EDITOR_SEED,
    });
  });

  it("an empty list removes every permission", async () => {
    const id = await roleId("content_editor");
    expect(await setRole(id, { permissions: [] })).toBe("updated");
    expect((await roleOf("content_editor")).permissions).toEqual([]);
  });

  it("a permission listed twice is stored once", async () => {
    const id = await roleId("content_editor");
    await setRole(id, { permissions: ["documents.view", "documents.view"] });
    expect((await roleOf("content_editor")).permissions).toEqual([
      "documents.view",
    ]);
  });

  it("leaves every other role alone", async () => {
    const before = await roleOf("training_coordinator");
    await setRole(await roleId("content_editor"), { permissions: [] });
    expect(await roleOf("training_coordinator")).toEqual(before);
  });

  it.each([
    ["its permissions", { permissions: ["team.manage"] }],
    ["every permission", { permissions: [] }],
    ["its names", { nameAr: "مالك", nameEn: "Owner" }],
  ])("refuses to change the admin role's %s", async (_label, changes) => {
    const before = await roleOf("admin");
    expect(await setRole(await roleId("admin"), changes)).toBe("admin_role");
    expect(await roleOf("admin")).toEqual(before);
    expect(before.permissions).toHaveLength(14);
  });

  it("returns not_found for an unknown role, and writes nothing", async () => {
    const result = await setRole(UNKNOWN_ROLE, {
      permissions: ["content.manage"],
    });
    expect(result).toBe("not_found");
    const { rows } = await db.owner.query(
      "select 1 from public.role_permissions where role_id = $1",
      [UNKNOWN_ROLE],
    );
    expect(rows).toEqual([]);
  });

  it("a member loses a permission at once, and has it again once it is back", async () => {
    const id = await roleId("content_editor");
    expect(await hasPermission("user_editor", "content.manage")).toBe(true);

    await setRole(id, {
      permissions: ["document_requests.recommend", "documents.view"],
    });
    expect(await hasPermission("user_editor", "content.manage")).toBe(false);
    expect(await hasPermission("user_editor", "documents.view")).toBe(true);

    await setRole(id, { permissions: EDITOR_SEED });
    expect(await hasPermission("user_editor", "content.manage")).toBe(true);
  });

  it("a failed call leaves the old set whole", async () => {
    const id = await roleId("content_editor");
    // The transaction fails after the function ran, as a dropped request does.
    await expect(
      db.runAs("service_role", null, async (tx) => {
        await tx.query(
          "select public.set_role_permissions(role_id => $1, permissions => $2)",
          [id, ["messages.view"]],
        );
        throw new Error("connection lost");
      }),
    ).rejects.toThrow("connection lost");
    expect((await roleOf("content_editor")).permissions).toEqual(EDITOR_SEED);
  });
});
