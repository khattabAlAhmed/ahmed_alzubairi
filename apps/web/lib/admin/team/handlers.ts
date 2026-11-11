import {
  emailSchema,
  inviteTeamMemberRequestSchema,
  teamListParamsSchema,
  updateTeamMemberRequestSchema,
  type AdminTeamInvitation,
  type AdminTeamListResponse,
  type AdminTeamMember,
  type Locale,
  type OkResponse,
  type ProfileStatus,
  type TeamListParams,
} from "@repo/shared";
import { signUpPath } from "@/lib/auth/return-path";
import type { AuditEntry } from "../audit";
import { adminError, baseError, type AdminError } from "../permissions";
import { invitedRoleId, isGrantableRole, type RoleRef } from "./rules";

/**
 * The database, behind an interface so tests can replace it. Created only
 * after `requirePermission(team.manage)` passed. Reads use the user client, so
 * RLS scopes them; the two writes use the service client.
 */
export type TeamStore = {
  /** Profiles with a role, newest first. */
  listMembers: (
    params: TeamListParams,
  ) => Promise<{ members: AdminTeamMember[]; total: number }>;
  getRole: (id: string) => Promise<RoleRef | null>;
  /** Any profile the caller may read, or null. */
  getProfile: (
    id: string,
  ) => Promise<{ roleId: string | null; status: ProfileStatus } | null>;
  /** Both writes touch a profile only while it has a role. False when none did. */
  setRole: (id: string, roleId: string) => Promise<boolean>;
  setStatus: (id: string, status: ProfileStatus) => Promise<boolean>;
};

export type PendingInvitation = {
  email: string;
  publicMetadata: unknown;
  /** Unix time in milliseconds. */
  createdAt: number;
};

/** Clerk, behind an interface so tests can replace it. */
export type TeamClerk = {
  listPendingInvitations: () => Promise<PendingInvitation[]>;
  /** `exists`: the address already has an account or a pending invitation. */
  invite: (input: {
    email: string;
    roleId: string;
    redirectUrl: string;
  }) => Promise<{ ok: true; invitationId: string } | { ok: false; reason: "exists" }>;
  /** Signs the user out everywhere and refuses sign-in. */
  ban: (userId: string) => Promise<void>;
  unban: (userId: string) => Promise<void>;
};

export type TeamDeps = {
  locale: Locale;
  /** The acting user from the session. */
  userId: string;
  store: TeamStore;
  clerk: TeamClerk;
  audit: (entry: AuditEntry) => Promise<void>;
};

type Ok = { status: 200; body: OkResponse };

const OK: Ok = { status: 200, body: { ok: true } };

function teamInvitation(item: PendingInvitation): AdminTeamInvitation | null {
  const roleId = invitedRoleId(item.publicMetadata);
  const email = emailSchema.safeParse(item.email);
  if (!roleId || !email.success) return null;
  return {
    email: email.data,
    roleId,
    createdAt: new Date(item.createdAt).toISOString(),
  };
}

/**
 * `GET /api/admin/team`, after the permission check: the members, and the
 * Clerk invitations nobody has accepted yet. An invitation without a role id
 * isn't a team invitation and is left out.
 */
export async function listTeam(
  query: unknown,
  { locale, store, clerk }: Pick<TeamDeps, "locale" | "store" | "clerk">,
): Promise<{ status: 200; body: AdminTeamListResponse } | AdminError> {
  const params = teamListParamsSchema.safeParse(query);
  if (!params.success) return baseError("validation_failed", 400, locale);

  const [{ members, total }, pending] = await Promise.all([
    store.listMembers(params.data),
    clerk.listPendingInvitations(),
  ]);
  const invitations = pending
    .map(teamInvitation)
    .filter((item): item is AdminTeamInvitation => item !== null);
  return { status: 200, body: { members, total, invitations } };
}

/**
 * The role a request asks for, or the error to return. Admin is refused
 * whoever asks: no code path grants it (§6.19).
 */
async function grantableRole(
  roleId: string,
  { locale, store }: Pick<TeamDeps, "locale" | "store">,
): Promise<RoleRef | AdminError> {
  const role = await store.getRole(roleId);
  if (!role) {
    return adminError("validation_failed", 400, "teamRoleUnknown", locale);
  }
  if (!isGrantableRole(role)) {
    return adminError("forbidden", 403, "teamAdminRole", locale);
  }
  return role;
}

