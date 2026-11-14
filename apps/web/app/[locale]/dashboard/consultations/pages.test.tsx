import type { Consultation } from "@repo/shared";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeamMember: vi.fn(),
  consultationsAccess: vi.fn(),
  loadConsultations: vi.fn(),
  loadConsultation: vi.fn(),
  loadAssignees: vi.fn(),
  getServices: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth/gates", () => ({ requireTeamMember: mocks.requireTeamMember }));
vi.mock("@/lib/content", () => ({ getServices: mocks.getServices }));
vi.mock("@/components/dashboard/consultations/data", () => ({
  CONSULTATION_LIST_KEYS: ["page", "pageSize", "search", "status", "kind"],
  consultationsAccess: mocks.consultationsAccess,
  loadConsultations: mocks.loadConsultations,
  loadConsultation: mocks.loadConsultation,
  loadAssignees: mocks.loadAssignees,
  withMine: (params: object) => params,
  // The same rule as data.ts.
  mayWorkOn: (
    access: { viewAll: boolean; reply: boolean; userId: string },
    consultation: { assignedTo: string | null },
  ) => access.viewAll || (access.reply && consultation.assignedTo === access.userId),
}));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getMessages: async () => ({
    DashboardConsultations: { thread: {} },
    AccountConsultations: { detail: {} },
    Workspace: { status: { consultation: {} } },
  }),
}));
vi.mock("@/i18n/navigation", () => ({ Link: () => null, useRouter: () => ({}) }));

const { default: ListPage } = await import("./page");
const { default: DetailPage } = await import("./[id]/page");
const { Refusal } = await import("@/components/dashboard/refusal");
const { AssignControl, StatusControl } = await import("@/components/dashboard/consultations/consultation-controls");
const { DeleteConsultation } = await import("@/components/dashboard/consultations/delete-consultation");
const { Meetings } = await import("@/components/dashboard/consultations/meetings");
const { ConsultationThread } = await import("@/components/consultations/consultation-thread");

const ME = "user_assistant";
const ID = "11111111-1111-4111-8111-111111111111";
const params = Promise.resolve({ locale: "en" });
const idParams = Promise.resolve({ locale: "en", id: ID });
const searchParams = Promise.resolve({});

const CONSULTATION: Consultation = {
  id: ID,
  kind: "consultation",
  clientId: "user_client",
  serviceId: null,
  title: "Board charter",
  description: "A review.",
  organization: null,
  status: "in_review",
  assignedTo: ME,
  firstReplyAt: null,
  closedAt: null,
  createdAt: "2026-11-14T10:00:00.000Z",
};

function view(changes: Partial<Consultation> = {}, documentRequestId: string | null = null) {
  return {
    consultation: { ...CONSULTATION, ...changes },
    messages: [],
    attachments: [],
    meetings: [],
    client: { name: "Test Client", email: "client@example.invalid", phone: null, orgName: null },
    assigneeName: "Assistant",
    documentRequestId,
  };
}

const access = (granted: Partial<Record<"viewAll" | "reply" | "assign" | "delete", boolean>>) => ({
  locale: "en",
  userId: ME,
  viewAll: false,
  reply: false,
  assign: false,
  delete: false,
  ...granted,
  allowed: Boolean(granted.viewAll || granted.reply),
});

function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const props = node.props as Record<string, unknown>;
  const nested = [props.children, props.actions].flatMap((child) => elements(child as ReactNode));
  return [node, ...nested];
}
const find = (tree: ReactNode, type: unknown) => elements(tree).find((element) => element.type === type);
const has = (tree: ReactNode, type: unknown) => find(tree, type) !== undefined;

beforeEach(() => {
  mocks.requireTeamMember.mockReset().mockResolvedValue({});
  mocks.consultationsAccess.mockReset().mockResolvedValue(access({ viewAll: true, reply: true, assign: true, delete: true }));
  mocks.loadConsultations.mockReset().mockResolvedValue({ consultations: [], total: 0 });
  mocks.loadConsultation.mockReset().mockResolvedValue(view());
  mocks.loadAssignees.mockReset().mockResolvedValue([{ id: ME, name: "Assistant" }]);
  mocks.getServices.mockReset().mockResolvedValue([]);
});

