import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "./audit";
import { ADMIN_DELETE_TYPES } from "./content";
import { DOCUMENT_REQUEST_STATUSES, documentRequestStatusSchema } from "./enums";
import {
  consultationListParamsSchema,
  documentRequestListParamsSchema,
} from "./lists";
import {
  adminConsultationListSchema,
  adminDocumentRequestListSchema,
  DECIDE_DOCUMENT_REQUEST_DECISIONS,
  decideDocumentRequestSchema,
  DOCUMENT_DECISIONS,
} from "./routes-team";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const NOW = "2026-11-14T10:00:00.000Z";

describe("Phase 4 audit keys", () => {
  it.each([
    "consultation.status",
    "consultation.assign",
    "consultation.reply",
    "meeting.create",
    "meeting.update",
    "record.delete",
    "document.create",
    "document.update",
    "document_request.recommend",
    "document_request.grant",
    "document_request.contact_first",
    "document_request.revoke",
    "document.view",
    "document.download",
  ])("has the action %s", (action) => {
    expect(AUDIT_ACTIONS).toContain(action);
  });

  it.each(["consultations", "meetings", "documents", "document_requests"])(
    "has the entity %s",
    (entity) => {
      expect(AUDIT_ENTITIES).toContain(entity);
    },
  );

  it("can log a delete of every DELETE /api/admin/:type/:id type", () => {
    for (const type of ADMIN_DELETE_TYPES) expect(AUDIT_ENTITIES).toContain(type);
  });

  it("has no duplicate", () => {
    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length);
    expect(new Set(AUDIT_ENTITIES).size).toBe(AUDIT_ENTITIES.length);
  });
});

describe("no reject anywhere (§6.18, §9)", () => {
  it("has no rejected request status", () => {
    expect(DOCUMENT_REQUEST_STATUSES).toEqual([
      "pending_review",
      "in_contact",
      "granted",
      "expired",
      "revoked",
    ]);
    expect(documentRequestStatusSchema.safeParse("rejected").success).toBe(false);
  });

  it("has no reject decision, in the route or the function", () => {
    expect(DOCUMENT_DECISIONS).toEqual(["grant", "contact_first", "withdraw"]);
    expect(DECIDE_DOCUMENT_REQUEST_DECISIONS).toEqual(["grant", "contact_first"]);
    expect(decideDocumentRequestSchema.safeParse({ decision: "reject" }).success).toBe(false);
  });

  it("names no audit action after a rejection", () => {
    for (const action of AUDIT_ACTIONS) expect(action).not.toMatch(/reject/);
  });
});

describe("dashboard list params", () => {
  it("coerces the page and keeps the filters", () => {
    expect(
      consultationListParamsSchema.parse({ page: "2", status: "scheduled", kind: "document_request" }),
    ).toEqual({ page: 2, pageSize: 20, status: "scheduled", kind: "document_request" });
    expect(documentRequestListParamsSchema.parse({ status: "in_contact", search: " " })).toEqual({
      page: 1,
      pageSize: 20,
      status: "in_contact",
    });
  });

  it.each([
    [consultationListParamsSchema, { status: "rejected" }],
    [consultationListParamsSchema, { kind: "other" }],
    [documentRequestListParamsSchema, { status: "rejected" }],
    [documentRequestListParamsSchema, { pageSize: "101" }],
    [documentRequestListParamsSchema, { clientId: "user_x" }],
  ] as const)("refuses bad params %#", (schema, params) => {
    expect(schema.safeParse(params).success).toBe(false);
  });
});

describe("dashboard list rows", () => {
  const request = {
    id: ID,
    clientId: "user_client",
    clientName: "Client",
    documentId: ID,
    documentTitleAr: "خطاب",
    documentTitleEn: "Letter",
    documentAccessMode: "view",
    purpose: "Tender",
    status: "pending_review",
    consultationId: null,
    decidedBy: null,
    grantedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: NOW,
    recommendations: [
      {
        id: ID,
        memberId: "user_member",
        memberName: "Member",
        recommendation: "approve",
        note: null,
        createdAt: NOW,
      },
    ],
  };

  it("accepts a document request with its recommendations", () => {
    expect(adminDocumentRequestListSchema.safeParse({ requests: [request], total: 1 }).success).toBe(
      true,
    );
  });

  it.each([
    ["a storage key", { ...request, storageKey: "documents/x" }],
    ["a rejected status", { ...request, status: "rejected" }],
    ["a bad recommendation", { ...request, recommendations: [{ ...request.recommendations[0], recommendation: "reject" }] }],
  ])("refuses %s", (_label, row) => {
    expect(adminDocumentRequestListSchema.safeParse({ requests: [row], total: 1 }).success).toBe(
      false,
    );
  });

  it("needs a total on the consultation list", () => {
    expect(adminConsultationListSchema.safeParse({ consultations: [] }).success).toBe(false);
    expect(adminConsultationListSchema.safeParse({ consultations: [], total: 0 }).success).toBe(true);
  });
});
