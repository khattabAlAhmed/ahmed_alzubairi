import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnRequest } from "@/components/documents/group";

const mocks = vi.hoisted(() => ({
  requireProfile: vi.fn(),
  readOwnRequests: vi.fn(),
  readOwnRequest: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: vi.fn() }));
vi.mock("@/lib/auth/gates", () => ({ requireProfile: mocks.requireProfile }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: "user_client" }) }));
vi.mock("@/components/documents/read", () => ({
  readOwnRequests: mocks.readOwnRequests,
  readOwnRequest: mocks.readOwnRequest,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getMessages: async () => ({ AccountDocuments: {}, Workspace: {} }),
}));
vi.mock("@/i18n/navigation", () => ({ Link: () => null, useRouter: () => ({}) }));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({}) }));

const { default: MyDocumentsPage } = await import("./page");
const { default: ViewerPage } = await import("./[requestId]/page");
const { RequestCard } = await import("@/components/documents/request-card");
const { DocumentViewer } = await import("@/components/documents/viewer");

const params = Promise.resolve({ locale: "en" });
const ID = "66666666-6666-4666-8666-666666666666";
const viewerParams = Promise.resolve({ locale: "en", requestId: ID });
const REQUEST: OwnRequest = {
  id: ID,
  documentId: "11111111-1111-4111-8111-111111111111",
  title: "Course certificate",
  category: "course_certificate",
  accessMode: "view",
  mime: "application/pdf",
  status: "granted",
  consultationId: null,
  expiresAt: null,
  createdAt: "2026-11-14T10:00:00.000Z",
};

function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  return [node, ...elements((node.props as { children?: ReactNode }).children)];
}
const cardsOf = (tree: ReactNode) =>
  elements(tree)
    .filter((element) => element.type === RequestCard)
    .map((element) => element.props as { request: OwnRequest; group: string; canRequestAgain: boolean });

beforeEach(() => {
  mocks.requireProfile.mockReset().mockResolvedValue({});
  mocks.readOwnRequests.mockReset().mockResolvedValue([]);
  mocks.readOwnRequest.mockReset().mockResolvedValue(REQUEST);
});

describe("/account/documents", () => {
  it("needs a profile, and reads the client's own requests", async () => {
    await MyDocumentsPage({ params });
    expect(mocks.requireProfile).toHaveBeenCalledWith(params, "/account/documents");
    expect(mocks.readOwnRequests).toHaveBeenCalledWith("user_client", "en");
  });

  it("keeps the empty state with no requests", async () => {
    const page = await MyDocumentsPage({ params });
    expect(cardsOf(page)).toEqual([]);
    expect(elements(page).some((element) => (element.props as { children?: unknown }).children === "empty.title")).toBe(true);
  });

  it("puts each request in its group, and offers طلب مجدداً on ended ones", async () => {
    mocks.readOwnRequests.mockResolvedValue([
      { ...REQUEST, id: "a" },
      { ...REQUEST, id: "p", documentId: "d2", status: "pending_review" },
      { ...REQUEST, id: "x", documentId: "d3", status: "expired" },
      { ...REQUEST, id: "r", documentId: "d4", status: "revoked" },
    ]);
    const cards = cardsOf(await MyDocumentsPage({ params }));
    expect(cards.map((card) => [card.request.id, card.group, card.canRequestAgain])).toEqual([
      ["a", "available", false],
      ["p", "inProgress", false],
      ["x", "ended", true],
      ["r", "ended", true],
    ]);
  });

  it("drops a withdrawn document from the available group", async () => {
    mocks.readOwnRequests.mockResolvedValue([{ ...REQUEST, status: "revoked" }]);
    const cards = cardsOf(await MyDocumentsPage({ params }));
    expect(cards.filter((card) => card.group === "available")).toEqual([]);
  });
});

describe("/account/documents/[requestId]", () => {
  it("shows the viewer for a live grant", async () => {
    const page = await ViewerPage({ params: viewerParams });
    const viewer = elements(page).find((element) => element.type === DocumentViewer);
    expect(viewer?.props).toEqual({
      documentId: REQUEST.documentId,
      title: "Course certificate",
      mime: "application/pdf",
      accessMode: "view",
    });
    expect(mocks.readOwnRequest).toHaveBeenCalledWith("user_client", ID, "en");
  });

  it.each([
    ["revoked", null],
    ["pending_review", null],
    ["granted", "2000-01-01T00:00:00.000Z"],
  ] as const)("shows no viewer for a %s request (expiry %s)", async (status, expiresAt) => {
    mocks.readOwnRequest.mockResolvedValue({ ...REQUEST, status, expiresAt });
    const page = await ViewerPage({ params: viewerParams });
    expect(elements(page).some((element) => element.type === DocumentViewer)).toBe(false);
  });

  it("answers not found for someone else's request or a bad id", async () => {
    mocks.readOwnRequest.mockResolvedValue(null);
    await expect(ViewerPage({ params: viewerParams })).rejects.toThrow("not-found");
    await expect(ViewerPage({ params: Promise.resolve({ locale: "en", requestId: "x" }) })).rejects.toThrow("not-found");
  });
});
