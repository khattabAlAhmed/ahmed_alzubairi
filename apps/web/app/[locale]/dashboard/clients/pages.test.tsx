import type { AdminClient } from "@repo/shared";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeamMember: vi.fn(),
  clientAccess: vi.fn(),
  loadClients: vi.fn(),
  loadClient: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/lib/auth/gates", () => ({ requireTeamMember: mocks.requireTeamMember }));
vi.mock("@/components/dashboard/clients/data", () => ({
  clientAccess: mocks.clientAccess,
  loadClients: mocks.loadClients,
  loadClient: mocks.loadClient,
}));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getMessages: async () => ({ DashboardClients: {} }),
}));
vi.mock("@/i18n/navigation", () => ({ Link: () => null, useRouter: () => ({}) }));

const { default: ClientsPage } = await import("./page");
const { default: ClientPage } = await import("./[id]/page");
const { Refusal } = await import("@/components/dashboard/refusal");
const { AccountControl } = await import("@/components/dashboard/clients/account-control");

const params = Promise.resolve({ locale: "en" });
const CLIENT: AdminClient = {
  id: "user_client",
  fullName: "Test Client",
  email: "client@example.com",
  phone: "+966500000000",
  orgType: "company",
  orgName: "Example Co",
  jobTitle: null,
  locale: "ar",
  status: "active",
  createdAt: "2026-11-07T10:00:00.000Z",
};

/** Every element in a rendered tree, depth first. */
function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const children = (node.props as { children?: ReactNode }).children;
  return [node, ...elements(children)];
}

beforeEach(() => {
  mocks.requireTeamMember.mockReset().mockResolvedValue({});
  mocks.clientAccess.mockReset();
  mocks.loadClients.mockReset().mockResolvedValue({ clients: [], total: 0 });
  mocks.loadClient.mockReset().mockResolvedValue(CLIENT);
});

describe("/dashboard/clients", () => {
  it("refuses a member with no client access, and reads nothing", async () => {
    mocks.clientAccess.mockResolvedValue({ locale: "en", allowed: false, canManage: false });
    const page = await ClientsPage({ params, searchParams: Promise.resolve({}) });
    expect(isValidElement(page) && page.type).toBe(Refusal);
    expect(mocks.requireTeamMember).toHaveBeenCalledWith(params, "/dashboard/clients");
    expect(mocks.loadClients).not.toHaveBeenCalled();
  });

  it("reads the asked page for a scoped member", async () => {
    mocks.clientAccess.mockResolvedValue({ locale: "en", allowed: true, canManage: false });
    mocks.loadClients.mockResolvedValue({ clients: [CLIENT], total: 30 });
    const page = await ClientsPage({
      params,
      searchParams: Promise.resolve({ page: "2", status: "disabled", search: "acme" }),
    });
    expect(isValidElement(page) && page.type).not.toBe(Refusal);
    expect(mocks.loadClients).toHaveBeenCalledWith({
      page: 2,
      pageSize: 20,
      status: "disabled",
      search: "acme",
    });
  });

  it("keys the filter form by the applied filters, so Clear resets its controls", async () => {
    mocks.clientAccess.mockResolvedValue({ locale: "en", allowed: true, canManage: true });
    const formKey = async (searchParams: Record<string, string>) => {
      const page = await ClientsPage({ params, searchParams: Promise.resolve(searchParams) });
      return elements(page).find((element) => element.type === "form")?.key;
    };
    const filtered = await formKey({ status: "disabled" });
    const cleared = await formKey({});
    expect(filtered).not.toBe(cleared);
    expect(await formKey({ status: "disabled" })).toBe(filtered);
  });

  it("sends a page past the end to the last page, keeping the filter", async () => {
    mocks.clientAccess.mockResolvedValue({ locale: "ar", allowed: true, canManage: true });
    mocks.loadClients.mockResolvedValue({ clients: [], total: 3 });
    await expect(
      ClientsPage({ params, searchParams: Promise.resolve({ page: "5", status: "active" }) }),
    ).rejects.toThrow("redirect:/ar/dashboard/clients?status=active");
  });
});

describe("/dashboard/clients/[id]", () => {
  const open = (id = "user_client") => ClientPage({ params: Promise.resolve({ locale: "en", id }) });

  it("refuses a member with no client access, and reads nothing", async () => {
    mocks.clientAccess.mockResolvedValue({ locale: "en", allowed: false, canManage: false });
    const page = await open();
    expect(isValidElement(page) && page.type).toBe(Refusal);
    expect(mocks.loadClient).not.toHaveBeenCalled();
  });

  it("answers not found for a client RLS doesn't show", async () => {
    mocks.clientAccess.mockResolvedValue({ locale: "en", allowed: true, canManage: false });
    mocks.loadClient.mockResolvedValue(null);
    await expect(open("user_other")).rejects.toThrow("not-found");
    expect(mocks.loadClient).toHaveBeenCalledWith("user_other");
  });

  it("has no disable button without clients.view_all", async () => {
    mocks.clientAccess.mockResolvedValue({ locale: "en", allowed: true, canManage: false });
    const page = await open();
    expect(elements(page).some((node) => node.type === AccountControl)).toBe(false);
  });

  it("shows the disable button with clients.view_all", async () => {
    mocks.clientAccess.mockResolvedValue({ locale: "en", allowed: true, canManage: true });
    const page = await open();
    const control = elements(page).find((node) => node.type === AccountControl);
    expect(control?.props).toEqual({ id: "user_client", name: "Test Client", status: "active" });
  });

  it("shows the empty history block", async () => {
    mocks.clientAccess.mockResolvedValue({ locale: "en", allowed: true, canManage: false });
    const page = await open();
    const texts = elements(page).flatMap((node) => {
      const children = (node.props as { children?: unknown }).children;
      return typeof children === "string" ? [children] : [];
    });
    expect(texts).toContain("detail.historyEmptyTitle");
  });
});
