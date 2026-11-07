import { readFileSync } from "node:fs";
import type { Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  COURSE_TYPES,
  ORG_TYPES,
  PERMISSIONS,
  ROLE_KEYS,
  ROLE_PERMISSIONS,
  type Permission,
} from "../../shared/index";
import {
  FAQ_CATEGORIES,
  HOME_SECTION_KEYS,
  MEDIA_CATEGORIES,
  PAGE_KEYS,
  RESOURCE_ACCESS_MODES,
  RESOURCE_KINDS,
  TIMELINE_KINDS,
} from "../../shared/content";
import { createTestDb, type ApiRole, type TestDb } from "../supabase-pglite";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const ALL_PERMISSIONS = Object.values(PERMISSIONS);
const NO_ACCESS = /permission denied/;

/** The permissions that may read each table. */
const TABLES: Record<string, Permission[]> = {
  site_settings: [PERMISSIONS.TEAM_MANAGE],
  home_sections: [PERMISSIONS.CONTENT_MANAGE],
  home_stats: [PERMISSIONS.CONTENT_MANAGE],
  pages: [PERMISSIONS.CONTENT_MANAGE],
  timeline_items: [PERMISSIONS.CONTENT_MANAGE],
  expertise_areas: [PERMISSIONS.CONTENT_MANAGE],
  services: [PERMISSIONS.CONTENT_MANAGE],
  projects: [PERMISSIONS.CONTENT_MANAGE],
  project_images: [PERMISSIONS.CONTENT_MANAGE],
  project_services: [PERMISSIONS.CONTENT_MANAGE],
  faqs: [PERMISSIONS.CONTENT_MANAGE],
  partners: [PERMISSIONS.CONTENT_MANAGE, PERMISSIONS.TESTIMONIALS_APPROVE],
  testimonials: [PERMISSIONS.CONTENT_MANAGE, PERMISSIONS.TESTIMONIALS_APPROVE],
  posts: [PERMISSIONS.CONTENT_MANAGE],
  resources: [PERMISSIONS.CONTENT_MANAGE],
  media_items: [PERMISSIONS.CONTENT_MANAGE],
  courses: [PERMISSIONS.TRAINING_MANAGE],
};
const TABLE_NAMES = Object.keys(TABLES);

const onlyRole = (permission: string) => `only_${permission.replace(".", "_")}`;

let db: TestDb;

const exec = (sql: string) => (tx: Transaction) => tx.exec(sql);

const countSeenBy = (clerkUserId: string, table: string) =>
  db.runAs("authenticated", clerkUserId, async (tx) => {
    const { rows } = await tx.query<{ count: number }>(
      `select count(*)::int as count from public.${table}`,
    );
    return rows[0]?.count;
  });

async function addProfile(
  clerkUserId: string,
  roleKey: string | null,
  status = "active",
) {
  await db.owner.query(
    `insert into public.profiles
       (clerk_user_id, full_name, email, phone, timezone, terms_accepted_at, status, role_id)
     values ($1, 'Test', $1 || '@example.com', '+966500000000', 'Asia/Riyadh', now(), $2,
       (select id from public.roles where key = $3))`,
    [clerkUserId, status, roleKey],
  );
}

/** One published row in every table, so an empty read proves RLS and not an empty table. */
const PUBLISHED_ROWS = `
  insert into public.site_settings (key, value) values ('cv_visible', 'true');
  update public.home_sections set status = 'published', is_visible = true;
  insert into public.home_stats (status) values ('published');
  insert into public.pages (key, status) values ('about', 'published');
  insert into public.timeline_items (kind, status) values ('career', 'published');
  insert into public.expertise_areas (id, slug, status) values ('${ID}', 'area', 'published');
  insert into public.services (id, slug, status) values ('${ID}', 'service', 'published');
  insert into public.projects (id, slug, status, org_name_ar, hide_org_name)
    values ('${ID}', 'project', 'published', 'hidden', true);
  insert into public.project_images (project_id, path) values ('${ID}', 'a.png');
  insert into public.project_services (project_id, service_id) values ('${ID}', '${ID}');
  insert into public.faqs (category, status) values ('account', 'published');
  insert into public.partners (id, status, consent_confirmed, admin_approved)
    values ('${ID}', 'published', true, true);
  insert into public.testimonials (partner_id, letter_path, status, consent_confirmed, admin_approved)
    values ('${ID}', 'letters/secret.pdf', 'published', true, true);
  insert into public.posts (slug_en, status) values ('post', 'published');
  insert into public.resources (kind, storage_key, access, status)
    values ('guide', 'a.pdf', 'direct', 'published');
  insert into public.media_items (category, status) values ('media', 'published');
  insert into public.courses (slug, type, status) values ('course', 'custom', 'published');
`;

