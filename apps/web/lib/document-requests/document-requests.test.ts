import { PERMISSIONS, type DocumentRequestStatus, type Permission } from "@repo/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "@/lib/admin/audit";
import type { PermissionDeps } from "@/lib/admin/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import ar from "@/messages/ar/DocumentRequestErrors.json";
import en from "@/messages/en/DocumentRequestErrors.json";
import { DOCUMENT_JOBS, expireDocumentGrants } from "../cron/document-jobs";
import { DocumentRequestError, fromSqlError, requestError } from "./errors";
import type {
  DocumentRequestStore,
  QueueEmail,
  QueueEmailForPermission,
  Recipient,
  RequestInfo,
  RequestedRow,
} from "./handlers";
import {
  handleCreateDocumentRequests,
  handleDecide,
  handleRecommend,
  type DocumentRequestRouteDeps,
} from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/email/queue", () => ({ queueEmail: vi.fn(), queueEmailForPermission: vi.fn() }));

const DOC_1 = "123e4567-e89b-42d3-a456-426614174001";
const DOC_2 = "123e4567-e89b-42d3-a456-426614174002";
const REQ_1 = "223e4567-e89b-42d3-a456-426614174001";
const REQ_2 = "223e4567-e89b-42d3-a456-426614174002";
const CONSULT = "323e4567-e89b-42d3-a456-426614174001";
const TITLES = {
  [DOC_1]: { ar: "شهادة", en: "Certificate" },
  [DOC_2]: { ar: "خطاب", en: "Letter" },
};

const admin: Recipient = { userId: "user_admin", email: "admin@example.invalid", locale: "ar" };
const recommender: Recipient = { userId: "user_rec", email: "rec@example.invalid", locale: "en" };

function info(status: DocumentRequestStatus): RequestInfo {
  return {
    id: REQ_1,
    status,
    documentTitle: TITLES[DOC_1],
    client: {
      userId: "user_client",
      fullName: "Client Name",
      email: "client@example.invalid",
      locale: "en",
    },
  };
}

function memoryStore(overrides: Partial<DocumentRequestStore> = {}) {
  return {
    ownProfile: vi.fn(async () => ({ fullName: "Client Name" })),
    request: vi.fn(
      async (_client: string, ids: string[]): Promise<RequestedRow[]> =>
        ids.map((documentId, i) => ({
          requestId: [REQ_1, REQ_2][i] ?? REQ_1,
          documentId,
          status: "pending_review",
          merged: false,
        })),
    ),
    documentTitles: vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, TITLES[id as keyof typeof TITLES]]))),
    membersWith: vi.fn(async () => [admin, recommender]),
    notify: vi.fn(async () => {}),
    requestInfo: vi.fn(async () => info("pending_review")),
    memberName: vi.fn(async () => "Member Name"),
    addRecommendation: vi.fn(async () => {}),
    decide: vi.fn(async () => ({ consultationId: null as string | null })),
    revoke: vi.fn(async () => {}),
    ...overrides,
  } satisfies DocumentRequestStore;
}

function routeDeps(
  userId: string | null,
  granted: Permission[] = [],
  store = memoryStore(),
) {
  const permission: PermissionDeps = {
    getUserId: async () => userId,
    hasPermission: async (key) => granted.includes(key),
  };
  const queueEmail = vi.fn<QueueEmail>(async () => true);
  const queueEmailForPermission = vi.fn<QueueEmailForPermission>(async () => true);
  return {
    getUserId: async () => userId,
    permission,
    createStore: vi.fn(() => store),
    audit: vi.fn<(entry: AuditEntry) => Promise<void>>(async () => {}),
    queueEmail,
    queueEmailForPermission,
    store,
  } satisfies DocumentRequestRouteDeps & { store: unknown };
}

const post = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { referer: "http://localhost/en/documents" },
    body: JSON.stringify(body),
  });

