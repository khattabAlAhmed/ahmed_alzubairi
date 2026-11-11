import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = { clerk_user_id: string; full_name: string; email: string; phone: string };

const db = vi.hoisted(() => ({
  rows: [] as Row[],
  writes: 0,
  clients: 0,
  error: null as { code: string } | null,
}));

// A small stand-in for the profiles table: `update().eq()` overwrites the
// matching rows, as PostgREST does, and matches none without an error.
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => {
    db.clients += 1;
    return {
      from: (table: string) => {
        expect(table).toBe("profiles");
        return {
          update: (values: Partial<Row>) => ({
            eq: async (column: string, value: string) => {
              expect(column).toBe("clerk_user_id");
              if (db.error) return { error: db.error };
              for (const row of db.rows) {
                if (row.clerk_user_id === value) {
                  Object.assign(row, values);
                  db.writes += 1;
                }
              }
              return { error: null };
            },
          }),
        };
      },
    };
  },
}));

// Clerk's real `verifyWebhook` runs: requests are signed here the way Svix does.
const { POST } = await import("./route");

const SECRET = `whsec_${Buffer.from("a-test-signing-secret").toString("base64")}`;
const OTHER_SECRET = `whsec_${Buffer.from("someone-else's-secret").toString("base64")}`;

const EVENT = {
  type: "user.updated",
  object: "event",
  data: {
    id: "user_1",
    first_name: "New",
    last_name: "Name",
    primary_email_address_id: "idn_2",
    email_addresses: [
      { id: "idn_1", email_address: "old@example.com" },
      { id: "idn_2", email_address: "new@example.com" },
    ],
    image_url: "https://img.example/a.png",
  },
};

function sign(body: string, secret: string, id: string, timestamp: string) {
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")}`;
}

function post(event: unknown, options: { secret?: string | null; tamper?: boolean } = {}) {
  const body = JSON.stringify(event);
  const id = "msg_test";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers = new Headers({ "content-type": "application/json" });
  if (options.secret !== null) {
    headers.set("svix-id", id);
    headers.set("svix-timestamp", timestamp);
    headers.set("svix-signature", sign(body, options.secret ?? SECRET, id, timestamp));
  }
  return POST(
    new NextRequest("https://site.example/api/clerk/webhook", {
      method: "POST",
      headers,
      body: options.tamper ? body.replace("new@example.com", "evil@example.com") : body,
    }),
  );
}

const START: Row = {
  clerk_user_id: "user_1",
  full_name: "Old Name",
  email: "old@example.com",
  phone: "+966501234567",
};

let errors: ReturnType<typeof vi.spyOn>;
let warnings: ReturnType<typeof vi.spyOn>;

function logged() {
  return JSON.stringify([...errors.mock.calls, ...warnings.mock.calls]);
}

beforeEach(() => {
  vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", SECRET);
  db.rows = [{ ...START }, { ...START, clerk_user_id: "user_2", email: "two@example.com" }];
  db.writes = 0;
  db.clients = 0;
  db.error = null;
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
  warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  errors.mockRestore();
  warnings.mockRestore();
});

describe("POST /api/clerk/webhook", () => {
  it("updates the name and email of the matching profile, and nothing else", async () => {
    const response = await post(EVENT);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(db.rows).toEqual([
      { ...START, full_name: "New Name", email: "new@example.com" },
      { ...START, clerk_user_id: "user_2", email: "two@example.com" },
    ]);
  });

  it.each([
    ["unsigned", { secret: null }],
    ["signed with another secret", { secret: OTHER_SECRET }],
    ["changed after signing", { tamper: true }],
  ])("refuses a request that is %s, and never opens the database", async (_name, options) => {
    const response = await post(EVENT, options);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("validation_failed");
    expect(db.clients).toBe(0);
    expect(db.rows[0]).toEqual(START);
  });

  it("refuses an old signed request", async () => {
    vi.useFakeTimers({ now: Date.now() - 10 * 60 * 1000 });
    const request = post(EVENT);
    vi.useRealTimers();
    // Signed ten minutes ago: built under the fake clock, verified under the real one.
    expect((await request).status).toBe(400);
    expect(db.clients).toBe(0);
  });

  it("answers 500 without the secret, logs it, and never passes the request", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", "");
    const response = await post(EVENT);
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
    expect(errors).toHaveBeenCalledWith(
      expect.stringContaining("CLERK_WEBHOOK_SIGNING_SECRET is not set"),
    );
    expect(db.clients).toBe(0);
  });

  it("answers 200 and writes nothing for a user with no profile", async () => {
    const response = await post({ ...EVENT, data: { ...EVENT.data, id: "user_new" } });
    expect(response.status).toBe(200);
    expect(db.writes).toBe(0);
    expect(db.rows[0]).toEqual(START);
  });

  it.each(["user.created", "user.deleted", "session.created", "organization.updated"])(
    "answers 200 and writes nothing for %s",
    async (type) => {
      const response = await post({ ...EVENT, type });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      expect(db.clients).toBe(0);
    },
  );

  it("gives the same row when the same event arrives twice", async () => {
    await post(EVENT);
    const once = structuredClone(db.rows);
    const response = await post(EVENT);
    expect(response.status).toBe(200);
    expect(db.rows).toEqual(once);
  });

  it("keeps the stored name when Clerk has none", async () => {
    await post({ ...EVENT, data: { ...EVENT.data, first_name: null, last_name: null } });
    expect(db.rows[0]).toEqual({ ...START, email: "new@example.com" });
  });

  it("refuses a signed user.updated it can't read, without writing", async () => {
    const response = await post({ type: "user.updated", data: { id: "user_1" } });
    expect(response.status).toBe(400);
    expect(db.clients).toBe(0);
  });

  it("answers 500 when the update fails, so Clerk sends the event again", async () => {
    db.error = { code: "57014" };
    const response = await post(EVENT);
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });

  it("never logs the payload, the email or the name", async () => {
    db.error = { code: "57014" };
    await post(EVENT);
    await post(EVENT, { secret: OTHER_SECRET });
    await post({ type: "user.updated", data: { ...EVENT.data, id: "" } });
    const output = logged();
    expect(errors.mock.calls.length + warnings.mock.calls.length).toBe(3);
    for (const value of ["new@example.com", "old@example.com", "New", "Name", "user_1", "idn_2"]) {
      expect(output).not.toContain(value);
    }
  });
});
