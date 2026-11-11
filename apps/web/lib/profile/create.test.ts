import { describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import { createProfile, type CreateProfileDeps, type NewProfileRow } from "./create";

const VALID = {
  phone: "+966501234567",
  termsAccepted: true,
  timezone: "Asia/Riyadh",
  orgType: "company",
  orgName: "Example Co",
  jobTitle: "Manager",
  locale: "en",
};

const NOW = new Date("2026-11-07T10:00:00.000Z");

const EDITOR_ROLE = "11111111-1111-4111-8111-111111111111";
const ADMIN_ROLE = "22222222-2222-4222-8222-222222222222";
const UNKNOWN_ROLE = "33333333-3333-4333-8333-333333333333";

const ROLES: Record<string, string> = {
  [EDITOR_ROLE]: "content_editor",
  [ADMIN_ROLE]: "admin",
};

const identity = (invitedRoleId: string | null = null) => ({
  fullName: "Test Person",
  verifiedEmail: "test@example.com",
  invitedRoleId,
});

function setup(overrides: Partial<CreateProfileDeps> = {}, body: unknown = VALID) {
  const rows: NewProfileRow[] = [];
  const insertProfile = vi.fn(async (row: NewProfileRow) => {
    if (rows.some((existing) => existing.clerk_user_id === row.clerk_user_id)) {
      return "conflict" as const;
    }
    rows.push(row);
    return "created" as const;
  });
  const deps: CreateProfileDeps = {
    userId: "user_1",
    locale: "ar",
    readBody: async () => body,
    getIdentity: async () => identity(),
    insertProfile,
    getRole: vi.fn(async (id: string) => {
      const key = ROLES[id];
      return key ? { id, key } : null;
    }),
    queueNewClientEmail: vi.fn(async () => true),
    now: () => NOW,
    ...overrides,
  };
  return { deps, rows, insertProfile };
}

describe("createProfile", () => {
  it("creates the row from Clerk's identity and the body, with the server's time", async () => {
    const { deps, rows } = setup();
    const result = await createProfile(deps);

    expect(result).toEqual({ status: 201, body: { ok: true } });
    expect(rows).toEqual([
      {
        clerk_user_id: "user_1",
        full_name: "Test Person",
        email: "test@example.com",
        phone: "+966501234567",
        org_type: "company",
        org_name: "Example Co",
        job_title: "Manager",
        locale: "en",
        timezone: "Asia/Riyadh",
        terms_accepted_at: NOW.toISOString(),
        role_id: null,
      },
    ]);
    expect(rows[0]).not.toHaveProperty("status");
  });

  it("fills optional fields with null and the page's language", async () => {
    const { deps, rows } = setup({ locale: "ar" }, {
      phone: "0501234567",
      termsAccepted: true,
      timezone: "UTC",
    });
    expect((await createProfile(deps)).status).toBe(201);
    expect(rows[0]).toMatchObject({
      org_type: null,
      org_name: null,
      job_title: null,
      locale: "ar",
    });
  });

  it("refuses a signed-out request with 401", async () => {
    const { deps, insertProfile } = setup({ userId: null });
    const result = await createProfile(deps);
    expect(result).toEqual({
      status: 401,
      body: { error: { code: "unauthenticated", message: ar.Errors.unauthenticated } },
    });
    expect(insertProfile).not.toHaveBeenCalled();
  });

  it.each([
    ["no body", null],
    ["terms not accepted", { ...VALID, termsAccepted: false }],
    ["phone with spaces", { ...VALID, phone: "050 123 4567" }],
    ["Arabic digits", { ...VALID, phone: "٠٥٠١٢٣٤٥٦٧" }],
    ["an offset time zone", { ...VALID, timezone: "+03:00" }],
    ["an unknown org type", { ...VALID, orgType: "ngo" }],
  ])("refuses %s with 400", async (_name, body) => {
    const { deps, insertProfile } = setup({ locale: "en" }, body);
    const result = await createProfile(deps);
    expect(result).toEqual({
      status: 400,
      body: { error: { code: "validation_failed", message: en.Errors.validation_failed } },
    });
    expect(insertProfile).not.toHaveBeenCalled();
  });

  it("refuses a body that can't be read as JSON", async () => {
    const { deps } = setup({
      readBody: () => Promise.reject(new SyntaxError("bad json")),
    });
    expect((await createProfile(deps)).status).toBe(400);
  });

  it.each([
    ["role", { role_id: "00000000-0000-0000-0000-000000000001" }],
    ["roleId", { roleId: EDITOR_ROLE }],
    ["role key", { role: "admin" }],
    ["email", { email: "attacker@example.com" }],
    ["status", { status: "active" }],
    ["full name", { fullName: "Someone Else" }],
    ["user ID", { clerk_user_id: "user_2" }],
  ])("a body that sets %s has no effect", async (_name, extra) => {
    const { deps, insertProfile } = setup({}, { ...VALID, ...extra });
    expect((await createProfile(deps)).status).toBe(400);
    expect(insertProfile).not.toHaveBeenCalled();
  });

  it("returns a conflict on a second POST and keeps the first row", async () => {
    const { deps, rows } = setup();
    await createProfile(deps);
    const second = setup({}, { ...VALID, phone: "+12025550100" });
    const result = await createProfile({
      ...second.deps,
      insertProfile: deps.insertProfile,
    });

    expect(result).toEqual({
      status: 409,
      body: { error: { code: "conflict", message: ar.Errors.conflict } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.phone).toBe("+966501234567");
  });

  it("refuses an unverified email with 403", async () => {
    const { deps, insertProfile } = setup({
      getIdentity: async () => ({ ...identity(), verifiedEmail: null }),
    });
    expect(await createProfile(deps)).toMatchObject({
      status: 403,
      body: { error: { code: "email_not_verified" } },
    });
    expect(insertProfile).not.toHaveBeenCalled();
  });

  it.each([null, "  "])("asks for a name when Clerk has %j", async (fullName) => {
    const { deps, insertProfile } = setup({
      getIdentity: async () => ({ ...identity(), fullName }),
    });
    expect(await createProfile(deps)).toMatchObject({
      status: 422,
      body: { error: { code: "profile_incomplete" } },
    });
    expect(insertProfile).not.toHaveBeenCalled();
  });

  describe("invited team member", () => {
    it("sets role_id from the invitation's metadata and queues no email", async () => {
      const { deps, rows } = setup({ getIdentity: async () => identity(EDITOR_ROLE) });
      expect((await createProfile(deps)).status).toBe(201);
      expect(rows[0]?.role_id).toBe(EDITOR_ROLE);
      expect(deps.queueNewClientEmail).not.toHaveBeenCalled();
    });

    it("creates a client profile when the role id is unknown", async () => {
      const { deps, rows } = setup({ getIdentity: async () => identity(UNKNOWN_ROLE) });
      expect((await createProfile(deps)).status).toBe(201);
      expect(deps.getRole).toHaveBeenCalledWith(UNKNOWN_ROLE);
      expect(rows[0]?.role_id).toBeNull();
    });

    it("never grants admin: an admin role id creates a client profile", async () => {
      const { deps, rows } = setup({ getIdentity: async () => identity(ADMIN_ROLE) });
      expect((await createProfile(deps)).status).toBe(201);
      expect(rows[0]?.role_id).toBeNull();
    });

    it("refuses a body field named roleId, and the role still comes from Clerk", async () => {
      const { deps, insertProfile } = setup(
        { getIdentity: async () => identity() },
        { ...VALID, roleId: EDITOR_ROLE },
      );
      expect((await createProfile(deps)).status).toBe(400);
      expect(insertProfile).not.toHaveBeenCalled();
      expect(deps.getRole).not.toHaveBeenCalled();
    });
  });

  describe("new client email", () => {
    it("queues account_new once, with the client's name", async () => {
      const { deps } = setup();
      expect((await createProfile(deps)).status).toBe(201);
      expect(deps.queueNewClientEmail).toHaveBeenCalledExactlyOnceWith("Test Person");
    });

    it.each([
      ["rejects", () => Promise.reject(new Error("queue down"))],
      ["reports false", async () => false],
    ])("still succeeds when the queue %s", async (_name, queueNewClientEmail) => {
      const { deps, rows } = setup({ queueNewClientEmail });
      expect(await createProfile(deps)).toEqual({ status: 201, body: { ok: true } });
      expect(rows).toHaveLength(1);
    });

    it("queues nothing when the profile already exists", async () => {
      const { deps } = setup();
      await createProfile(deps);
      const second = setup();
      await createProfile({ ...second.deps, insertProfile: deps.insertProfile });
      expect(second.deps.queueNewClientEmail).not.toHaveBeenCalled();
    });
  });
});
