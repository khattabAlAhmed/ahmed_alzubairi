import { PERMISSIONS } from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { holdsPermission } from "./access";
import { sectionAccess } from "./gate";

vi.mock("./access", () => ({ holdsPermission: vi.fn() }));

const params = (locale: string) => Promise.resolve({ locale });

beforeEach(() => vi.mocked(holdsPermission).mockReset());

describe("sectionAccess", () => {
  it("allows a member with the section's permission", async () => {
    vi.mocked(holdsPermission).mockResolvedValue(true);
    await expect(sectionAccess(params("en"), PERMISSIONS.CONTENT_MANAGE)).resolves.toEqual({
      locale: "en",
      allowed: true,
    });
    expect(holdsPermission).toHaveBeenCalledWith(PERMISSIONS.CONTENT_MANAGE, "en");
  });

  it("refuses a member without the permission", async () => {
    vi.mocked(holdsPermission).mockResolvedValue(false);
    await expect(sectionAccess(params("ar"), PERMISSIONS.CONTENT_MANAGE)).resolves.toEqual({
      locale: "ar",
      allowed: false,
    });
  });
});
