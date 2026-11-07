import { readdirSync, readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const MIGRATIONS_DIR = new URL("../../supabase/migrations/", import.meta.url);

export type ApiRole = "anon" | "authenticated" | "service_role";

/**
 * What a Supabase project has before any migration runs. It copies the roles,
 * the default privileges, `auth.jwt()` and the grants and RLS on Storage's
 * tables from the dev project, so a migration that forgets to revoke access
 * fails here too.
 */
const SUPABASE_STUB = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  grant usage on schema public to anon, authenticated, service_role;

  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on sequences to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;

  create function auth.jwt() returns jsonb
  language sql
  stable
  as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
  $$;

  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;

  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );

  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text
  );

  alter table storage.buckets enable row level security;
  alter table storage.objects enable row level security;

  grant select, insert, update, delete on storage.buckets, storage.objects
    to anon, authenticated;
  grant all on storage.buckets, storage.objects to service_role;
`;

export type TestDb = {
  /** The database as its owner: for fixtures. RLS doesn't apply here. */
  owner: PGlite;
  /**
   * Runs `fn` in one transaction as an API role. A Clerk user ID becomes the
   * token's `sub`; null means no user. An error rolls the transaction back.
   */
  runAs<T>(
    role: ApiRole,
    clerkUserId: string | null,
    fn: (tx: Transaction) => Promise<T>,
  ): Promise<T>;
  close(): Promise<void>;
};

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

/** An in-memory database with Supabase's roles and every migration applied. */
export async function createTestDb(): Promise<TestDb> {
  const owner = await PGlite.create();
  await owner.exec(SUPABASE_STUB);

  for (const name of migrationFiles()) {
    await owner.exec(readFileSync(new URL(name, MIGRATIONS_DIR), "utf8"));
  }

  return {
    owner,
    runAs: async <T>(
      role: ApiRole,
      clerkUserId: string | null,
      fn: (tx: Transaction) => Promise<T>,
    ) => {
      const result = await owner.transaction(async (tx) => {
        const claims = clerkUserId ? { role, sub: clerkUserId } : { role };
        await tx.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify(claims),
        ]);
        await tx.exec(`set local role ${role}`);
        return fn(tx);
      });
      return result as T;
    },
    close: () => owner.close(),
  };
}
