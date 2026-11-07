import type { Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES } from "../../shared/limits";
import {
  ATTACHMENT_MIMES,
  UPLOAD_TARGET_RULES,
  type UploadTarget,
} from "../../shared/uploads";
import { createTestDb, type TestDb } from "../supabase-pglite";

const PRIVATE_BUCKETS = [
  "resources",
  "attachments",
  "documents",
  "document-views",
  "internal",
];
const ALL_BUCKETS = ["public-media", ...PRIVATE_BUCKETS];
const NO_ROW_ACCESS = /row-level security/;
const MACRO_MIMES = [
  "application/vnd.ms-word.document.macroEnabled.12",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
  "application/msword",
  "application/vnd.ms-excel",
];

type Bucket = {
  id: string;
  public: boolean;
  file_size_limit: string | number;
  allowed_mime_types: string[];
};

let db: TestDb;
let buckets: Bucket[];

const bucket = (id: string) => {
  const found = buckets.find((row) => row.id === id);
  if (!found) throw new Error(`No bucket ${id}`);
  return found;
};

const exec = (sql: string) => (tx: Transaction) => tx.exec(sql);

const countObjects = (role: "anon" | "authenticated") =>
  db.runAs(role, role === "anon" ? null : "user_1", async (tx) => {
    const { rows } = await tx.query<{ count: number }>(
      "select count(*)::int as count from storage.objects",
    );
    return rows[0]?.count;
  });