let fresh: { homeSections: unknown[]; emptyTables: Record<string, number> };

beforeAll(async () => {
  db = await createTestDb();

  const { rows: homeSections } = await db.owner.query(
    `select key, position, is_visible, content_ar, content_en, status
     from public.home_sections order by position`,
  );
  const emptyTables: Record<string, number> = {};
  for (const table of TABLE_NAMES.filter((name) => name !== "home_sections")) {
    const { rows } = await db.owner.query<{ count: number }>(
      `select count(*)::int as count from public.${table}`,
    );
    emptyTables[table] = rows[0]?.count ?? -1;
  }
  fresh = { homeSections, emptyTables };

  await db.owner.exec(PUBLISHED_ROWS);
  await addProfile("client", null);
  await addProfile("disabled_admin", "admin", "disabled");
  for (const role of ROLE_KEYS) await addProfile(`user_${role}`, role);
  for (const permission of ALL_PERMISSIONS) {
    const key = onlyRole(permission);
    await db.owner.query(
      "insert into public.roles (key, name_ar, name_en) values ($1, $1, $1)",
      [key],
    );
    await db.owner.query(
      `insert into public.role_permissions (role_id, permission)
       select id, $2 from public.roles where key = $1`,
      [key, permission],
    );
    await addProfile(`user_${key}`, key);
  }
}, 60_000);

afterAll(async () => {
  await db.close();
});

/** Reads the column lists from the §7 "Public content" table. */
function readSection7Columns(): Record<string, string[]> {
  const doc = readFileSync(
    new URL("../../../docs/project.md", import.meta.url),
    "utf8",
  );
  const section = doc.slice(
    doc.indexOf("**Public content**"),
    doc.indexOf("**Client work**"),
  );
  const tables: Record<string, string[]> = {};
  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith("| `")) continue;
    const [, name = "", columns = ""] = line.split("|").map((cell) => cell.trim());
    const listed = [...columns.replace(/\([^)]*\)/g, "").matchAll(/`([^`]+)`/g)];
    tables[name.replaceAll("`", "")] = listed.flatMap(([, column = ""]) =>
      column.endsWith("_*")
        ? [column.replace("*", "ar"), column.replace("*", "en")]
        : [column],
    );
  }
  return tables;
}

describe("tables", () => {
  const section7 = readSection7Columns();

  it("covers every table in §7 Public content", () => {
    expect(TABLE_NAMES.toSorted()).toEqual(Object.keys(section7).toSorted());
  });

  it.each(Object.entries(section7))("%s has its §7 columns", async (table, columns) => {
    const { rows } = await db.owner.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = $1`,
      [table],
    );
    expect(rows.map((row) => row.column_name)).toEqual(
      expect.arrayContaining(columns),
    );
  });

  it.each(
    TABLE_NAMES.filter((name) => name !== "project_services"),
  )("%s has created_at and updated_at", async (table) => {
    const { rows } = await db.owner.query(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = $1
         and column_name in ('created_at', 'updated_at')`,
      [table],
    );
    expect(rows).toHaveLength(2);
  });

  it.each(
    TABLE_NAMES.filter(
      (name) =>
        !["site_settings", "project_images", "project_services"].includes(name),
    ),
  )("%s has a status of draft or published", async (table) => {
    const { rows } = await db.owner.query<{ definition: string }>(
      `select pg_get_constraintdef(oid) as definition from pg_constraint
       where conrelid = $1::regclass and contype = 'c'
         and pg_get_constraintdef(oid) like '%status%'`,
      [`public.${table}`],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.definition).toContain("'draft'");
    expect(rows[0]?.definition).toContain("'published'");
  });
});

