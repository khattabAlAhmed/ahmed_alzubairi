import { describe, expect, it } from "vitest";
import { canOpenDashboard } from "./profile-access";

const ROLE = "00000000-0000-0000-0000-000000000001";

describe("canOpenDashboard", () => {
  it("allows an active profile with a role", () => {
    expect(canOpenDashboard({ role_id: ROLE, status: "active" })).toBe(true);
  });

  it.each([
    ["no profile", null],
    ["a client, with no role", { role_id: null, status: "active" }],
    ["a disabled profile that still has a role", { role_id: ROLE, status: "disabled" }],
    ["a disabled client", { role_id: null, status: "disabled" }],
  ])("refuses %s", (_name, profile) => {
    expect(canOpenDashboard(profile)).toBe(false);
  });
});
