import "server-only";
import { clerkClient } from "@clerk/nextjs/server";

/** Clerk's ban calls, behind an interface so tests can replace them. */
export type ClerkBan = {
  /** Signs the user out everywhere and refuses sign-in. */
  ban: (userId: string) => Promise<void>;
  unban: (userId: string) => Promise<void>;
  isBanned: (userId: string) => Promise<boolean>;
};

/** The Clerk Backend API calls that disable and reactivate an account (§6.16). */
export function createClerkBan(): ClerkBan {
  return {
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

/**
 * Bans or unbans the user. True when Clerk now holds `banned`. A failed call
 * may still have reached Clerk although its answer didn't reach us, so Clerk
 * is asked what it holds before the caller undoes anything. False: Clerk
 * doesn't hold `banned`, or couldn't say.
 */
export async function setClerkBan(
  userId: string,
  banned: boolean,
  clerk: ClerkBan,
): Promise<boolean> {
  try {
    await (banned ? clerk.ban(userId) : clerk.unban(userId));
    return true;
  } catch (error) {
    const held = await clerk.isBanned(userId).catch(() => null);
    if (held === banned) return true;
    // The status only: Clerk's error text can carry an email.
    console.error(
      `Clerk ${banned ? "ban" : "unban"} failed`,
      (error as { status?: unknown } | null)?.status ?? "error",
    );
    return false;
  }
}
