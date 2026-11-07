import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userId: "user_1" as string | null,
  user: {
    fullName: "Test Person" as string | null,
    primaryEmailAddress: {
      emailAddress: "test@example.com",
      verification: { status: "verified" },
    } as { emailAddress: string; verification: { status: string } | null } | null,
  },
  insert: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: mocks.userId }),
  clerkClient: async () => ({ users: { getUser: async () => mocks.user } }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      expect(table).toBe("profiles");
      return { insert: mocks.insert, upsert: mocks.upsert, update: mocks.update };
    },
  }),
}));

const { POST } = await import("./route");

const VALID = { phone: "+966501234567", termsAccepted: true, timezone: "Asia/Riyadh" };

function post(body: unknown, referer = "https://site.example/en/onboarding") {
  return POST(
    new Request("https://site.example/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json", referer },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  mocks.userId = "user_1";
  mocks.user.fullName = "Test Person";
  mocks.user.primaryEmailAddress = {
    emailAddress: "test@example.com",
    verification: { status: "verified" },
  };
  mocks.insert.mockReset().mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/profile", () => {
  it("inserts the row with Clerk's name and verified email", async () => {
    const response = await post(VALID);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    const row = mocks.insert.mock.calls[0]?.[0];
    expect(row).toMatchObject({
      clerk_user_id: "user_1",
      full_name: "Test Person",
      email: "test@example.com",
      locale: "en",
    });
    expect(row).not.toHaveProperty("role_id");
    expect(row).not.toHaveProperty("status");
    expect(Date.parse(row.terms_accepted_at)).not.toBeNaN();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses a signed-out request with 401", async () => {
    mocks.userId = null;
    const response = await post(VALID);
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("refuses broken JSON with 400, in the page's language", async () => {
    const response = await post("{", "https://site.example/ar/onboarding");
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.message).toMatch(/[؀-ۿ]/);
  });

  it("refuses a body that tries to set the role", async () => {
    const response = await post({ ...VALID, role_id: "x", status: "active" });
    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("answers a repeat POST with 409 and never updates", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "23505" } });
    const response = await post(VALID);
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("conflict");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("refuses an unverified email with 403", async () => {
    mocks.user.primaryEmailAddress = {
      emailAddress: "test@example.com",
      verification: { status: "unverified" },
    };
    expect((await post(VALID)).status).toBe(403);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns 500 with the error shape when the database fails", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "XX000" } });
    const response = await post(VALID);
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });
});
