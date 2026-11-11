import { clerkUserUpdatedEventSchema } from "@repo/shared";

/** The only columns the webhook writes. Never `role_id`, `status` or the key. */
export type ProfileSync = { full_name?: string; email?: string };

export type SyncPlan =
  | { kind: "ignored" }
  | { kind: "invalid" }
  | { kind: "update"; userId: string; values: ProfileSync };

/**
 * What a verified Clerk event changes on a profile. Only `user.updated` counts:
 * no profile exists at `user.created`, and onboarding reads Clerk itself.
 *
 * The values come from the event alone, so the same event always gives the
 * same row. A name is skipped when Clerk has none, and an email when the user
 * has no primary address: both columns are required, so we keep what we have.
 */
export function planProfileSync(event: { type?: unknown; data?: unknown }): SyncPlan {
  if (event.type !== "user.updated") return { kind: "ignored" };

  const parsed = clerkUserUpdatedEventSchema.safeParse(event);
  if (!parsed.success) return { kind: "invalid" };
  const user = parsed.data.data;

  const values: ProfileSync = {};
  const fullName = [user.first_name, user.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (fullName) values.full_name = fullName;

  const primary = user.email_addresses.find(
    (address) => address.id === user.primary_email_address_id,
  );
  if (primary) values.email = primary.email_address;

  if (Object.keys(values).length === 0) return { kind: "ignored" };
  return { kind: "update", userId: user.id, values };
}
