import { clerkUserUpdatedEventSchema } from "@repo/shared";

/** The only columns the webhook writes. Never `role_id`, `status` or the key. */
export type ProfileSync = { full_name?: string; email?: string };

export type EventTarget =
  | { kind: "ignored" }
  | { kind: "invalid" }
  | { kind: "user"; userId: string };

/**
 * Whose profile a verified Clerk event is about. Only `user.updated` counts:
 * no profile exists at `user.created`, and onboarding reads Clerk itself.
 *
 * Only the user id leaves the event. Clerk can deliver an older event after a
 * newer one, so the name and email are read from Clerk when the event arrives,
 * never from the event.
 */
export function userFromEvent(event: { type?: unknown; data?: unknown }): EventTarget {
  if (event.type !== "user.updated") return { kind: "ignored" };
  const parsed = clerkUserUpdatedEventSchema.safeParse(event);
  if (!parsed.success) return { kind: "invalid" };
  return { kind: "user", userId: parsed.data.data.id };
}

/** The part of Clerk's user we read. */
export type ClerkUserIdentity = {
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
};

/**
 * What Clerk's user sets on the profile. A name is skipped when Clerk has
 * none, and an email when the user has no primary address: both columns are
 * required, so we keep what we have. Null when there is nothing to write.
 */
export function profileValues(user: ClerkUserIdentity): ProfileSync | null {
  const values: ProfileSync = {};
  const fullName = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (fullName) values.full_name = fullName;

  const email = user.primaryEmailAddress?.emailAddress;
  if (email) values.email = email;

  return Object.keys(values).length > 0 ? values : null;
}
