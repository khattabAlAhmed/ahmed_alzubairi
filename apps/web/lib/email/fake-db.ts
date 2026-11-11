/**
 * Test helper: a supabase-js stand-in over in-memory tables. It answers the
 * calls the email code makes (`select`, `insert`, `update`, with `eq`, `neq`,
 * `lt` and `in` filters), and gives `email_outbox` rows the columns the
 * database fills in. `fail` makes a table's calls answer with an error, the
 * way PostgREST does.
 */

export type Row = Record<string, unknown>;
export type DbError = { code: string; message: string };
export type Tables = Record<string, Row[]>;
export type Failures = Partial<Record<string, DbError>>;

type Result = { data: Row[] | null; error: DbError | null };
type Test = (row: Row) => boolean;

let nextId = 0;

/** Ids in the shape of a uuid, in the order rows were made. */
export function fakeId(): string {
  nextId += 1;
  return `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`;
}

/** An `email_outbox` row as the database stores it. */
export function outboxRow(rest: Row = {}): Row {
  return {
    id: fakeId(),
    event: "contact_message",
    to_email: "someone@example.invalid",
    locale: "en",
    payload: { name: "Sender Name", subject: "A question" },
    status: "pending",
    attempts: 0,
    last_error: null,
    created_at: "2026-11-11T10:00:00.000Z",
    sent_at: null,
    ...rest,
  };
}

function stored(table: string, row: Row): Row {
  return table === "email_outbox" ? outboxRow(row) : { id: fakeId(), ...row };
}

export function fakeService(tables: Tables, fail: Failures = {}) {
  return {
    from(table: string) {
      const error = fail[table] ?? null;
      const rowsOf = () => (tables[table] ??= []);

      /** A filter chain. `run` gets the rows that match when it is awaited. */
      const chain = (run: (matching: Row[]) => Row[], tests: Test[] = []) => {
        const add = (test: Test) => chain(run, [...tests, test]);
        const result = (): Result =>
          error
            ? { data: null, error }
            : {
                data: run(rowsOf().filter((row) => tests.every((test) => test(row)))),
                error: null,
              };
        return {
          eq: (column: string, value: unknown) => add((row) => row[column] === value),
          neq: (column: string, value: unknown) => add((row) => row[column] !== value),
          lt: (column: string, value: number) =>
            add((row) => (row[column] as number) < value),
          in: (column: string, values: unknown[]) =>
            add((row) => values.includes(row[column])),
          select: () => chain(run, tests),
          maybeSingle: async () => {
            const { data, error: failed } = result();
            return { data: data?.[0] ?? null, error: failed };
          },
          then: (resolve: (value: Result) => void) => resolve(result()),
        };
      };

      return {
        select: () => chain((matching) => matching),
        update: (patch: Row) =>
          chain((matching) => {
            for (const row of matching) Object.assign(row, patch);
            return matching;
          }),
        insert: (rows: Row[]) => {
          let inserted: Row[] | null = null;
          const run = (): Result => {
            if (error) return { data: null, error };
            if (!inserted) {
              inserted = rows.map((row) => stored(table, row));
              rowsOf().push(...inserted);
            }
            return { data: inserted, error: null };
          };
          return {
            select: () => ({
              then: (resolve: (value: Result) => void) => resolve(run()),
            }),
            then: (resolve: (value: Result) => void) => resolve(run()),
          };
        },
      };
    },
  };
}
