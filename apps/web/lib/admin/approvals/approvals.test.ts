import { PERMISSIONS, type Permission } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import type { PermissionDeps } from "../permissions";
import {
  approvalColumns,
  setApproval,
  type ApprovalEntity,
  type ApprovalStore,
} from "./handlers";
import { handleApprovalRequest, type ApprovalRouteDeps } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const ID = "3f8a7c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b";
const ADMIN = "user_admin";

function store(status: string | null = "draft"): ApprovalStore {
  return {
    getStatus: vi.fn(async () => (status === null ? null : { status })),
    update: vi.fn(async () => status !== null),
    audit: vi.fn(async () => {}),
  };
}

function deps(s: ApprovalStore) {
  return { locale: "en" as const, userId: ADMIN, store: s, revalidate: vi.fn() };
}

describe("approvalColumns", () => {
  it("approving records the acting user", () => {
    expect(approvalColumns(true, ADMIN)).toEqual({
      admin_approved: true,
      approved_by: ADMIN,
    });
  });

  it("withdrawing clears the approver and drafts the row", () => {
    expect(approvalColumns(false, ADMIN)).toEqual({
      admin_approved: false,
      approved_by: null,
      status: "draft",
    });
  });
});

describe.each(["testimonials", "partners"] as const)(
  "setApproval on %s",
  (entity: ApprovalEntity) => {
    it("approves with approved_by from the session, audits and refreshes", async () => {
      const s = store("draft");
      const d = deps(s);
      const result = await setApproval(entity, ID, { approved: true }, d);
      expect(result).toEqual({ status: 200, body: { ok: true } });
      expect(s.update).toHaveBeenCalledWith(entity, ID, {
        admin_approved: true,
        approved_by: ADMIN,
      });
      expect(d.revalidate).toHaveBeenCalledWith(`content:${entity}`);
      expect(s.audit).toHaveBeenCalledWith({
        actorId: ADMIN,
        action: "approval.grant",
        entity,
        entityId: ID,
        metadata: { unpublished: false },
      });
    });

    it("withdrawing from a published row unpublishes it in the same write and refreshes its tag", async () => {
      const s = store("published");
      const d = deps(s);
      const result = await setApproval(entity, ID, { approved: false }, d);
      expect(result).toEqual({ status: 200, body: { ok: true } });
      expect(s.update).toHaveBeenCalledTimes(1);
      expect(s.update).toHaveBeenCalledWith(entity, ID, {
        admin_approved: false,
        approved_by: null,
        status: "draft",
      });
      expect(d.revalidate).toHaveBeenCalledWith(`content:${entity}`);
      expect(s.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "approval.withdraw",
          metadata: { unpublished: true },
        }),
      );
    });

    it.each([
      ["approved_by in the body", { approved: true, approved_by: "user_x" }],
      ["approvedBy in the body", { approved: true, approvedBy: "user_x" }],
      ["status in the body", { approved: true, status: "published" }],
      ["a string for approved", { approved: "true" }],
      ["no body", undefined],
    ])("refuses %s and writes nothing", async (_label, body) => {
      const s = store();
      const d = deps(s);
      const result = await setApproval(entity, ID, body, d);
      expect(result).toMatchObject({
        status: 400,
        body: { error: { code: "validation_failed" } },
      });
      expect(s.update).not.toHaveBeenCalled();
      expect(s.audit).not.toHaveBeenCalled();
      expect(d.revalidate).not.toHaveBeenCalled();
    });

    it("is not found for a missing row or a bad id", async () => {
      const missing = store(null);
      expect(
        await setApproval(entity, ID, { approved: true }, deps(missing)),
      ).toMatchObject({ status: 404, body: { error: { code: "not_found" } } });
      expect(missing.update).not.toHaveBeenCalled();

      const s = store();
      expect(
        await setApproval(entity, "not-a-uuid", { approved: true }, deps(s)),
      ).toMatchObject({ status: 404 });
      expect(s.getStatus).not.toHaveBeenCalled();
    });
  },
);

function routeDeps(userId: string | null, granted: Permission[]) {
  const permission: PermissionDeps = {
    getUserId: async () => userId,
    hasPermission: async (key) => granted.includes(key),
  };
  const created = store("published");
  return {
    permission,
    createStore: vi.fn(() => created),
    revalidate: vi.fn(),
    created,
  } satisfies ApprovalRouteDeps & { created: ApprovalStore };
}

const request = (body: unknown, locale = "en") =>
  new Request(`http://localhost/api/admin/testimonials/${ID}/approve`, {
    method: "PATCH",
    headers: { referer: `http://localhost/${locale}/dashboard` },
    body: JSON.stringify(body),
  });

describe.each(["testimonials", "partners"] as const)(
  "PATCH /api/admin/%s/:id/approve",
  (entity) => {
    it("signed out is 401, and no database client is created", async () => {
      const d = routeDeps(null, []);
      const response = await handleApprovalRequest(
        entity,
        request({ approved: true }),
        ID,
        d,
      );
      expect(response.status).toBe(401);
      expect(d.createStore).not.toHaveBeenCalled();
    });

    it("without testimonials.approve is 403, even with content.manage", async () => {
      const d = routeDeps("user_editor", [PERMISSIONS.CONTENT_MANAGE]);
      const response = await handleApprovalRequest(
        entity,
        request({ approved: true }, "ar"),
        ID,
        d,
      );
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("forbidden");
      expect(d.createStore).not.toHaveBeenCalled();
    });

    it("with testimonials.approve, approved_by is the session user", async () => {
      const d = routeDeps(ADMIN, [PERMISSIONS.TESTIMONIALS_APPROVE]);
      const response = await handleApprovalRequest(
        entity,
        request({ approved: true }),
        ID,
        d,
      );
      expect(response.status).toBe(200);
      expect(d.created.update).toHaveBeenCalledWith(entity, ID, {
        admin_approved: true,
        approved_by: ADMIN,
      });
    });
  },
);
