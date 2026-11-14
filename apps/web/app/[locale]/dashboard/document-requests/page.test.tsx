import type { AdminDocumentRequest } from "@repo/shared";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeamMember: vi.fn(),
  requestsAccess: vi.fn(),
  loadRequests: vi.fn(),
  loadRequest: vi.fn(),
  loadDocumentOptions: vi.fn(),
  loadAccessLog: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: vi.fn() }));
vi.mock("@/lib/auth/gates", () => ({ requireTeamMember: mocks.requireTeamMember }));
vi.mock("@/components/dashboard/document-requests/data", async (original) => ({
  ...(await original<typeof import("@/components/dashboard/document-requests/data")>()),
  requestsAccess: mocks.requestsAccess,
  loadRequests: mocks.loadRequests,
  loadRequest: mocks.loadRequest,
  loadDocumentOptions: mocks.loadDocumentOptions,
}));
vi.mock("@/components/dashboard/documents/data", () => ({
  loadAccessLog: mocks.loadAccessLog,
  profileNames: vi.fn(),
  ACCESS_LOG_LIMIT: 100,
}));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getMessages: async () => ({
    DashboardDocumentRequests: {},
    Workspace: { status: { documentRequest: {} } },
  }),
}));
vi.mock("@/i18n/navigation", () => ({ Link: () => null, useRouter: () => ({}) }));

const { default: RequestsPage } = await import("./page");
const { Refusal } = await import("@/components/dashboard/refusal");
const { RequestDetail } = await import("@/components/dashboard/document-requests/request-detail");

const params = Promise.resolve({ locale: "en" });
const ID = "44444444-4444-4444-8444-444444444444";
const DOC_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST: AdminDocumentRequest = {
  id: ID,
  clientId: "user_client",
  clientName: "Test Client",
  documentId: DOC_ID,
  documentTitleAr: "خطاب شكر",
  documentTitleEn: "Thank-you letter",
  documentAccessMode: "view",
  purpose: "A tender file.",
  status: "granted",
  consultationId: null,
  decidedBy: "user_admin",
  grantedAt: "2026-11-14T10:00:00.000Z",
  expiresAt: null,
  revokedAt: null,
  createdAt: "2026-11-14T09:00:00.000Z",
  recommendations: [],
};

function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  return [node, ...elements((node.props as { children?: ReactNode }).children)];
}
const detailOf = (tree: ReactNode) => elements(tree).find((element) => element.type === RequestDetail);

beforeEach(() => {
  mocks.requireTeamMember.mockReset().mockResolvedValue({});
  mocks.requestsAccess.mockReset().mockResolvedValue({ locale: "en", allowed: true, canDecide: true });
  mocks.loadRequests.mockReset().mockResolvedValue({ requests: [REQUEST], total: 1 });
  mocks.loadRequest.mockReset().mockResolvedValue(REQUEST);
  mocks.loadDocumentOptions.mockReset().mockResolvedValue([]);
  mocks.loadAccessLog.mockReset().mockResolvedValue([]);
  mocks.redirect.mockClear();
});

describe("/dashboard/document-requests", () => {
  it("refuses a member without document_requests.recommend, and reads nothing", async () => {
    mocks.requestsAccess.mockResolvedValue({ locale: "en", allowed: false, canDecide: true });
    const page = await RequestsPage({ params, searchParams: Promise.resolve({ request: ID }) });
    expect(isValidElement(page) && page.type).toBe(Refusal);
    expect(mocks.requireTeamMember).toHaveBeenCalledWith(params, "/dashboard/document-requests");
    expect(mocks.loadRequests).not.toHaveBeenCalled();
    expect(mocks.loadRequest).not.toHaveBeenCalled();
  });

  it("reads the filtered page, with the document filter", async () => {
    await RequestsPage({
      params,
      searchParams: Promise.resolve({ status: "granted", document: DOC_ID, page: "1", search: " x " }),
    });
    expect(mocks.loadRequests).toHaveBeenCalledWith(
      expect.objectContaining({ status: "granted", document: DOC_ID, page: 1, search: "x" }),
    );
  });

  it("drops a filter value it can't use", async () => {
    await RequestsPage({ params, searchParams: Promise.resolve({ status: "rejected", document: "nope" }) });
    const [list] = mocks.loadRequests.mock.calls[0] ?? [];
    expect(list).not.toHaveProperty("status", "rejected");
    expect(list?.document).toBeUndefined();
  });

  it("sends a page past the end to the last page", async () => {
    mocks.loadRequests.mockResolvedValue({ requests: [], total: 1 });
    await expect(
      RequestsPage({ params, searchParams: Promise.resolve({ page: "5", status: "granted" }) }),
    ).rejects.toThrow("redirect:/en/dashboard/document-requests?status=granted");
  });

  it("opens ?request=<id>, with decisions and the log for the admin", async () => {
    const page = await RequestsPage({ params, searchParams: Promise.resolve({ request: ID }) });
    expect(mocks.loadRequest).toHaveBeenCalledWith(ID);
    expect(mocks.loadAccessLog).toHaveBeenCalledWith({ requestId: ID });
    expect(detailOf(page)?.props).toMatchObject({ request: REQUEST, canDecide: true, log: [] });
    expect(mocks.loadRequests).not.toHaveBeenCalled();
  });

  it("opens a request without decisions or the log for a recommender", async () => {
    mocks.requestsAccess.mockResolvedValue({ locale: "en", allowed: true, canDecide: false });
    const page = await RequestsPage({ params, searchParams: Promise.resolve({ request: ID }) });
    expect(detailOf(page)?.props).toMatchObject({ canDecide: false, log: null });
    expect(mocks.loadAccessLog).not.toHaveBeenCalled();
  });

  it("says so when the request isn't visible", async () => {
    mocks.loadRequest.mockResolvedValue(null);
    const page = await RequestsPage({ params, searchParams: Promise.resolve({ request: ID }) });
    expect(detailOf(page)).toBeUndefined();
    expect(mocks.loadAccessLog).not.toHaveBeenCalled();
  });
});