describe("refused without consultations.view_all or consultations.reply", () => {
  beforeEach(() => {
    // Even assign and delete don't open the section.
    mocks.consultationsAccess.mockResolvedValue(access({ assign: true, delete: true }));
  });

  it("/dashboard/consultations", async () => {
    const page = await ListPage({ params, searchParams });
    expect(isValidElement(page) && page.type).toBe(Refusal);
    expect(mocks.requireTeamMember).toHaveBeenCalledWith(params, "/dashboard/consultations");
    expect(mocks.loadConsultations).not.toHaveBeenCalled();
  });

  it("/dashboard/consultations/[id]", async () => {
    const page = await DetailPage({ params: idParams });
    expect(isValidElement(page) && page.type).toBe(Refusal);
    expect(mocks.requireTeamMember).toHaveBeenCalledWith(idParams, "/dashboard/consultations/[id]");
    expect(mocks.loadConsultation).not.toHaveBeenCalled();
  });
});

describe("/dashboard/consultations/[id]", () => {
  it("shows every control to the admin", async () => {
    const page = await DetailPage({ params: idParams });
    expect(has(page, StatusControl)).toBe(true);
    expect(find(page, AssignControl)?.props).toMatchObject({ id: ID, assignedTo: ME });
    expect(find(page, DeleteConsultation)?.props).toEqual({ id: ID, title: "Board charter" });
    expect(find(page, Meetings)?.props).toMatchObject({ editable: true });
    expect(find(page, ConsultationThread)?.props).toMatchObject({ closed: false });
  });

  it("has no assign control without consultations.assign, and reads no assignees", async () => {
    mocks.consultationsAccess.mockResolvedValue(access({ viewAll: true, delete: true }));
    const page = await DetailPage({ params: idParams });
    expect(has(page, AssignControl)).toBe(false);
    expect(mocks.loadAssignees).not.toHaveBeenCalled();
    expect(has(page, StatusControl)).toBe(true);
  });

  it("has no delete button without data.delete", async () => {
    mocks.consultationsAccess.mockResolvedValue(access({ viewAll: true, assign: true }));
    const page = await DetailPage({ params: idParams });
    expect(has(page, DeleteConsultation)).toBe(false);
  });

  it("lets an assistant work on their own consultation, without assign or delete", async () => {
    mocks.consultationsAccess.mockResolvedValue(access({ reply: true }));
    const page = await DetailPage({ params: idParams });
    expect(has(page, StatusControl)).toBe(true);
    expect(find(page, Meetings)?.props).toMatchObject({ editable: true });
    expect(find(page, ConsultationThread)?.props).toMatchObject({ closed: false });
    expect(has(page, AssignControl)).toBe(false);
    expect(has(page, DeleteConsultation)).toBe(false);
  });

  it("has no status control without reply rights on it: reply, but assigned to someone else", async () => {
    mocks.consultationsAccess.mockResolvedValue(access({ reply: true }));
    mocks.loadConsultation.mockResolvedValue(view({ assignedTo: "user_other" }));
    const page = await DetailPage({ params: idParams });
    expect(has(page, StatusControl)).toBe(false);
    expect(find(page, Meetings)?.props).toMatchObject({ editable: false });
    expect(find(page, ConsultationThread)?.props).toMatchObject({ closed: true });
  });

  it("closed: no status, assign, meeting or reply controls; delete stays", async () => {
    mocks.loadConsultation.mockResolvedValue(view({ status: "closed", closedAt: "2026-11-14T12:00:00.000Z" }));
    const page = await DetailPage({ params: idParams });
    expect(has(page, StatusControl)).toBe(false);
    expect(has(page, AssignControl)).toBe(false);
    expect(find(page, Meetings)?.props).toMatchObject({ editable: false });
    expect(find(page, ConsultationThread)?.props).toMatchObject({ closed: true });
    expect(has(page, DeleteConsultation)).toBe(true);
  });

  it("says not found when RLS hides it", async () => {
    mocks.loadConsultation.mockResolvedValue(null);
    const page = await DetailPage({ params: idParams });
    expect(has(page, StatusControl)).toBe(false);
    expect(has(page, ConsultationThread)).toBe(false);
  });

  it("keeps the current assignee selectable when they're no longer eligible", async () => {
    mocks.loadAssignees.mockResolvedValue([]);
    const page = await DetailPage({ params: idParams });
    expect((find(page, AssignControl)?.props as { assignees?: unknown } | undefined)?.assignees).toEqual([{ id: ME, name: "Assistant" }]);
  });
});

describe("/dashboard/consultations", () => {
  it("reads the list through the member's own id", async () => {
    mocks.consultationsAccess.mockResolvedValue(access({ reply: true }));
    await ListPage({ params, searchParams });
    expect(mocks.loadConsultations).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }), ME);
  });
});
