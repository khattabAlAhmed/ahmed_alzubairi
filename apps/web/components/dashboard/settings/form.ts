import {
  MAX_SOCIAL_LINKS,
  updateSettingRequestSchema,
  type SiteSettings,
  type UpdateSettingRequest,
} from "@repo/shared";

/** One social link as the form holds it: both sides may be empty while typing. */
export type SocialLinkInput = { platform: string; url: string };

/** The settings form's state. Text fields hold what was typed. */
export type SettingsValues = {
  contactEmail: string;
  whatsappNumber: string;
  linkedinUrl: string;
  socialLinks: SocialLinkInput[];
  cvFileKey: string;
  cvVisible: boolean;
};

export type SettingsErrorCode = "invalid" | "required" | "cantClear" | "tooMany";

/** Errors by input name: `contactEmail`, or `social.<index>.platform` / `.url`. */
export type SettingsErrors = Record<string, SettingsErrorCode>;

export function toValues(settings: SiteSettings): SettingsValues {
  return {
    contactEmail: settings.contact_email ?? "",
    whatsappNumber: settings.whatsapp_number ?? "",
    linkedinUrl: settings.linkedin_url ?? "",
    socialLinks: (settings.social_links ?? []).map((link) => ({ ...link })),
    cvFileKey: settings.cv_file_key ?? "",
    cvVisible: settings.cv_visible === true,
  };
}

const TEXT_KEYS = [
  ["contactEmail", "contact_email"],
  ["whatsappNumber", "whatsapp_number"],
  ["linkedinUrl", "linkedin_url"],
] as const;

/**
 * The `PATCH /api/admin/settings` bodies for what changed, one key each,
 * checked with the route's own schema. The route can't empty a key, so a
 * saved text that was cleared is an error, not a change. A new CV file goes
 * before its visibility, so the site never shows a link to nothing.
 */
export function buildChanges(
  values: SettingsValues,
  saved: SiteSettings,
): { changes: UpdateSettingRequest[]; errors: SettingsErrors } {
  const changes: UpdateSettingRequest[] = [];
  const errors: SettingsErrors = {};

  const check = (name: string, body: unknown) => {
    const parsed = updateSettingRequestSchema.safeParse(body);
    if (parsed.success) changes.push(parsed.data);
    else errors[name] = "invalid";
  };

  for (const [name, key] of TEXT_KEYS) {
    const value = values[name].trim();
    const before = saved[key] ?? "";
    if (value === before) continue;
    if (value === "") errors[name] = "cantClear";
    else check(name, { key, value });
  }

  // Rows left fully empty are dropped; a half-filled row needs its other side.
  const links: SocialLinkInput[] = [];
  values.socialLinks.forEach((link, index) => {
    const platform = link.platform.trim();
    const url = link.url.trim();
    if (platform === "" && url === "") return;
    if (platform === "") errors[`social.${index}.platform`] = "required";
    if (url === "") errors[`social.${index}.url`] = "required";
    links.push({ platform, url });
  });
  if (links.length > MAX_SOCIAL_LINKS) errors.socialLinks = "tooMany";
  const linksHaveErrors = Object.keys(errors).some(
    (name) => name.startsWith("social.") || name === "socialLinks",
  );
  if (!linksHaveErrors && JSON.stringify(links) !== JSON.stringify(saved.social_links ?? [])) {
    const parsed = updateSettingRequestSchema.safeParse({ key: "social_links", value: links });
    if (parsed.success) {
      changes.push(parsed.data);
    } else {
      // Point at the row and side the schema refused.
      for (const issue of parsed.error.issues) {
        const [, index, side] = issue.path;
        if (typeof index === "number" && (side === "platform" || side === "url")) {
          errors[`social.${index}.${side}`] = "invalid";
        } else {
          errors.socialLinks = "invalid";
        }
      }
    }
  }

  const cvKey = values.cvFileKey.trim();
  if (cvKey !== "" && cvKey !== (saved.cv_file_key ?? "")) {
    check("cvFileKey", { key: "cv_file_key", value: cvKey });
  }
  if (values.cvVisible !== (saved.cv_visible === true)) {
    check("cvVisible", { key: "cv_visible", value: values.cvVisible });
  }

  return { changes, errors };
}

export type SaveSettingsResult =
  | { ok: true }
  /** `message` is the server's localized text, when it sent one. */
  | { ok: false; key: UpdateSettingRequest["key"]; message: string | null };

/**
 * Sends the changes one key at a time, in order, and stops at the first
 * failure. The route checks `team.manage`, writes the audit log and
 * refreshes the header, footer and contact page.
 */
export async function saveSettings(
  changes: readonly UpdateSettingRequest[],
  fetchImpl: typeof fetch = fetch,
): Promise<SaveSettingsResult> {
  for (const change of changes) {
    let response: Response;
    try {
      response = await fetchImpl("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(change),
      });
    } catch {
      return { ok: false, key: change.key, message: null };
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: unknown };
      } | null;
      const message = body?.error?.message;
      return { ok: false, key: change.key, message: typeof message === "string" ? message : null };
    }
  }
  return { ok: true };
}
