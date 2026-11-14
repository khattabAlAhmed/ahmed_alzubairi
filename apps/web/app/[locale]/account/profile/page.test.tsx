import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireProfile: vi.fn(),
  readOwnProfileDetails: vi.fn(),
}));

vi.mock("@/lib/auth/gates", () => ({ requireProfile: mocks.requireProfile }));
vi.mock("@/lib/profile/read", () => ({ readOwnProfileDetails: mocks.readOwnProfileDetails }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: "user_client" }) }));
vi.mock("@clerk/nextjs", () => ({ useUser: vi.fn(), useReverification: vi.fn(), useClerk: vi.fn() }));
vi.mock("@clerk/nextjs/errors", () => ({
  isClerkAPIResponseError: vi.fn(),
  isReverificationCancelledError: vi.fn(),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getMessages: async () => ({ AccountProfile: {} }),
}));
vi.mock("@/i18n/navigation", () => ({ Link: () => null, useRouter: () => ({}), usePathname: () => "/" }));

const { default: ProfilePage } = await import("./page");
const { DisableAccount } = await import("@/components/account/disable-account");
const { DetailsForm } = await import("@/components/account/details-form");

const PROFILE = {
  fullName: "Test Client",
  email: "client@example.com",
  phone: "+966500000000",
  orgType: null,
  orgName: null,
  jobTitle: null,
  locale: "ar",
  timezone: "Asia/Riyadh",
  notifyOptional: true,
  isMember: false,
};

function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  return [node, ...elements((node.props as { children?: ReactNode }).children)];
}

const params = Promise.resolve({ locale: "en" });

beforeEach(() => {
  mocks.requireProfile.mockReset().mockResolvedValue({ role_id: null, status: "active" });
  mocks.readOwnProfileDetails.mockReset().mockResolvedValue(PROFILE);
});

describe("/account/profile", () => {
  it("runs the account gate with its own path, then reads the caller's own row", async () => {
    await ProfilePage({ params });
    expect(mocks.requireProfile).toHaveBeenCalledWith(params, "/account/profile");
    expect(mocks.readOwnProfileDetails).toHaveBeenCalledWith("user_client");
  });

  it("shows the disable block to a client", async () => {
    const page = await ProfilePage({ params });
    const types = elements(page).map((node) => node.type);
    expect(types).toContain(DetailsForm);
    expect(types).toContain(DisableAccount);
  });

  it("hides the disable block from a team member", async () => {
    mocks.readOwnProfileDetails.mockResolvedValue({ ...PROFILE, isMember: true });
    const page = await ProfilePage({ params });
    expect(elements(page).map((node) => node.type)).not.toContain(DisableAccount);
  });
});
