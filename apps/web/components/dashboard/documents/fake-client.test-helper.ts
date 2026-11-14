import type { Database } from "@repo/db";
import type { SupabaseClient } from "@supabase/supabase-js";

/** One call on a query: the method and its arguments, such as `["eq", "status", "granted"]`. */
export type Call = [string, ...unknown[]];

export type FakeResult = { data: unknown; error: { code: string } | null; count?: number | null };

/**
 * A stand-in supabase-js client. Every `from(table)` chain records its calls
 * and resolves to what `answer(table, calls)` returns. `maybeSingle` resolves
 * the same way, so the answer gives one row or null.
 */
export function fakeClient(answer: (table: string, calls: Call[]) => FakeResult) {
  const queries: { table: string; calls: Call[] }[] = [];
  const client = {
    from(table: string) {
      const calls: Call[] = [];
      queries.push({ table, calls });
      const chain: Record<string, unknown> = {};
      const methods = ["select", "eq", "is", "or", "in", "order", "range", "limit", "maybeSingle"];
      for (const method of methods) {
        chain[method] = (...args: unknown[]) => {
          calls.push([method, ...args]);
          return chain;
        };
      }
      chain.then = (resolve: (value: FakeResult) => unknown, reject: (error: unknown) => unknown) => {
        try {
          return Promise.resolve(answer(table, calls)).then(resolve, reject);
        } catch (error) {
          return Promise.reject(error).then(resolve, reject);
        }
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, queries };
}

/** The calls of every query on `table`. */
export function callsOn(queries: { table: string; calls: Call[] }[], table: string): Call[][] {
  return queries.filter((query) => query.table === table).map((query) => query.calls);
}
