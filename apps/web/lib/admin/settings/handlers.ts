import {
  SITE_SETTINGS_CACHE_TAG,
  updateSettingRequestSchema,
  type Locale,
  type OkResponse,
  type SettingKey,
} from "@repo/shared";
import { baseError, type AdminError } from "../permissions";

export type SettingsAuditEntry = {
  actorId: string;
  action: "settings.update";
  entity: "site_settings";
  entityId: SettingKey;
  /** The key only: values such as the contact email stay out of the log. */
  metadata: { key: SettingKey };
};

/**
 * The database, behind an interface so tests can replace it. Service client,
 * created only after `requirePermission(team.manage)` passed.
 */
export type SettingsStore = {
  /** Inserts or replaces one key's value. */
  upsert: (key: SettingKey, value: unknown) => Promise<void>;
  audit: (entry: SettingsAuditEntry) => Promise<void>;
};

export type SettingsDeps = {
  locale: Locale;
  userId: string;
  store: SettingsStore;
  revalidate: (tag: string) => void;
};

/**
 * `PATCH /api/admin/settings`, after the permission check. One key per
 * request, checked with that key's own schema: an unknown key, a wrong value
 * type, or a URL that isn't https (such as `javascript:`) is refused.
 */
export async function updateSetting(
  rawBody: unknown,
  { locale, userId, store, revalidate }: SettingsDeps,
): Promise<{ status: 200; body: OkResponse } | AdminError> {
  const body = updateSettingRequestSchema.safeParse(rawBody);
  if (!body.success) return baseError("validation_failed", 400, locale);

  const { key, value } = body.data;
  await store.upsert(key, value);
  revalidate(SITE_SETTINGS_CACHE_TAG);

  await store.audit({
    actorId: userId,
    action: "settings.update",
    entity: "site_settings",
    entityId: key,
    metadata: { key },
  });
  return { status: 200, body: { ok: true } };
}
