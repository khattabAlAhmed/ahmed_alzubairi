import {
  clientListParamsSchema,
  updateClientRequestSchema,
  type AdminClient,
  type AdminClientListResponse,
  type ClientListParams,
  type Locale,
  type OkResponse,
  type ProfileStatus,
} from "@repo/shared";
import type { AuditEntry } from "../audit";
import { adminError, baseError, type AdminError } from "../permissions";
import { setClerkBan, type ClerkBan } from "./clerk-ban";

/**
 * The database, behind an interface so tests can replace it. Reads use the
 * user client, so RLS scopes them (§5, §9). The writes use the service client,
 * and only after `requirePermission(clients.view_all)` passed.
 */
export type ClientStore = {
  /** True when the caller's own profile has a role and is active. */
  isActiveMember: (userId: string) => Promise<boolean>;
  /** The client profiles RLS lets the caller see, newest first. */
  listClients: (
    params: ClientListParams,
  ) => Promise<{ clients: AdminClient[]; total: number }>;
  /** Any profile the caller may read, or null. */
  getProfile: (
    id: string,
  ) => Promise<{ isMember: boolean; status: ProfileStatus } | null>;
  /**
   * `disable_client`: disables the client and closes their open consultations
   * in one transaction. The number closed, or null when the id isn't a client.
   */
  disableClient: (id: string) => Promise<number | null>;
  /**
   * Changes the status only while it is still `from`, and only on a profile
   * with no role. False when nothing was written.
   */
  setStatus: (
    id: string,
    from: ProfileStatus,
    to: ProfileStatus,
  ) => Promise<boolean>;
};

export type ClientDeps = {
  locale: Locale;
  /** The acting user from the session. */
  userId: string;
  store: ClientStore;
  clerk: ClerkBan;
  audit: (entry: AuditEntry) => Promise<void>;
};

type Ok = { status: 200; body: OkResponse };

const OK: Ok = { status: 200, body: { ok: true } };

/**
 * `GET /api/admin/clients`, for a signed-in caller. Any active team member may
 * ask; RLS decides which clients come back: all of them with
 * `clients.view_all`, the scoped ones (§5) otherwise, which may be none.
 */
export async function listClients(
  query: unknown,
  { locale, userId, store }: Pick<ClientDeps, "locale" | "userId" | "store">,
): Promise<{ status: 200; body: AdminClientListResponse } | AdminError> {
  if (!(await store.isActiveMember(userId))) {
    return adminError("forbidden", 403, "forbidden", locale);
  }
  const params = clientListParamsSchema.safeParse(query);
  if (!params.success) return baseError("validation_failed", 400, locale);

  return { status: 200, body: await store.listClients(params.data) };
}

/**
 * `PATCH /api/admin/clients`, after the `clients.view_all` check: disable a
 * client or reactivate one (§6.16). The database changes first, then Clerk.
 * When Clerk refuses, the status goes back and the request fails, so the two
 * agree when this returns. A profile with a role is refused: the team route
 * handles team members.
 */
export async function updateClient(
  rawBody: unknown,
  { locale, userId, store, clerk, audit }: ClientDeps,
): Promise<Ok | AdminError> {
  const body = updateClientRequestSchema.safeParse(rawBody);
  if (!body.success) return baseError("validation_failed", 400, locale);
  const { id, status } = body.data;

  const notFound = adminError("not_found", 404, "notFound", locale);
  const profile = await store.getProfile(id);
  if (!profile) return notFound;
  if (profile.isMember) {
    return adminError("forbidden", 403, "clientIsMember", locale);
  }
  // Already as asked: no write and no audit row.
  if (profile.status === status) return OK;

  let closed = 0;
  if (status === "disabled") {
    const count = await store.disableClient(id);
    // The profile was given a role since the read above.
    if (count === null) return notFound;
    closed = count;
  } else if (!(await store.setStatus(id, "disabled", "active"))) {
    return adminError("conflict", 409, "clientChangedMeanwhile", locale);
  }

  if (!(await setClerkBan(id, status === "disabled", clerk))) {
    // Consultations that the disable closed stay closed: their earlier
    // statuses aren't kept, and a closed consultation is never lost (§6.16).
    await store.setStatus(id, status, profile.status);
    return adminError("internal_error", 502, "clientSyncFailed", locale);
  }

  // Another request may have changed the status while Clerk was answering.
  // The profile decides: Clerk is set to match what it says now.
  const current = await store.getProfile(id);
  if (current && current.status !== status) {
    await setClerkBan(id, current.status === "disabled", clerk);
  }

  await audit(
    status === "disabled"
      ? {
          actorId: userId,
          action: "client.disable",
          entity: "profiles",
          entityId: id,
          metadata: { closedConsultations: closed },
        }
      : {
          actorId: userId,
          action: "client.enable",
          entity: "profiles",
          entityId: id,
        },
  );
  return OK;
}
