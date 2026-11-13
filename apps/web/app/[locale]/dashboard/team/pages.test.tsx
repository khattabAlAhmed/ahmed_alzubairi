import { PERMISSIONS } from "@repo/shared";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeamMember: vi.fn(),
  sectionAccess: vi.fn(),
  loadTeam: vi.fn(),
  loadRoles: vi.fn(),
  loadAudit: vi.fn(),
  loadActors: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/gates", () => ({ requireTeamMember: mocks.requireTeamMember }));
vi.mock("@/components/dashboard/gate", () => ({ sectionAccess: mocks.sectionAccess }));
vi.mock("@/components/dashboard/team/data", () => ({
  loadTeam: mocks.loadTeam,
  loadRoles: mocks.loadRoles,
  loadAudit: mocks.loadAudit,
  loadActors: mocks.loadActors,
}));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "user_admin" })),
  clerkClient: vi.fn(),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getMessages: async () => ({
    DashboardTeam: { audit: { actions: {}, entities: {} } },
    DashboardContent: { types: {} },
  }),
}));
vi.mock("@/i18n/navigation", () => ({ Link: () => null, useRouter: () => ({}) }));

const { default: TeamPage } = await import("./page");
const { default: TeamRolesPage } = await import("./roles/page");
const { default: TeamAuditPage } = await import("./audit/page");
const { Refusal } = await import("@/components/dashboard/refusal");

const params = Promise.resolve({ locale: "en" });
const searchParams = Promise.resolve({});

const PAGES = [
  ["/dashboard/team", () => TeamPage({ params, searchParams })],
  ["/dashboard/team/roles", () => TeamRolesPage({ params })],
  ["/dashboard/team/audit", () => TeamAuditPage({ params, searchParams })],
] as const;

beforeEach(() => {
  mocks.requireTeamMember.mockReset().mockResolvedValue({});
  mocks.sectionAccess.mockReset();
  mocks.loadTeam.mockReset().mockResolvedValue({ members: [], total: 0, invitations: [] });
  mocks.loadRoles.mockReset().mockResolvedValue([]);
  mocks.loadAudit.mockReset().mockResolvedValue({ entries: [], total: 0 });
  mocks.loadActors.mockReset().mockResolvedValue([]);
});

describe("Team pages", () => {
  it.each(PAGES)(
    "%s refuses a member without team.manage, and reads nothing",
    async (path, open) => {
      mocks.sectionAccess.mockResolvedValue({ locale: "en", allowed: false });
      const page = await open();
      expect(isValidElement(page) && page.type).toBe(Refusal);
      expect(mocks.requireTeamMember).toHaveBeenCalledWith(params, path);
      expect(mocks.sectionAccess).toHaveBeenCalledWith(params, PERMISSIONS.TEAM_MANAGE);
      for (const load of [mocks.loadTeam, mocks.loadRoles, mocks.loadAudit, mocks.loadActors]) {
        expect(load).not.toHaveBeenCalled();
      }
    },
  );

  it.each(PAGES)("%s opens for a member with team.manage", async (_path, open) => {
    mocks.sectionAccess.mockResolvedValue({ locale: "en", allowed: true });
    const page = await open();
    expect(isValidElement(page) && page.type).not.toBe(Refusal);
  });

  it("reads the asked page of members", async () => {
    mocks.sectionAccess.mockResolvedValue({ locale: "en", allowed: true });
    mocks.loadTeam.mockResolvedValue({ members: [], total: 30, invitations: [] });
    await TeamPage({ params, searchParams: Promise.resolve({ page: "2", status: "disabled" }) });
    expect(mocks.loadTeam).toHaveBeenCalledWith(
      { page: 2, pageSize: 20, status: "disabled" },
      "en",
    );
  });

  it("sends an audit page past the end to the last page, keeping the filter", async () => {
    mocks.sectionAccess.mockResolvedValue({ locale: "en", allowed: true });
    mocks.loadAudit.mockResolvedValue({ entries: [], total: 21 });
    await expect(
      TeamAuditPage({ params, searchParams: Promise.resolve({ page: "9", entity: "roles" }) }),
    ).rejects.toThrow("redirect:/en/dashboard/team/audit?entity=roles&page=2");
  });
});
