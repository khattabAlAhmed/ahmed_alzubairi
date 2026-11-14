// @vitest-environment jsdom
import {
  DOCUMENT_REQUEST_STATUSES,
  PERMISSIONS,
  type AdminDocumentRequest,
  type DocumentRequestStatus,
  type Permission,
} from "@repo/shared";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import arDocs from "@/messages/ar/DashboardDocuments.json";
import arRequests from "@/messages/ar/DashboardDocumentRequests.json";
import arWorkspace from "@/messages/ar/Workspace.json";
import enDocs from "@/messages/en/DashboardDocuments.json";
import enRequests from "@/messages/en/DashboardDocumentRequests.json";
import enWorkspace from "@/messages/en/Workspace.json";
import { callsOn, fakeClient, type Call } from "../documents/fake-client.test-helper";
import { loadRequest, loadRequests, requestPageParamsSchema, requestsAccess } from "./data";
import { DecideControls } from "./decide-controls";
import { RecommendForm } from "./recommend-form";
import { expiryFromDate } from "./send";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
const router = { refresh: vi.fn(), push: vi.fn() };
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => router,
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
const MESSAGES = {
  en: { DashboardDocumentRequests: enRequests, DashboardDocuments: enDocs, Workspace: enWorkspace },
  ar: { DashboardDocumentRequests: arRequests, DashboardDocuments: arDocs, Workspace: arWorkspace },
};
let serverLocale: "ar" | "en" = "en";
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: serverLocale, messages: MESSAGES[serverLocale], namespace: namespace as never }),
}));

// The log is an async server component, tested with the documents pages; here a stand-in.
vi.mock("@/components/dashboard/documents/access-log", () => ({
  AccessLog: ({ scope }: { scope: string }) => <section>Access log ({scope})</section>,
}));

const { RequestDetail } = await import("./request-detail");

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => json({ ok: true }));
  router.refresh.mockReset();
  serverLocale = "en";
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ID = "44444444-4444-4444-8444-444444444444";
const DOC_ID = "11111111-1111-4111-8111-111111111111";
const CHAT_ID = "55555555-5555-4555-8555-555555555555";

const REQUEST: AdminDocumentRequest = {
  id: ID,
  clientId: "user_client",
  clientName: "Test Client",
  documentId: DOC_ID,
  documentTitleAr: "خطاب شكر",
  documentTitleEn: "Thank-you letter",
  documentAccessMode: "view",
  purpose: "A tender file.",
  status: "pending_review",
  consultationId: null,
  decidedBy: null,
  grantedAt: null,
  expiresAt: null,
  revokedAt: null,
  createdAt: "2026-11-14T10:00:00.000Z",
  recommendations: [],
};

function withIntl(node: React.ReactNode, locale: "ar" | "en" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {node}
    </NextIntlClientProvider>,
  );
}

function decide(status: DocumentRequestStatus, locale: "ar" | "en" = "en") {
  return withIntl(
    <DecideControls requestId={ID} status={status} clientName="Test Client" documentTitle="Letter" />,
    locale,
  );
}

function sent() {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    method: init?.method,
    body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
  }));
}

const buttonNames = () => screen.queryAllByRole("button").map((button) => button.textContent);

/** A reject in either language, anywhere in the rendered page. */
const REJECT = /reject|declin|refuse|deny|رفض|رفض الطلب/i;

describe("requestsAccess", () => {
  const params = Promise.resolve({ locale: "ar" });
  it.each([
    [[PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND, PERMISSIONS.DOCUMENT_REQUESTS_DECIDE], true, true],
    [[PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND], true, false],
    [[PERMISSIONS.DOCUMENT_REQUESTS_DECIDE], false, true],
    [[PERMISSIONS.DOCUMENTS_MANAGE], false, false],
  ] as const)("with %j: opens %s, decides %s", async (keys, allowed, canDecide) => {
    const check = vi.fn(async () => new Set<Permission>(keys));
    expect(await requestsAccess(params, check)).toEqual({ locale: "ar", allowed, canDecide });
    expect(check).toHaveBeenCalledWith(
      [PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND, PERMISSIONS.DOCUMENT_REQUESTS_DECIDE],
      "ar",
    );
  });
});

describe("requestPageParamsSchema", () => {
  it("takes a document filter and a request to open, and drops neither shared field", () => {
    expect(
      requestPageParamsSchema.parse({ document: DOC_ID, request: ID, status: "granted", page: "2" }),
    ).toMatchObject({ document: DOC_ID, request: ID, status: "granted", page: 2 });
    expect(requestPageParamsSchema.safeParse({ document: "nope" }).success).toBe(false);
    expect(requestPageParamsSchema.safeParse({ status: "rejected" }).success).toBe(false);
  });
});

