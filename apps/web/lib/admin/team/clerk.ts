import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import type { TeamClerk } from "./handlers";
import { INVITED_ROLE_METADATA_KEY } from "./rules";

/** Clerk's page limit. Pending team invitations stay far below it. */
const MAX_INVITATIONS = 500;

/** Clerk's codes for "this address is already a user or already invited". */
const EXISTS_CODES = ["duplicate_record", "form_identifier_exists"];

/** True for a Clerk API error that says the address is already taken. */
export function isExistingAddressError(error: unknown): boolean {
  const errors = (error as { errors?: unknown } | null)?.errors;
  return (
    Array.isArray(errors) &&
    errors.some((item: { code?: unknown } | null) =>
      EXISTS_CODES.includes(String(item?.code)),
    )
  );
}

/** The Clerk Backend API calls the team routes make. */
export function createTeamClerk(): TeamClerk {
  return {
    async listPendingInvitations() {
      const clerk = await clerkClient();
      const { data } = await clerk.invitations.getInvitationList({
        status: "pending",
        limit: MAX_INVITATIONS,
      });
      return data.map((item) => ({
        email: item.emailAddress,
        publicMetadata: item.publicMetadata,
        createdAt: item.createdAt,
      }));
    },

    async invite({ email, roleId, redirectUrl }) {
      const clerk = await clerkClient();
      try {
        const invitation = await clerk.invitations.createInvitation({
          emailAddress: email,
          redirectUrl,
          publicMetadata: { [INVITED_ROLE_METADATA_KEY]: roleId },
        });
        return { ok: true, invitationId: invitation.id };
      } catch (error) {
        if (isExistingAddressError(error)) return { ok: false, reason: "exists" };
        throw error;
      }
    },

    async ban(userId) {
      await (await clerkClient()).users.banUser(userId);
    },

    async unban(userId) {
      await (await clerkClient()).users.unbanUser(userId);
    },

    async isBanned(userId) {
      return (await (await clerkClient()).users.getUser(userId)).banned;
    },
  };
}