describe("seed", () => {
  it("has the 12 home sections, in order, hidden and empty", () => {
    expect(fresh.homeSections).toEqual(
      HOME_SECTION_KEYS.map((key, index) => ({
        key,
        position: index + 1,
        is_visible: false,
        content_ar: null,
        content_en: null,
        status: "draft",
      })),
    );
  });

  it("has no other content", () => {
    expect(Object.values(fresh.emptyTables)).toEqual(
      Object.values(fresh.emptyTables).map(() => 0),
    );
  });
});

describe("shared keys match the constraints", () => {
  const accepts = (sql: string) => db.owner.exec(`begin; ${sql}; rollback;`);
  const refuses = async (sql: string) => {
    await expect(db.owner.exec(`begin; ${sql};`)).rejects.toThrow(/check constraint/);
    await db.owner.exec("rollback");
  };

  it.each([
    ["pages.key", PAGE_KEYS, (v: string) => `insert into public.pages (key) values ('${v}')`, true],
    ["timeline kind", TIMELINE_KINDS, (v: string) => `insert into public.timeline_items (kind) values ('${v}')`, false],
    ["faq category", FAQ_CATEGORIES, (v: string) => `insert into public.faqs (category) values ('${v}')`, false],
    ["media category", MEDIA_CATEGORIES, (v: string) => `insert into public.media_items (category) values ('${v}')`, false],
    ["resource kind", RESOURCE_KINDS, (v: string) => `insert into public.resources (kind, storage_key, access) values ('${v}', 'k', 'direct')`, false],
    ["resource access", RESOURCE_ACCESS_MODES, (v: string) => `insert into public.resources (kind, storage_key, access) values ('guide', 'k', '${v}')`, false],
    ["course type", COURSE_TYPES, (v: string) => `insert into public.courses (slug, type) values ('s', '${v}')`, false],
    ["project org type", ORG_TYPES, (v: string) => `insert into public.projects (slug, org_type) values ('s', '${v}')`, false],
  ] as const)("%s", async (_label, keys, sql, pagesFixture) => {
    for (const key of keys) {
      if (pagesFixture && key === "about") continue;
      await accepts(sql(key));
    }
    await refuses(sql("nope"));
  });

  it("home section keys", async () => {
    await refuses("insert into public.home_sections (key) values ('nope')");
  });
});

