import { PERMISSIONS } from "@repo/shared";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeamMember: vi.fn(),
  sectionAccess: vi.fn(),
  loadMessages: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("@/lib/auth/gates", () => ({ requireTeamMember: mocks.requireTeamMember }));
vi.mock("@/components/dashboard/gate", () => ({ sectionAccess: mocks.sectionAccess }));
vi.mock("@/components/dashboard/messages/data", async (original) => ({
  ...(await original<typeof import("@/components/dashboard/messages/data")>()),
  loadMessages: mocks.loadMessages,
}));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getMessages: async () => ({ DashboardMessages: {} }),
}));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));

const { default: MessagesPage } = await import("./page");
const { Refusal } = await import("@/components/dashboard/refusal");

const params = Promise.resolve({ locale: "en" });

beforeEach(() => {
  mocks.requireTeamMember.mockReset().mockResolvedValue({});
  mocks.sectionAccess.mockReset();
  mocks.loadMessages.mockReset().mockResolvedValue({ messages: [], total: 0 });
});

describe("/dashboard/messages", () => {
  it("refuses a member without messages.view, and reads no message", async () => {
    mocks.sectionAccess.mockResolvedValue({ locale: "en", allowed: false });
    const page = await MessagesPage({ params, searchParams: Promise.resolve({}) });
    expect(isValidElement(page) && page.type).toBe(Refusal);
    expect(mocks.requireTeamMember).toHaveBeenCalledWith(params, "/dashboard/messages");
    expect(mocks.sectionAccess).toHaveBeenCalledWith(params, PERMISSIONS.MESSAGES_VIEW);
    expect(mocks.loadMessages).not.toHaveBeenCalled();
  });

  it("reads the asked page for a member with messages.view", async () => {
    mocks.sectionAccess.mockResolvedValue({ locale: "en", allowed: true });
    mocks.loadMessages.mockResolvedValue({ messages: [], total: 30 });
    const page = await MessagesPage({
      params,
      searchParams: Promise.resolve({ page: "2", read: "unread", search: "budget" }),
    });
    expect(isValidElement(page) && page.type).not.toBe(Refusal);
    expect(mocks.loadMessages).toHaveBeenCalledWith({
      page: 2,
      pageSize: 20,
      read: "unread",
      search: "budget",
    });
  });

  it("sends a page past the end to the last page, keeping the filter and page size", async () => {
    mocks.sectionAccess.mockResolvedValue({ locale: "en", allowed: true });
    mocks.loadMessages.mockResolvedValue({ messages: [], total: 12 });
    await expect(
      MessagesPage({
        params,
        searchParams: Promise.resolve({ page: "7", pageSize: "5", read: "unread" }),
      }),
    ).rejects.toThrow("redirect:/en/dashboard/messages?read=unread&pageSize=5&page=3");

    // No match at all: page 1 is the last page.
    mocks.loadMessages.mockResolvedValue({ messages: [], total: 0 });
    await expect(
      MessagesPage({ params, searchParams: Promise.resolve({ page: "4" }) }),
    ).rejects.toThrow("redirect:/en/dashboard/messages");
  });
});
