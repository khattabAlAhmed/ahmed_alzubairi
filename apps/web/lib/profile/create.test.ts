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
    getIdentity: async () => ({
      fullName: "Test Person",
      verifiedEmail: "test@example.com",
    }),
    insertProfile,
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
      },
    ]);
    expect(rows[0]).not.toHaveProperty("role_id");
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
      getIdentity: async () => ({ fullName: "Test Person", verifiedEmail: null }),
    });
    expect(await createProfile(deps)).toMatchObject({
      status: 403,
      body: { error: { code: "email_not_verified" } },
    });
    expect(insertProfile).not.toHaveBeenCalled();
  });

  it.each([null, "  "])("asks for a name when Clerk has %j", async (fullName) => {
    const { deps, insertProfile } = setup({
      getIdentity: async () => ({ fullName, verifiedEmail: "test@example.com" }),
    });
    expect(await createProfile(deps)).toMatchObject({
      status: 422,
      body: { error: { code: "profile_incomplete" } },
    });
    expect(insertProfile).not.toHaveBeenCalled();
  });
});
