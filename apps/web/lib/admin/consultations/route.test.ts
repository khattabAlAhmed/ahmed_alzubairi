import { beforeEach, describe, expect, it, vi } from "vitest";
// No referer, so the answer is in Arabic, the default.
import ar from "@/messages/ar.json";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createUserClient: vi.fn(() => {
    throw new Error("no database for a signed-out caller");
  }),
  createServiceClient: vi.fn(() => {
    throw new Error("no database for a signed-out caller");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: mocks.createUserClient }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));

const one = await import("@/app/api/admin/consultations/[id]/route");
const meetings = await import("@/app/api/admin/consultations/[id]/meetings/route");

const ID = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ id: ID }) };
const send = (method: string, path: string, body: unknown) =>
  new Request(`https://x.test${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ userId: null });
  mocks.createUserClient.mockClear();
  mocks.createServiceClient.mockClear();
});

describe("team consultation routes, signed out", () => {
  it.each([
    ["PATCH /api/admin/consultations/:id", () => one.PATCH(send("PATCH", `/api/admin/consultations/${ID}`, { status: "closed" }), context)],
    [
      "POST meetings",
      () =>
        meetings.POST(
          send("POST", `/api/admin/consultations/${ID}/meetings`, { platform: "Zoom", url: "https://x.test/m", startsAt: "2026-11-20T09:00:00.000Z", durationMinutes: 30 }),
          context,
        ),
    ],
    ["PATCH meetings", () => meetings.PATCH(send("PATCH", `/api/admin/consultations/${ID}/meetings`, { meetingId: ID, platform: "Teams" }), context)],
  ])("%s answers 401 and touches no database", async (_label, call) => {
    const response = await call();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "unauthenticated", message: ar.Errors.unauthenticated } });
    expect(mocks.createUserClient).not.toHaveBeenCalled();
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });
});