/**
 * `POST /api/admin/team`, after the permission check. Clerk sends the
 * invitation; the role id travels in its public metadata, and onboarding reads
 * it from there when the invited person creates their profile. `origin` is
 * this site's own origin, for the link in the email.
 */
export async function inviteMember(
  rawBody: unknown,
  origin: string,
  deps: TeamDeps,
): Promise<Ok | AdminError> {
  const { locale, userId, clerk } = deps;
  const body = inviteTeamMemberRequestSchema.safeParse(rawBody);
  if (!body.success) return baseError("validation_failed", 400, locale);

  const role = await grantableRole(body.data.roleId, deps);
  if ("status" in role) return role;

  const invitation = await clerk.invite({
    email: body.data.email,
    roleId: role.id,
    // Sign-up, then onboarding, then the dashboard.
    redirectUrl: `${origin}${signUpPath(locale, `/${locale}/dashboard`)}`,
  });
  if (!invitation.ok) {
    return adminError("conflict", 409, "teamInviteExists", locale);
  }

  // No profile exists yet, and the email stays out of the log.
  await deps.audit({
    actorId: userId,
    action: "team.invite",
    entity: "profiles",
    entityId: null,
    metadata: { roleId: role.id, invitationId: invitation.invitationId },
  });
  return OK;
}

/**
 * Writes the status, then tells Clerk. When Clerk fails, the status goes back
 * to what it was, so the two never disagree.
 */
async function changeStatus(
  id: string,
  from: ProfileStatus,
  to: ProfileStatus,
  { store, clerk }: Pick<TeamDeps, "store" | "clerk">,
): Promise<"done" | "gone" | "clerk_failed"> {
  if (!(await store.setStatus(id, to))) return "gone";
  try {
    if (to === "disabled") await clerk.ban(id);
    else await clerk.unban(id);
  } catch (error) {
    await store.setStatus(id, from);
    console.error(
      `team: Clerk ${to === "disabled" ? "ban" : "unban"} failed`,
      (error as { status?: unknown } | null)?.status ?? "error",
    );
    return "clerk_failed";
  }
  return "done";
}

/**
 * `PATCH /api/admin/team`, after the permission check: a member's role, their
 * status, or both. Refused: a change to yourself, the admin role, and a
 * profile with no role (a client becomes a member through an invitation only).
 */
export async function updateMember(
  rawBody: unknown,
  deps: TeamDeps,
): Promise<Ok | AdminError> {
  const { locale, userId, store } = deps;
  const body = updateTeamMemberRequestSchema.safeParse(rawBody);
  if (!body.success) return baseError("validation_failed", 400, locale);
  const { id, roleId, status } = body.data;

  if (id === userId) {
    return adminError("forbidden", 403, "teamSelfChange", locale);
  }

  const notFound = adminError("not_found", 404, "notFound", locale);
  const member = await store.getProfile(id);
  if (!member) return notFound;
  if (member.roleId === null) {
    return adminError("forbidden", 403, "teamNotMember", locale);
  }

  // Check the role before any write, so a refused role changes nothing.
  let newRoleId: string | null = null;
  if (roleId !== undefined && roleId !== member.roleId) {
    const role = await grantableRole(roleId, deps);
    if ("status" in role) return role;
    newRoleId = role.id;
  }

  if (status !== undefined && status !== member.status) {
    const outcome = await changeStatus(id, member.status, status, deps);
    if (outcome === "gone") return notFound;
    if (outcome === "clerk_failed") {
      return adminError("internal_error", 502, "teamSyncFailed", locale);
    }
    await deps.audit({
      actorId: userId,
      action: status === "disabled" ? "team.disable" : "team.enable",
      entity: "profiles",
      entityId: id,
    });
  }

  if (newRoleId !== null) {
    if (!(await store.setRole(id, newRoleId))) return notFound;
    await deps.audit({
      actorId: userId,
      action: "team.role_change",
      entity: "profiles",
      entityId: id,
      metadata: { from: member.roleId, to: newRoleId },
    });
  }
  return OK;
}