describe("expiryFromDate", () => {
  const now = new Date(2026, 10, 14, 12, 0);
  it("is the end of the picked day, in UTC", () => {
    expect(expiryFromDate("2026-11-20", now)).toBe(new Date(2026, 10, 20, 23, 59, 59, 999).toISOString());
  });
  it("still allows today, until the day ends", () => {
    expect(expiryFromDate("2026-11-14", now)).not.toBeNull();
  });
  it.each(["2026-11-13", "", "20/11/2026"])("refuses %j", (value) => {
    expect(expiryFromDate(value, now)).toBeNull();
  });
});

describe("DecideControls", () => {
  it("offers إتاحة and التواصل أولاً on a pending request, and nothing else", () => {
    decide("pending_review", "ar");
    expect(buttonNames()).toEqual(["إتاحة", "التواصل أولاً"]);
  });

  it("offers only the grant once the chat is open", () => {
    decide("in_contact");
    expect(buttonNames()).toEqual(["Make available"]);
  });

  it("offers only withdraw on a granted request", () => {
    decide("granted");
    expect(buttonNames()).toEqual(["Withdraw"]);
  });

  it.each(["expired", "revoked"] as const)("offers nothing on a %s request", (status) => {
    decide(status);
    expect(buttonNames()).toEqual([]);
  });

  it.each(["pending_review", "in_contact"] as const)("never offers withdraw on %s", (status) => {
    decide(status);
    expect(screen.queryByRole("button", { name: "Withdraw" })).toBeNull();
  });

  it.each(
    DOCUMENT_REQUEST_STATUSES.flatMap((status) => [
      [status, "en"],
      [status, "ar"],
    ]) as [DocumentRequestStatus, "ar" | "en"][],
  )("has no reject control on %s (%s)", (status, locale) => {
    const { container } = decide(status, locale);
    expect(container.textContent).not.toMatch(REJECT);
  });

  it("grants with no end date", async () => {
    decide("pending_review");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Make available" })));
    expect(sent()).toEqual([
      { url: `/api/admin/document-requests/${ID}/decide`, method: "POST", body: { decision: "grant" } },
    ]);
    expect(screen.getByRole("status").textContent).toBe("The document is now available to the client.");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("grants with the end of the picked day", async () => {
    decide("pending_review");
    fireEvent.change(screen.getByLabelText("Access ends on (optional)"), { target: { value: "2099-01-31" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Make available" })));
    expect(sent()[0]?.body).toEqual({
      decision: "grant",
      expiresAt: new Date(2099, 0, 31, 23, 59, 59, 999).toISOString(),
    });
  });

  it("lets the picker choose today", () => {
    decide("pending_review");
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    expect(screen.getByLabelText("Access ends on (optional)").getAttribute("min")).toBe(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    );
  });

  it("refuses a past end date without sending", async () => {
    decide("pending_review");
    fireEvent.change(screen.getByLabelText("Access ends on (optional)"), { target: { value: "2000-01-01" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Make available" })));
    expect(screen.getByText("Pick today or a later date.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens the chat with contact first", async () => {
    decide("pending_review");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Contact first" })));
    expect(sent()[0]?.body).toEqual({ decision: "contact_first" });
  });

  it("withdraws only after the confirm step", async () => {
    decide("granted");
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Withdraw Letter from Test Client? They can ask for it again.")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Yes, withdraw" })));
    expect(sent()).toEqual([
      { url: `/api/admin/document-requests/${ID}/decide`, method: "POST", body: { decision: "withdraw" } },
    ]);
  });

  it("shows the server's message when the decision is refused", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: "conflict", message: "Already decided." } }, 409));
    decide("pending_review");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Make available" })));
    expect(screen.getByRole("alert").textContent).toBe("Already decided.");
  });
});

describe("RecommendForm", () => {
  it("needs a choice before sending", async () => {
    withIntl(<RecommendForm requestId={ID} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send recommendation" })));
    expect(screen.getByText("Choose one.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the choice and a trimmed note", async () => {
    withIntl(<RecommendForm requestId={ID} />, "ar");
    fireEvent.click(screen.getByLabelText("تحتاج توضيح"));
    fireEvent.change(screen.getByLabelText("ملاحظة"), { target: { value: "  ask about the tender  " } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "إرسال التوصية" })));
    expect(sent()).toEqual([
      {
        url: `/api/admin/document-requests/${ID}/recommend`,
        method: "POST",
        body: { recommendation: "needs_clarification", note: "ask about the tender" },
      },
    ]);
    expect(router.refresh).toHaveBeenCalled();
  });

  it("locks the choice and the note while sending", async () => {
    let finish: (value: Response) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (finish = resolve)));
    withIntl(<RecommendForm requestId={ID} />);
    fireEvent.click(screen.getByLabelText("Approve"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send recommendation" })));
    expect(screen.getByLabelText("Needs clarification").matches(":disabled")).toBe(true);
    expect(screen.getByLabelText("Note").matches(":disabled")).toBe(true);
    await act(async () => finish(json({ ok: true })));
    expect(screen.getByLabelText("Note").matches(":disabled")).toBe(false);
  });

  it("sends no note when it is empty", async () => {
    withIntl(<RecommendForm requestId={ID} />);
    fireEvent.click(screen.getByLabelText("Approve"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send recommendation" })));
    expect(sent()[0]?.body).toEqual({ recommendation: "approve" });
  });
});

describe("RequestDetail", () => {
  async function show(request: AdminDocumentRequest, canDecide: boolean, locale: "ar" | "en" = "en") {
    serverLocale = locale;
    const tree = await RequestDetail({ request, locale, canDecide, log: canDecide ? [] : null });
    return withIntl(tree, locale);
  }

  it("shows no decision controls without document_requests.decide", async () => {
    await show(REQUEST, false);
    expect(screen.queryByRole("button", { name: "Make available" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Contact first" })).toBeNull();
    expect(screen.queryByText("Decision")).toBeNull();
    // The recommendation form is still there.
    expect(screen.getByRole("button", { name: "Send recommendation" })).toBeTruthy();
  });

  it("shows no withdraw and no access log without document_requests.decide", async () => {
    await show({ ...REQUEST, status: "granted", grantedAt: REQUEST.createdAt }, false);
    expect(screen.queryByRole("button", { name: "Withdraw" })).toBeNull();
    expect(screen.queryByText(/Access log/)).toBeNull();
  });

  it("shows the decision and the access log with it", async () => {
    await show(REQUEST, true);
    expect(screen.getByRole("button", { name: "Make available" })).toBeTruthy();
    expect(screen.getByText("Access log (request)")).toBeTruthy();
  });

  it("drops the recommend form once the request is closed", async () => {
    await show({ ...REQUEST, status: "granted", grantedAt: REQUEST.createdAt }, true);
    expect(screen.queryByRole("button", { name: "Send recommendation" })).toBeNull();
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeTruthy();
    expect(screen.getByText("No end date")).toBeTruthy();
  });

  it("links an in-contact request to its chat", async () => {
    await show({ ...REQUEST, status: "in_contact", consultationId: CHAT_ID }, true);
    const link = screen.getByRole("link", { name: "Open the chat with the client" });
    expect(link.getAttribute("href")).toBe(`/dashboard/consultations/${CHAT_ID}`);
  });

  it("lists the recommendations so far", async () => {
    await show(
      {
        ...REQUEST,
        recommendations: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            memberId: "user_editor",
            memberName: "Editor",
            recommendation: "approve",
            note: "Known client.",
            createdAt: REQUEST.createdAt,
          },
        ],
      },
      false,
    );
    expect(screen.getByText("Known client.")).toBeTruthy();
    expect(screen.getByText("Editor")).toBeTruthy();
  });

  it.each(
    DOCUMENT_REQUEST_STATUSES.flatMap((status) => [
      [status, "en"],
      [status, "ar"],
    ]) as [DocumentRequestStatus, "ar" | "en"][],
  )("has no reject control anywhere on a %s request (%s)", async (status, locale) => {
    const { container } = await show({ ...REQUEST, status, consultationId: CHAT_ID }, true, locale);
    expect(container.textContent).not.toMatch(REJECT);
    for (const button of screen.queryAllByRole("button")) {
      expect(button.textContent).not.toMatch(REJECT);
    }
  });

  it("renders the purpose as text, never as HTML", async () => {
    const { container } = await show({ ...REQUEST, purpose: "<img src=x onerror=alert(1)>" }, false);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
  });
});

describe("loadRequests", () => {
  const row = {
    id: ID,
    client_id: "user_client",
    document_id: DOC_ID,
    purpose: "A tender file.",
    status: "pending_review",
    consultation_id: null,
    decided_by: null,
    granted_at: null,
    expires_at: null,
    revoked_at: null,
    created_at: "2026-11-14 10:00:00+00",
    document: { title_ar: "خطاب شكر", title_en: "Thank-you letter", access_mode: "view" },
  };
  const rec = {
    id: "66666666-6666-4666-8666-666666666666",
    request_id: ID,
    member_id: "user_editor",
    recommendation: "approve",
    note: null,
    created_at: "2026-11-14 11:00:00+00",
  };
  const names = [
    { clerk_user_id: "user_client", full_name: "Test Client" },
    { clerk_user_id: "user_editor", full_name: "Editor" },
  ];
  const params = (extra: Record<string, unknown> = {}) => requestPageParamsSchema.parse(extra);

  function world(over: { requests?: unknown[]; searchClients?: unknown[]; searchDocs?: unknown[] } = {}) {
    const user = fakeClient((table, calls) => {
      if (table === "document_requests") {
        const rows = over.requests ?? [row];
        return calls.some((call) => call[0] === "maybeSingle")
          ? { data: rows[0] ?? null, error: null }
          : { data: rows, error: null, count: rows.length };
      }
      if (table === "document_recommendations") return { data: [rec], error: null };
      if (table === "documents") return { data: over.searchDocs ?? [], error: null };
      throw new Error(`unexpected ${table}`);
    });
    const service = fakeClient((table, calls) => {
      if (table !== "profiles") throw new Error(`the service client read ${table}`);
      const isSearch = calls.some((call: Call) => call[0] === "or");
      return isSearch ? { data: over.searchClients ?? [], error: null } : { data: names, error: null };
    });
    return { user, service, deps: { user: user.client, service: service.client } };
  }

  it("returns the contract's shape, with names and recommendations", async () => {
    const { deps } = world();
    const { requests, total } = await loadRequests(params(), deps);
    expect(total).toBe(1);
    expect(requests[0]).toEqual({
      ...REQUEST,
      recommendations: [
        {
          id: rec.id,
          memberId: "user_editor",
          memberName: "Editor",
          recommendation: "approve",
          note: null,
          createdAt: "2026-11-14T11:00:00.000Z",
        },
      ],
    });
  });

  it("reads the requests with the member's own client, filtered and paged", async () => {
    const { user, service, deps } = world();
    await loadRequests(params({ status: "in_contact", document: DOC_ID, page: "2", pageSize: "10" }), deps);
    const calls = callsOn(user.queries, "document_requests")[0];
    expect(calls).toContainEqual(["eq", "status", "in_contact"]);
    expect(calls).toContainEqual(["eq", "document_id", DOC_ID]);
    expect(calls).toContainEqual(["range", 10, 19]);
    // The service client only ever read names.
    expect(service.queries.every((query) => query.table === "profiles")).toBe(true);
  });

  it("matches a search on the client's name or the document's title", async () => {
    const { user, deps } = world({ searchClients: [{ clerk_user_id: "user_client" }], searchDocs: [{ id: DOC_ID }] });
    await loadRequests(params({ search: "letter" }), deps);
    const calls = callsOn(user.queries, "document_requests")[0];
    expect(calls).toContainEqual(["or", `client_id.in.("user_client"),document_id.in.("${DOC_ID}")`]);
  });

  it("reads every page of name matches, so no match is cut off", async () => {
    const first = Array.from({ length: 1000 }, (_, index) => ({ clerk_user_id: `user_${index}` }));
    const service = fakeClient((_table, calls) => {
      if (!calls.some((call) => call[0] === "or")) return { data: names, error: null };
      const range = calls.find((call) => call[0] === "range");
      return { data: range?.[1] === 0 ? first : [{ clerk_user_id: "user_last" }], error: null };
    });
    const { user } = world();
    await loadRequests(params({ search: "a" }), { user: user.client, service: service.client });
    const searches = service.queries.filter((query) => query.calls.some((call) => call[0] === "or"));
    expect(searches.map((query) => query.calls.find((call) => call[0] === "range"))).toEqual([
      ["range", 0, 999],
      ["range", 1000, 1999],
    ]);
    const filter = callsOn(user.queries, "document_requests")[0]?.find((call) => call[0] === "or");
    expect(String(filter?.[1])).toContain('"user_last"');
    expect(String(filter?.[1])).toContain('"user_999"');
  });

  it("reads no requests when the search matches nothing", async () => {
    const { user, deps } = world();
    expect(await loadRequests(params({ search: "nobody" }), deps)).toEqual({ requests: [], total: 0 });
    expect(callsOn(user.queries, "document_requests")).toHaveLength(0);
  });

  it("keeps a request whose document the member can't see, with blank titles", async () => {
    const { deps } = world({ requests: [{ ...row, document: null }] });
    const { requests } = await loadRequests(params(), deps);
    expect(requests[0]).toMatchObject({ documentTitleAr: "", documentTitleEn: "" });
  });

  it("leaves out a row the contract can't carry", async () => {
    const { deps } = world({ requests: [{ ...row, status: "rejected" }] });
    expect((await loadRequests(params(), deps)).requests).toEqual([]);
  });

  it("loads one request, or null", async () => {
    expect(await loadRequest(ID, world().deps)).toMatchObject({ id: ID, clientName: "Test Client" });
    expect(await loadRequest(ID, world({ requests: [] }).deps)).toBeNull();
  });
});