beforeAll(async () => {
  db = await createTestDb();
  const { rows } = await db.owner.query<Bucket>(
    "select id, public, file_size_limit, allowed_mime_types from storage.buckets",
  );
  buckets = rows;
  await db.owner.exec(`
    insert into storage.objects (bucket_id, name)
      select id, 'file' from storage.buckets;
  `);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("buckets", () => {
  it("are exactly the six in §7", () => {
    expect(buckets.map((row) => row.id).toSorted()).toEqual(
      ALL_BUCKETS.toSorted(),
    );
  });

  it("make only public-media public", () => {
    expect(buckets.filter((row) => row.public).map((row) => row.id)).toEqual([
      "public-media",
    ]);
  });

  it.each(ALL_BUCKETS)("%s has a size limit and a type list", (id) => {
    expect(Number(bucket(id).file_size_limit)).toBeGreaterThan(0);
    expect(bucket(id).allowed_mime_types.length).toBeGreaterThan(0);
  });

  it.each([
    ["document", "documents"],
    ["resource", "resources"],
    ["media", "public-media"],
    ["letter", "internal"],
  ] as [UploadTarget, string][])(
    "%s uploads match the %s bucket",
    (target, id) => {
      const rule = UPLOAD_TARGET_RULES[target];
      expect(rule.bucket).toBe(id);
      expect(Number(bucket(id).file_size_limit)).toBe(rule.maxBytes);
      expect(bucket(id).allowed_mime_types.toSorted()).toEqual(
        [...rule.mimes].toSorted(),
      );
    },
  );

  it("attachments match the shared limit and allow-list", () => {
    const attachments = bucket("attachments");
    expect(Number(attachments.file_size_limit)).toBe(MAX_ATTACHMENT_BYTES);
    expect(attachments.allowed_mime_types.toSorted()).toEqual(
      [...ATTACHMENT_MIMES].toSorted(),
    );
  });

  it.each(ALL_BUCKETS)("%s refuses macro formats", (id) => {
    for (const mime of MACRO_MIMES) {
      expect(bucket(id).allowed_mime_types).not.toContain(mime);
    }
  });

  it.each(ALL_BUCKETS)("%s has no wildcard or SVG type", (id) => {
    expect(bucket(id).allowed_mime_types.join()).not.toMatch(/\*|svg/i);
  });

  it("gives watermarked copies room to grow past their originals", () => {
    expect(Number(bucket("document-views").file_size_limit)).toBeGreaterThan(
      Number(bucket("documents").file_size_limit),
    );
  });
});

describe("secret columns", () => {
  it("are all kept from authenticated and anon, on every table in public", async () => {
    const { rows } = await db.owner.query<{ name: string }>(
      `with secret as materialized (
         select table_name, column_name
         from information_schema.columns
         where table_schema = 'public'
           and column_name ~* '(storage_key|token|hash|secret|password|api_key)'
       )
       select table_name || '.' || column_name as name
       from secret
       where has_column_privilege('authenticated', format('public.%I', table_name), column_name, 'select')
          or has_column_privilege('anon', format('public.%I', table_name), column_name, 'select')`,
    );
    expect(rows).toEqual([]);
  });

  it("finds the four known columns, so the check above has something to check", async () => {
    const { rows } = await db.owner.query<{ name: string }>(
      `select table_name || '.' || column_name as name
       from information_schema.columns
       where table_schema = 'public'
         and column_name ~* '(storage_key|token|hash|secret|password|api_key)'`,
    );
    expect(rows.map((row) => row.name).toSorted()).toEqual([
      "consultation_attachments.storage_key",
      "documents.storage_key",
      "newsletter_subscribers.confirm_token_hash",
      "resources.storage_key",
    ]);
  });

  it("refuses resources.storage_key to a content editor", async () => {
    await db.owner.exec(`
      insert into public.profiles
        (clerk_user_id, full_name, email, phone, timezone, terms_accepted_at, role_id)
      values ('editor', 'T', 'e@example.com', '+966500000000', 'UTC', now(),
        (select id from public.roles where key = 'content_editor'));
      insert into public.resources (kind, storage_key, access)
        values ('guide', 'resources/secret.pdf', 'direct');
    `);
    await expect(
      db.runAs(
        "authenticated",
        "editor",
        exec("select storage_key from public.resources"),
      ),
    ).rejects.toThrow(/permission denied/);
    const titles = await db.runAs("authenticated", "editor", async (tx) => {
      const { rows } = await tx.query(
        `select id, expertise_id, kind, title_ar, title_en, description_ar, description_en,
           access, status, created_at, updated_at from public.resources`,
      );
      return rows;
    });
    expect(titles).toHaveLength(1);
  });

  it("keeps the upload paths readable by the team, per T09", async () => {
    const { rows } = await db.owner.query<{ allowed: boolean }>(
      `select has_column_privilege('authenticated', 'public.testimonials', 'letter_path', 'select')
         and has_column_privilege('authenticated', 'public.partners', 'logo_path', 'select')
         and has_column_privilege('authenticated', 'public.project_images', 'path', 'select') as allowed`,
    );
    expect(rows[0]?.allowed).toBe(true);
  });
});

describe("client access", () => {
  it("has no policy on storage.objects or storage.buckets", async () => {
    const { rows } = await db.owner.query(
      "select policyname from pg_policies where schemaname = 'storage'",
    );
    expect(rows).toEqual([]);
  });

  it.each(["anon", "authenticated"] as const)(
    "%s reads no object, public or private",
    async (role) => {
      expect(await countObjects(role)).toBe(0);
    },
  );

  it.each(
    (["anon", "authenticated"] as const).flatMap((role) =>
      ALL_BUCKETS.map((id) => [role, id] as const),
    ),
  )("%s can't write to %s", async (role, id) => {
    await expect(
      db.runAs(
        role,
        role === "anon" ? null : "user_1",
        exec(`insert into storage.objects (bucket_id, name) values ('${id}', 'x')`),
      ),
    ).rejects.toThrow(NO_ROW_ACCESS);
  });

  it.each(["anon", "authenticated"] as const)(
    "%s changes and deletes nothing",
    async (role) => {
      const changed = await db.runAs(
        role,
        role === "anon" ? null : "user_1",
        async (tx) => {
          const updated = await tx.query(
            "update storage.objects set name = 'x'",
          );
          const deleted = await tx.query("delete from storage.objects");
          return (updated.affectedRows ?? 0) + (deleted.affectedRows ?? 0);
        },
      );
      expect(changed).toBe(0);
    },
  );

  it.each(["anon", "authenticated"] as const)(
    "%s can't flip a bucket public or add one",
    async (role) => {
      const user = role === "anon" ? null : "user_1";
      const updated = await db.runAs(role, user, async (tx) => {
        const result = await tx.query("update storage.buckets set public = true");
        return result.affectedRows;
      });
      expect(updated ?? 0).toBe(0);
      await expect(
        db.runAs(
          role,
          user,
          exec("insert into storage.buckets (id, name) values ('x', 'x')"),
        ),
      ).rejects.toThrow(NO_ROW_ACCESS);
    },
  );

  it("still lets the server through", async () => {
    const count = await db.runAs("service_role", null, async (tx) => {
      const { rows } = await tx.query<{ count: number }>(
        "select count(*)::int as count from storage.objects",
      );
      return rows[0]?.count;
    });
    expect(count).toBe(buckets.length);
  });
});
