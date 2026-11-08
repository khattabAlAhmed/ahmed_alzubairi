/**
 * Test helper (no test runs here): a supabase-js stand-in that runs reads on
 * a pglite database with every migration applied, as `authenticated`. Postgres
 * checks the grants and RLS, so a select that names a column the user can't
 * read fails the way PostgREST fails it on the real project (42501).
 *
 * It covers the reads the content store makes: `select(...).order(...)` and
 * `select(...).eq(...).maybeSingle()`, with plain column lists or `*`.
 */
import type { TestDb } from "@repo/db/supabase-pglite";
import type { SupabaseClient } from "@supabase/supabase-js";

type Result = { data: unknown; error: { code: string; message: string } | null };

/** One table and the columns a select asks of it, embeds included. */
export type SelectPart = { table: string; columns: string };

/**
 * Splits a PostgREST select into its tables: `*, images(path, alt)` on
 * `projects` gives `projects: *` and `images: path, alt`.
 */
export function selectParts(table: string, select: string): SelectPart[] {
  const own: string[] = [];
  const parts: SelectPart[] = [];
  let depth = 0;
  let token = "";
  const flush = () => {
    const item = token.trim();
    token = "";
    if (!item) return;
    const embed = /^(\w+)\(([^]*)\)$/.exec(item);
    if (embed) parts.push({ table: embed[1], columns: embed[2] });
    else own.push(item);
  };
  for (const char of select) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) flush();
    else token += char;
  }
  flush();
  return [{ table, columns: own.join(", ") }, ...parts];
}

function failure(error: unknown): Result {
  const code = (error as { code?: string }).code ?? "unknown";
  return { data: null, error: { code, message: String(error) } };
}

/** A user client for `clerkUserId`, backed by `db`. */
export function pgliteUserClient(db: TestDb, clerkUserId: string): SupabaseClient {
  const run = async (sql: string, params: unknown[]): Promise<Record<string, unknown>[]> =>
    db.runAs("authenticated", clerkUserId, async (tx) => (await tx.query<Record<string, unknown>>(sql, params)).rows);

  const client = {
    from(table: string) {
      return {
        select(select: string) {
          const parts = selectParts(table, select);
          if (parts.length > 1) throw new Error("test-db-client: embeds aren't supported");
          const base = `select ${parts[0].columns} from public.${table}`;
          return {
            order(column: string, { ascending }: { ascending: boolean }) {
              const query = run(`${base} order by ${column} ${ascending ? "asc" : "desc"}`, []);
              return query.then(
                (rows): Result => ({ data: rows, error: null }),
                failure,
              );
            },
            eq(column: string, value: unknown) {
              return {
                maybeSingle: () =>
                  run(`${base} where ${column} = $1`, [value]).then(
                    (rows): Result => ({ data: rows[0] ?? null, error: null }),
                    failure,
                  ),
              };
            },
          };
        },
      };
    },
  };
  return client as unknown as SupabaseClient;
}

/** Adds an active team member with a role, for RLS. */
export async function addMember(db: TestDb, clerkUserId: string, roleKey: string) {
  await db.owner.query(
    `insert into public.profiles
       (clerk_user_id, full_name, email, phone, timezone, terms_accepted_at, status, role_id)
     values ($1, 'Test', $1 || '@example.invalid', '+10000000000', 'UTC', now(), 'active',
       (select id from public.roles where key = $2))`,
    [clerkUserId, roleKey],
  );
}
