import {
  disableAccountRequestSchema,
  type DisableAccountResponse,
  type Locale,
} from "@repo/shared";
import type { AuditEntry } from "@/lib/admin/audit";
import { setClerkBan, type ClerkBan } from "@/lib/admin/clients/clerk-ban";
import type { ClientStore } from "@/lib/admin/clients/handlers";
import { baseFail, ownFail, type ProfileResult } from "./update";

export type DisableAccountDeps = {
  /** The signed-in user from the session, or null. */
  userId: string | null;
  locale: Locale;
  readBody: () => Promise<unknown>;
  /** The client store from P3T-T07: the caller's own row, `disable_client`, the status write. */
  store: Pick<ClientStore, "getProfile" | "disableClient" | "setStatus">;
  clerk: ClerkBan;
  audit: (entry: AuditEntry) => Promise<void>;
};

/**
 * `POST /api/account/disable`: a client disables their own account (§6.16).
 * `disable_client` closes their open consultations, then Clerk bans them,
 * which also ends every session. When Clerk doesn't take the ban, the status
 * goes back and nothing else changes. A team member is refused: the admin
 * handles team accounts in Team.
 */
export async function disableAccount(
  deps: DisableAccountDeps,
): Promise<ProfileResult<DisableAccountResponse>> {
  const { userId, locale, store, clerk } = deps;
  if (!userId) return baseFail("unauthenticated", 401, locale);

  const body = disableAccountRequestSchema.safeParse(await deps.readBody().catch(() => undefined));
  if (!body.success) return baseFail("validation_failed", 400, locale);

  const teamMember = ownFail("forbidden", 403, "teamMember", locale);
  const profile = await store.getProfile(userId);
  if (!profile) return ownFail("not_found", 404, "noProfile", locale);
  if (profile.isMember) return teamMember;

  const closed = await store.disableClient(userId);
  // The profile was given a role since the read above.
  if (closed === null) return teamMember;

  const outcome = await setClerkBan(userId, true, clerk);
  if (outcome !== "done") {
    let restored = false;
    try {
      // Consultations that were closed stay closed (§6.16).
      await store.setStatus(userId, "disabled", profile.status);
      restored = true;
    } finally {
      // Clerk may hold the ban although it couldn't say so. Set it to what
      // the profile holds now: active once it's back, or what a fresh read
      // says if the write failed. If that read fails too, Clerk is left as it
      // is; the admin can reactivate from the dashboard, which sets both.
      if (outcome === "unknown") {
        const now = restored
          ? profile.status
          : (await store.getProfile(userId).catch(() => null))?.status;
        if (now) await setClerkBan(userId, now === "disabled", clerk);
      }
    }
    return ownFail("internal_error", 502, "disableFailed", locale);
  }

  await deps.audit({
    actorId: userId,
    action: "account.disable",
    entity: "profiles",
    entityId: userId,
    metadata: { closedConsultations: closed },
  });
  return { status: 200, body: { ok: true, closedConsultations: closed } };
}
