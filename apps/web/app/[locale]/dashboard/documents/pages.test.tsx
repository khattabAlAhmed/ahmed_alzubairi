import type { AdminDocument } from "@repo/shared";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeamMember: vi.fn(),
  documentsAccess: vi.fn(),
  loadDocuments: vi.fn(),
  loadDocument: vi.fn(),
  loadAccessLog: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: vi.fn() }));
vi.mock("@/lib/auth/gates", () => ({ requireTeamMember: mocks.requireTeamMember }));
vi.mock("@/components/dashboard/documents/data", () => ({
  documentsAccess: mocks.documentsAccess,
  loadDocuments: mocks.loadDocuments,
  loadDocument: mocks.loadDocument,
  loadAccessLog: mocks.loadAccessLog,
  ACCESS_LOG_LIMIT: 100,
}));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getMessages: async () => ({ DashboardDocuments: {}, Workspace: {} }),
}));
vi.mock("@/i18n/navigation", () => ({ Link: () => null, useRouter: () => ({}) }));

const { default: DocumentsPage } = await import("./page");
const { default: NewDocumentPage } = await import("./new/page");
const { default: DocumentPage } = await import("./[id]/page");
const { Refusal } = await import("@/components/dashboard/refusal");
const { DeleteDocument } = await import("@/components/dashboard/documents/delete-document");
const { AccessLog } = await import("@/components/dashboard/documents/access-log");
const { DocumentForm } = await import("@/components/dashboard/documents/document-form");
const { PublishToggle } = await import("@/components/dashboard/documents/publish-toggle");

const params = Promise.resolve({ locale: "en" });
const ID = "11111111-1111-4111-8111-111111111111";
const idParams = Promise.resolve({ locale: "en", id: ID });
const DOC: AdminDocument = {
  id: ID,
  category: "thank_you_letter",
  titleAr: "خطاب شكر",
  titleEn: "Thank-you letter",
  mime: "application/pdf",
  accessMode: "view",
  status: "published",
};
const ALL = { locale: "en", allowed: true, canDelete: true, canSeeLog: true };

function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const props = node.props as Record<string, unknown>;
  const nested = [props.children, props.actions].flatMap((child) => elements(child as ReactNode));
  return [node, ...nested];
}
const has = (tree: ReactNode, type: unknown) => elements(tree).some((element) => element.type === type);

beforeEach(() => {
  mocks.requireTeamMember.mockReset().mockResolvedValue({});
  mocks.documentsAccess.mockReset().mockResolvedValue(ALL);
  mocks.loadDocuments.mockReset().mockResolvedValue([DOC]);
  mocks.loadDocument.mockReset().mockResolvedValue(DOC);
  mocks.loadAccessLog.mockReset().mockResolvedValue([]);
});

describe("refused without documents.manage", () => {
  beforeEach(() => {
    mocks.documentsAccess.mockResolvedValue({ locale: "en", allowed: false, canDelete: true, canSeeLog: true });
  });

  it("/dashboard/documents", async () => {
    const page = await DocumentsPage({ params });
    expect(isValidElement(page) && page.type).toBe(Refusal);
    expect(mocks.requireTeamMember).toHaveBeenCalledWith(params, "/dashboard/documents");
    expect(mocks.loadDocuments).not.toHaveBeenCalled();
  });

  it("/dashboard/documents/new", async () => {
    const page = await NewDocumentPage({ params });
    expect(isValidElement(page) && page.type).toBe(Refusal);
  });

  it("/dashboard/documents/[id]", async () => {
    const page = await DocumentPage({ params: idParams });
    expect(isValidElement(page) && page.type).toBe(Refusal);
    expect(mocks.loadDocument).not.toHaveBeenCalled();
    expect(mocks.loadAccessLog).not.toHaveBeenCalled();
  });
});

describe("/dashboard/documents", () => {
  it("lists each document with its publish control", async () => {
    const page = await DocumentsPage({ params });
    const toggles = elements(page).filter((element) => element.type === PublishToggle);
    expect(toggles.map((element) => element.props)).toEqual([
      { id: ID, title: "Thank-you letter", status: "published" },
    ]);
  });

  it("shows the empty state with no documents", async () => {
    mocks.loadDocuments.mockResolvedValue([]);
    const page = await DocumentsPage({ params });
    expect(has(page, PublishToggle)).toBe(false);
  });
});

describe("/dashboard/documents/new", () => {
  it("shows the create form", async () => {
    const page = await NewDocumentPage({ params });
    const form = elements(page).find((element) => element.type === DocumentForm);
    expect(form?.props).toEqual({});
  });
});

describe("/dashboard/documents/[id]", () => {
  it("shows the form, the log and delete for the admin", async () => {
    const page = await DocumentPage({ params: idParams });
    expect(has(page, DocumentForm)).toBe(true);
    expect(has(page, AccessLog)).toBe(true);
    expect(has(page, DeleteDocument)).toBe(true);
    expect(mocks.loadAccessLog).toHaveBeenCalledWith({ documentId: ID });
  });

  it("hides delete without data.delete", async () => {
    mocks.documentsAccess.mockResolvedValue({ ...ALL, canDelete: false });
    const page = await DocumentPage({ params: idParams });
    expect(has(page, DeleteDocument)).toBe(false);
  });

  it("reads no log without document_requests.decide", async () => {
    mocks.documentsAccess.mockResolvedValue({ ...ALL, canSeeLog: false });
    const page = await DocumentPage({ params: idParams });
    expect(has(page, AccessLog)).toBe(false);
    expect(mocks.loadAccessLog).not.toHaveBeenCalled();
  });

  it("answers not found for a bad id or a missing document", async () => {
    await expect(DocumentPage({ params: Promise.resolve({ locale: "en", id: "nope" }) })).rejects.toThrow("not-found");
    mocks.loadDocument.mockResolvedValue(null);
    await expect(DocumentPage({ params: idParams })).rejects.toThrow("not-found");
  });
});