const json = async (response: Response) => [response.status, await response.json()] as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/document-requests", () => {
  const body = { documentIds: [DOC_1, DOC_2], purpose: "For a tender" };

  it("refuses a signed-out caller (401) without touching the database", async () => {
    const d = routeDeps(null);
    const [status] = await json(await handleCreateDocumentRequests(post("/api/document-requests", body), d));
    expect(status).toBe(401);
    expect(d.createStore).not.toHaveBeenCalled();
  });

  it("refuses a user with no profile yet (422), before any request", async () => {
    const d = routeDeps("user_new", [], memoryStore({ ownProfile: vi.fn(async () => null) }));
    const [status, answer] = await json(await handleCreateDocumentRequests(post("/api/document-requests", body), d));
    expect(status).toBe(422);
    expect(answer.error).toEqual({ code: "profile_incomplete", message: en.profileIncomplete });
    expect(d.store.request).not.toHaveBeenCalled();
  });

  it("refuses a team member (403) when the function says not_a_client", async () => {
    const store = memoryStore({
      request: vi.fn(async () => {
        throw new DocumentRequestError(requestError("forbidden", 403, "notAClient", "en"));
      }),
    });
    const d = routeDeps("user_admin", [], store);
    const [status, answer] = await json(await handleCreateDocumentRequests(post("/api/document-requests", body), d));
    expect(status).toBe(403);
    expect(answer.error.message).toBe(en.notAClient);
    expect(d.queueEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["no documents", { documentIds: [], purpose: "x" }],
    ["a bad id", { documentIds: ["1"], purpose: "x" }],
    ["no purpose", { documentIds: [DOC_1] }],
    ["an extra field", { ...body, clientId: "user_other" }],
  ])("refuses %s (400)", async (_label, bad) => {
    const d = routeDeps("user_client");
    expect((await handleCreateDocumentRequests(post("/api/document-requests", bad), d)).status).toBe(400);
    expect(d.store.request).not.toHaveBeenCalled();
  });

  it("requests for the caller only, and emails the admin and the recommender once per new row", async () => {
    const d = routeDeps("user_client");
    const [status, answer] = await json(await handleCreateDocumentRequests(post("/api/document-requests", body), d));
    expect(status).toBe(200);
    expect(answer).toEqual({ requestIds: [REQ_1, REQ_2] });
    expect(d.store.request).toHaveBeenCalledWith("user_client", [DOC_1, DOC_2], "For a tender");
    expect(d.store.membersWith).toHaveBeenCalledWith([
      PERMISSIONS.TEAM_MANAGE,
      PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND,
    ]);
    expect(d.queueEmail.mock.calls.map(([call]) => [call.to.email, call.payload])).toEqual([
      ["admin@example.invalid", { documentTitle: TITLES[DOC_1], clientName: "Client Name" }],
      ["rec@example.invalid", { documentTitle: TITLES[DOC_1], clientName: "Client Name" }],
      ["admin@example.invalid", { documentTitle: TITLES[DOC_2], clientName: "Client Name" }],
      ["rec@example.invalid", { documentTitle: TITLES[DOC_2], clientName: "Client Name" }],
    ]);
    expect(d.queueEmail.mock.calls.every(([call]) => call.event === "document_request")).toBe(true);
    expect(vi.mocked(d.store.notify).mock.calls).toEqual([
      [["user_admin", "user_rec"], "document_request", REQ_1],
      [["user_admin", "user_rec"], "document_request", REQ_2],
    ]);
  });

  it("a duplicate merges into the open request: same id back, no new email", async () => {
    const store = memoryStore({
      request: vi.fn(async () => [
        { requestId: REQ_1, documentId: DOC_1, status: "pending_review" as const, merged: true },
      ]),
    });
    const d = routeDeps("user_client", [], store);
    const [status, answer] = await json(
      await handleCreateDocumentRequests(post("/api/document-requests", { documentIds: [DOC_1], purpose: "Again" }), d),
    );
    expect(status).toBe(200);
    expect(answer).toEqual({ requestIds: [REQ_1] });
    expect(d.queueEmail).not.toHaveBeenCalled();
    expect(d.store.notify).not.toHaveBeenCalled();
  });

  it("a failed notification for one request doesn't skip the next one", async () => {
    const store = memoryStore();
    vi.mocked(store.notify).mockRejectedValueOnce(new Error("notifications insert failed: 57014"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const d = routeDeps("user_client", [], store);
    expect((await handleCreateDocumentRequests(post("/api/document-requests", body), d)).status).toBe(200);
    // The second request still gets its emails and its notifications.
    expect(
      d.queueEmail.mock.calls.map(([call]) => (call.payload as { documentTitle: unknown }).documentTitle),
    ).toEqual([
      TITLES[DOC_1], TITLES[DOC_1], TITLES[DOC_2], TITLES[DOC_2],
    ]);
    expect(store.notify).toHaveBeenCalledTimes(2);
    expect(vi.mocked(store.notify).mock.calls[1]?.[2]).toBe(REQ_2);
  });

  it("still answers 200 when the emails can't be queued", async () => {
    const store = memoryStore({ membersWith: vi.fn(async () => { throw new Error("db down"); }) });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const d = routeDeps("user_client", [], store);
    expect((await handleCreateDocumentRequests(post("/api/document-requests", body), d)).status).toBe(200);
  });

  it("an unpublished document is a 404 with the user's text", async () => {
    const store = memoryStore({
      request: vi.fn(async () => {
        throw new DocumentRequestError(fromSqlError({ message: "document_unavailable" }, "ar")!);
      }),
    });
    const d = routeDeps("user_client", [], store);
    const [status, answer] = await json(await handleCreateDocumentRequests(post("/api/document-requests", body), d));
    expect(status).toBe(404);
    expect(answer.error.message).toBe(ar.documentUnavailable);
  });
});

describe("POST /api/admin/document-requests/:id/recommend", () => {
  const body = { recommendation: "approve", note: "Looks right" };
  const recommend = (d: ReturnType<typeof routeDeps>, id: unknown = REQ_1, b: unknown = body) =>
    handleRecommend(post(`/api/admin/document-requests/${String(id)}/recommend`, b), id, d);

  it("refuses a signed-out caller (401) and a client (403)", async () => {
    expect((await recommend(routeDeps(null))).status).toBe(401);
    const client = routeDeps("user_client", []);
    expect((await recommend(client)).status).toBe(403);
    expect(client.createStore).not.toHaveBeenCalled();
  });

  it("refuses a member who can only decide (403): recommending is its own permission", async () => {
    const d = routeDeps("user_decider", [PERMISSIONS.DOCUMENT_REQUESTS_DECIDE]);
    expect((await recommend(d)).status).toBe(403);
    expect(d.store.addRecommendation).not.toHaveBeenCalled();
  });

  it("saves the recommendation, audits it and emails the admin", async () => {
    const d = routeDeps("user_rec", [PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND]);
    const [status, answer] = await json(await recommend(d));
    expect([status, answer]).toEqual([200, { ok: true }]);
    expect(d.store.addRecommendation).toHaveBeenCalledWith({
      requestId: REQ_1,
      memberId: "user_rec",
      recommendation: "approve",
      note: "Looks right",
    });
    expect(d.audit).toHaveBeenCalledWith({
      actorId: "user_rec",
      action: "document_request.recommend",
      entity: "document_requests",
      entityId: REQ_1,
      metadata: { recommendation: "approve" },
    });
    expect(d.queueEmailForPermission).toHaveBeenCalledWith(
      "document_recommendation",
      PERMISSIONS.TEAM_MANAGE,
      { documentTitle: TITLES[DOC_1], memberName: "Member Name" },
      { entity: "document_requests", entityId: REQ_1 },
    );
    expect(JSON.stringify(d.audit.mock.calls)).not.toContain("Looks right");
  });

  it("keeps a recommendation that lands just after a decision, but doesn't email the admin about it", async () => {
    const requestInfo = vi
      .fn<() => Promise<RequestInfo>>()
      .mockResolvedValueOnce(info("pending_review"))
      .mockResolvedValueOnce(info("granted"));
    const d = routeDeps("user_rec", [PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND], memoryStore({ requestInfo }));
    expect((await recommend(d)).status).toBe(200);
    expect(d.store.addRecommendation).toHaveBeenCalled();
    expect(d.queueEmailForPermission).not.toHaveBeenCalled();
  });

  it.each(["granted", "expired", "revoked"] as const)("refuses a %s request (409)", async (status) => {
    const d = routeDeps("user_rec", [PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND], memoryStore({
      requestInfo: vi.fn(async () => info(status)),
    }));
    expect((await recommend(d)).status).toBe(409);
    expect(d.store.addRecommendation).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing request", REQ_2, body, 404],
    ["a bad id", "1", body, 400],
    ["a reject recommendation", REQ_1, { recommendation: "reject" }, 400],
  ])("refuses %s", async (_label, id, b, expected) => {
    const store = memoryStore({ requestInfo: vi.fn(async (rid: string) => (rid === REQ_1 ? info("pending_review") : null)) });
    const d = routeDeps("user_rec", [PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND], store);
    expect((await recommend(d, id, b)).status).toBe(expected);
  });
});

describe("POST /api/admin/document-requests/:id/decide", () => {
  const decide = (d: ReturnType<typeof routeDeps>, b: unknown, id: unknown = REQ_1) =>
    handleDecide(post(`/api/admin/document-requests/${String(id)}/decide`, b), id, d);
  const decider = (store = memoryStore()) =>
    routeDeps("user_admin", [PERMISSIONS.DOCUMENT_REQUESTS_DECIDE], store);

  it("refuses a signed-out caller (401), a client (403) and a recommend-only member (403)", async () => {
    expect((await decide(routeDeps(null), { decision: "grant" })).status).toBe(401);
    expect((await decide(routeDeps("user_client"), { decision: "grant" })).status).toBe(403);
    const rec = routeDeps("user_rec", [PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND, PERMISSIONS.TEAM_MANAGE]);
    expect((await decide(rec, { decision: "grant" })).status).toBe(403);
    expect(rec.store.decide).not.toHaveBeenCalled();
  });

  it.each([
    ["reject", { decision: "reject" }],
    ["refuse", { decision: "refuse" }],
    ["deny", { decision: "deny" }],
    ["no decision", {}],
    ["a past expiry", { decision: "grant", expiresAt: "2020-01-01T00:00:00.000Z" }],
    ["an expiry on contact_first", { decision: "contact_first", expiresAt: "2999-01-01T00:00:00.000Z" }],
  ])("refuses %s (400) and decides nothing", async (_label, b) => {
    const d = decider();
    expect((await decide(d, b)).status).toBe(400);
    expect(d.store.decide).not.toHaveBeenCalled();
    expect(d.store.revoke).not.toHaveBeenCalled();
  });

  it("grant: decides as the caller, audits, and emails the client in their language", async () => {
    const d = decider();
    const [status] = await json(await decide(d, { decision: "grant", expiresAt: "2999-01-01T00:00:00.000Z" }));
    expect(status).toBe(200);
    expect(d.store.decide).toHaveBeenCalledWith(REQ_1, "user_admin", "grant", "2999-01-01T00:00:00.000Z");
    expect(d.audit).toHaveBeenCalledWith({
      actorId: "user_admin",
      action: "document_request.grant",
      entity: "document_requests",
      entityId: REQ_1,
      metadata: { expires: true },
    });
    expect(d.queueEmail).toHaveBeenCalledWith({
      event: "document_granted",
      to: info("pending_review").client,
      payload: { documentTitle: TITLES[DOC_1] },
    });
  });

  it("grant: the client's email is queued even when the audit write then fails", async () => {
    const d = decider();
    d.audit.mockRejectedValueOnce(new Error("audit_log insert failed: 57014"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await decide(d, { decision: "grant" })).status).toBe(500);
    expect(d.queueEmail).toHaveBeenCalledWith(expect.objectContaining({ event: "document_granted" }));
  });

  it("grant without an expiry passes null", async () => {
    const d = decider();
    await decide(d, { decision: "grant" });
    expect(d.store.decide).toHaveBeenCalledWith(REQ_1, "user_admin", "grant", null);
    expect(d.audit.mock.calls[0]?.[0].metadata).toEqual({ expires: false });
  });

  it("contact_first: decides, audits the consultation, and sends no email or message", async () => {
    const d = decider(memoryStore({ decide: vi.fn(async () => ({ consultationId: CONSULT })) }));
    const [status] = await json(await decide(d, { decision: "contact_first" }));
    expect(status).toBe(200);
    expect(d.store.decide).toHaveBeenCalledWith(REQ_1, "user_admin", "contact_first", null);
    expect(d.audit).toHaveBeenCalledWith({
      actorId: "user_admin",
      action: "document_request.contact_first",
      entity: "document_requests",
      entityId: REQ_1,
      metadata: { consultationId: CONSULT },
    });
    expect(d.queueEmail).not.toHaveBeenCalled();
    expect(d.queueEmailForPermission).not.toHaveBeenCalled();
  });

  it("withdraw: revokes and audits, with no email", async () => {
    const d = decider();
    const [status] = await json(await decide(d, { decision: "withdraw" }));
    expect(status).toBe(200);
    expect(d.store.revoke).toHaveBeenCalledWith(REQ_1, "user_admin");
    expect(d.store.decide).not.toHaveBeenCalled();
    expect(d.audit.mock.calls[0]?.[0]).toMatchObject({ action: "document_request.revoke", entityId: REQ_1 });
    expect(d.queueEmail).not.toHaveBeenCalled();
  });

  it("withdraw works only on a granted request: the function's refusal is a 409", async () => {
    const d = decider(memoryStore({
      revoke: vi.fn(async () => {
        throw new DocumentRequestError(fromSqlError({ code: "55000", message: "request_not_granted" }, "en")!);
      }),
    }));
    const [status, answer] = await json(await decide(d, { decision: "withdraw" }));
    expect(status).toBe(409);
    expect(answer.error).toEqual({ code: "conflict", message: en.requestNotGranted });
    expect(d.audit).not.toHaveBeenCalled();
  });

  it("deciding a request that's already decided is a 409, with no audit or email", async () => {
    const d = decider(memoryStore({
      decide: vi.fn(async () => {
        throw new DocumentRequestError(fromSqlError({ code: "55000", message: "request_not_open" }, "en")!);
      }),
    }));
    expect((await decide(d, { decision: "grant" })).status).toBe(409);
    expect(d.audit).not.toHaveBeenCalled();
    expect(d.queueEmail).not.toHaveBeenCalled();
  });

  it("an unexpected database error is a 500 that leaks nothing", async () => {
    const d = decider(memoryStore({ decide: vi.fn(async () => { throw new Error("decide failed: XX000"); }) }));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await decide(d, { decision: "grant" });
    expect(response.status).toBe(500);
    expect(JSON.stringify(logged.mock.calls)).not.toContain("user_admin");
  });
});

describe("fromSqlError", () => {
  it.each([
    ["not_a_client", 403, "notAClient"],
    ["not_allowed", 403, "notAllowed"],
    ["document_unavailable", 404, "documentUnavailable"],
    ["request_not_found", 404, "requestNotFound"],
    ["request_not_open", 409, "requestNotOpen"],
    ["request_not_granted", 409, "requestNotGranted"],
    ["expiry_in_past", 400, "expiryInPast"],
  ] as const)("maps %s to %i", (message, status, key) => {
    expect(fromSqlError({ message }, "en")).toMatchObject({ status, body: { error: { message: en[key] } } });
  });

  it("returns null for anything else, so the route answers 500", () => {
    expect(fromSqlError({ code: "23505", message: "duplicate key value" }, "en")).toBeNull();
    expect(fromSqlError(null, "en")).toBeNull();
  });
});

describe("expireDocumentGrants (hourly)", () => {
  it("is in the document jobs, by name", () => {
    expect(DOCUMENT_JOBS.map((job) => job.name)).toContain("expireDocumentGrants");
  });

  it("calls expire_document_grants", async () => {
    const rpc = vi.fn(async () => ({ data: 2, error: null }));
    vi.mocked(createServiceClient).mockReturnValue({ rpc } as never);
    await expireDocumentGrants();
    expect(rpc).toHaveBeenCalledWith("expire_document_grants");
  });

  it("throws the code only when the call fails", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "57014", message: "row data here" } }));
    vi.mocked(createServiceClient).mockReturnValue({ rpc } as never);
    await expect(expireDocumentGrants()).rejects.toThrow("expire_document_grants failed (57014)");
    await expect(expireDocumentGrants()).rejects.not.toThrow(/row data/);
  });
});

describe("DocumentRequestErrors messages", () => {
  it("has the same keys in Arabic and English", () => {
    expect(Object.keys(ar).toSorted()).toEqual(Object.keys(en).toSorted());
  });
});