describe.each(TABLE_NAMES)("%s", (table) => {
  it("has RLS on", async () => {
    const { rows } = await db.owner.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid = $1::regclass",
      [`public.${table}`],
    );
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it("has a published row to protect", async () => {
    const { rows } = await db.owner.query(`select * from public.${table}`);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("can't be read by anon, even published rows", async () => {
    await expect(
      db.runAs("anon", null, exec(`select * from public.${table}`)),
    ).rejects.toThrow(NO_ACCESS);
  });

  it("shows a client nothing", async () => {
    expect(await countSeenBy("client", table)).toBe(0);
  });

  it("shows a disabled admin nothing", async () => {
    expect(await countSeenBy("disabled_admin", table)).toBe(0);
  });

  it.each(ALL_PERMISSIONS)("with only %s", async (permission) => {
    const seen = await countSeenBy(`user_${onlyRole(permission)}`, table);
    if (TABLES[table]?.includes(permission)) {
      expect(seen).toBeGreaterThan(0);
    } else {
      expect(seen).toBe(0);
    }
  });

  it.each(ROLE_KEYS)("follows the seeded %s role", async (role) => {
    const seen = await countSeenBy(`user_${role}`, table);
    const allowed = TABLES[table]?.some((key) =>
      ROLE_PERMISSIONS[role].includes(key),
    );
    expect((seen ?? 0) > 0).toBe(Boolean(allowed));
  });

  it("can't be written by an admin's token", async () => {
    await expect(
      db.runAs("authenticated", "user_admin", exec(`delete from public.${table}`)),
    ).rejects.toThrow(NO_ACCESS);
  });

  it.each<ApiRole>(["anon", "authenticated", "service_role"])(
    "can't be truncated by %s",
    async (role) => {
      await expect(
        db.runAs(role, "user_admin", exec(`truncate public.${table} cascade`)),
      ).rejects.toThrow(NO_ACCESS);
    },
  );
});

describe("grants on every table in public", () => {
  it("give anon nothing", async () => {
    const { rows } = await db.owner.query(
      `select table_name, privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and grantee in ('anon', 'PUBLIC')`,
    );
    expect(rows).toEqual([]);
  });

  it("give authenticated SELECT only", async () => {
    const { rows } = await db.owner.query(
      `select table_name, privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and grantee = 'authenticated'
         and privilege_type <> 'SELECT'`,
    );
    expect(rows).toEqual([]);
  });
});

describe("site_settings", () => {
  it("needs team.manage: content.manage doesn't reach it", async () => {
    const onlyContent = `user_${onlyRole(PERMISSIONS.CONTENT_MANAGE)}`;
    expect(await countSeenBy(onlyContent, "site_settings")).toBe(0);
    expect(await countSeenBy("user_content_editor", "site_settings")).toBe(0);
  });
});

describe("partners.approved_by", () => {
  it("references a profile, like testimonials", async () => {
    const { rows } = await db.owner.query<{ table_name: string }>(
      `select c.conrelid::regclass::text as table_name from pg_constraint c
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
       where c.contype = 'f' and a.attname = 'approved_by'
         and c.confrelid = 'public.profiles'::regclass`,
    );
    expect(rows.map((row) => row.table_name).toSorted()).toEqual([
      "partners",
      "testimonials",
    ]);
  });
});

describe("sensitive columns", () => {
  it("keeps letter_path from a client", async () => {
    const rows = await db.runAs("authenticated", "client", async (tx) => {
      const result = await tx.query("select letter_path from public.testimonials");
      return result.rows;
    });
    expect(rows).toEqual([]);
  });

  it("keeps letter_path from anon", async () => {
    await expect(
      db.runAs("anon", null, exec("select letter_path from public.testimonials")),
    ).rejects.toThrow(NO_ACCESS);
  });

  it("keeps a hidden org name from a client", async () => {
    const rows = await db.runAs("authenticated", "client", async (tx) => {
      const result = await tx.query("select org_name_ar from public.projects");
      return result.rows;
    });
    expect(rows).toEqual([]);
  });
});

describe("set_updated_at", () => {
  it("moves updated_at on update", async () => {
    const { rows } = await db.owner.query<{ updated_at: Date }>(
      "select updated_at from public.posts where slug_en = 'post'",
    );
    const before = rows[0]?.updated_at;
    await db.runAs("service_role", null, async (tx) => {
      await tx.exec("update public.posts set title_en = 'New' where slug_en = 'post'");
    });
    const { rows: updated } = await db.owner.query<{ updated_at: Date }>(
      "select updated_at from public.posts where slug_en = 'post'",
    );
    expect(updated[0]?.updated_at.getTime()).toBeGreaterThan(
      before?.getTime() ?? Infinity,
    );
  });

  it("can't be called by an API role", async () => {
    const { rows } = await db.owner.query<{ allowed: boolean }>(
      `select bool_or(has_function_privilege(r, 'public.set_updated_at()', 'execute')) as allowed
       from unnest(array['anon', 'authenticated', 'service_role']) r`,
    );
    expect(rows[0]?.allowed).toBe(false);
  });
});

describe("service_role", () => {
  it("reads and writes past RLS", async () => {
    const count = await db.runAs("service_role", null, async (tx) => {
      await tx.exec("insert into public.home_stats (value) values ('15')");
      const { rows } = await tx.query<{ count: number }>(
        "select count(*)::int as count from public.home_stats",
      );
      return rows[0]?.count;
    });
    expect(count).toBeGreaterThan(1);
  });
});
