import { fakeService, type Failures, type Row, type Tables } from "@/lib/email/fake-db";

/**
 * Test helper: the email fake (`lib/email/fake-db`), plus the read the hourly
 * job makes: `select` with `neq`, `lt`, `order` and `limit`. Writes go to the
 * email fake, over the same tables. `reads` counts the selects, so a test can
 * tell that a refused call did no work.
 */

type Test = (row: Row) => boolean;
type Order = { column: string; ascending: boolean };

export const reads = { count: 0 };

const below = (value: unknown, limit: string | number) =>
  (value as string | number) < limit;

export function fakeCronService(tables: Tables, fail: Failures = {}) {
  const base = fakeService(tables, fail);
  return {
    from(table: string) {
      const query = (tests: Test[], order: Order | null, max: number | null) => ({
        neq: (column: string, value: unknown) =>
          query([...tests, (row) => row[column] !== value], order, max),
        lt: (column: string, value: string | number) =>
          query([...tests, (row) => below(row[column], value)], order, max),
        order: (column: string, { ascending }: { ascending: boolean }) =>
          query(tests, { column, ascending }, max),
        limit: (count: number) => query(tests, order, count),
        then: (resolve: (value: { data: Row[] | null; error: unknown }) => void) => {
          reads.count += 1;
          const error = fail[table];
          if (error) return resolve({ data: null, error });
          const rows = (tables[table] ?? []).filter((row) =>
            tests.every((test) => test(row)),
          );
          if (order) {
            const sign = order.ascending ? 1 : -1;
            rows.sort(
              (a, b) =>
                sign * String(a[order.column]).localeCompare(String(b[order.column])),
            );
          }
          // Copies, as a run reads them: later writes don't change what it holds.
          const copies = rows.slice(0, max ?? rows.length).map((row) => ({ ...row }));
          resolve({ data: copies, error: null });
        },
      });

      const tableApi = base.from(table);
      return {
        ...tableApi,
        // Only the job's read selects `*`. The email code names its columns.
        select: (columns?: string) =>
          columns === "*" ? query([], null, null) : tableApi.select(),
      };
    },
  };
}
