import { z } from "zod";
import { emailSchema, httpsUrlSchema } from "./fields";
import { PHONE_MAX_DIGITS, PHONE_MIN_DIGITS } from "./limits";

/** The `site_settings` keys (§6.3, §6.14, §6.20). Each has its own value schema. */
export const SETTING_KEYS = [
  "contact_email",
  "whatsapp_number",
  "linkedin_url",
  "social_links",
  "cv_visible",
  "cv_file_key",
] as const;

export const settingKeySchema = z.enum(SETTING_KEYS);

export type SettingKey = z.infer<typeof settingKeySchema>;

/** Max entries in `social_links`. */
export const MAX_SOCIAL_LINKS = 10;

/** Max length of a social link's platform name. */
export const MAX_SOCIAL_PLATFORM_LENGTH = 50;

/** International format with the country code, such as `+967712345678`. `wa.me` links drop the `+`. */
const whatsappNumberSchema = z
  .string()
  .trim()
  .regex(
    new RegExp(`^\\+[1-9][0-9]{${PHONE_MIN_DIGITS - 1},${PHONE_MAX_DIGITS - 1}}$`),
  );

/** https on `linkedin.com` or one of its subdomains. */
const linkedinUrlSchema = z.url({
  protocol: /^https$/,
  hostname: /^([a-z0-9-]+\.)*linkedin\.com$/i,
});

const socialLinkSchema = z.strictObject({
  platform: z.string().trim().min(1).max(MAX_SOCIAL_PLATFORM_LENGTH),
  url: httpsUrlSchema,
});

export type SocialLink = z.infer<typeof socialLinkSchema>;

/** A key from the `media` upload target, so the file is in `public-media`. */
const cvFileKeySchema = z.string().trim().min(1).max(500);

/** Every URL is https, so `javascript:`, `data:` and `http:` are refused. */
export const settingValueSchemas = {
  contact_email: emailSchema,
  whatsapp_number: whatsappNumberSchema,
  linkedin_url: linkedinUrlSchema,
  social_links: z.array(socialLinkSchema).max(MAX_SOCIAL_LINKS),
  cv_visible: z.boolean(),
  cv_file_key: cvFileKeySchema,
} as const satisfies Record<SettingKey, z.ZodType>;

export type SettingValue<Key extends SettingKey> = z.infer<
  (typeof settingValueSchemas)[Key]
>;

const settingBody = <Key extends SettingKey>(key: Key) =>
  z.strictObject({
    key: z.literal(key),
    value: settingValueSchemas[key],
  });

/** `PATCH /api/admin/settings`. One key per request, with that key's value schema. */
export const updateSettingRequestSchema = z.discriminatedUnion("key", [
  settingBody("contact_email"),
  settingBody("whatsapp_number"),
  settingBody("linkedin_url"),
  settingBody("social_links"),
  settingBody("cv_visible"),
  settingBody("cv_file_key"),
]);

export type UpdateSettingRequest = z.infer<typeof updateSettingRequestSchema>;

/** All settings, as `lib/content` returns them. A key that isn't set is left out. */
export const siteSettingsSchema = z
  .strictObject(settingValueSchemas)
  .partial();

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

/**
 * Turns `site_settings` rows into `SiteSettings`. Unknown keys and values that
 * fail their schema are dropped, so a bad stored URL never reaches a page.
 */
export function parseSiteSettings(
  rows: readonly { key: string; value: unknown }[],
): SiteSettings {
  const settings: Record<string, unknown> = {};
  for (const row of rows) {
    const key = settingKeySchema.safeParse(row.key);
    if (!key.success) continue;
    const value = settingValueSchemas[key.data].safeParse(row.value);
    if (value.success) settings[key.data] = value.data;
  }
  return siteSettingsSchema.parse(settings);
}
