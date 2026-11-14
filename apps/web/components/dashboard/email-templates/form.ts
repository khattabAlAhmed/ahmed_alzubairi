import {
  MAX_LONG_TEXT_LENGTH,
  MAX_SHORT_TEXT_LENGTH,
  type EmailEvent,
  type EmailTemplate,
  type UpdateEmailTemplateRequest,
} from "@repo/shared";
import {
  TEMPLATE_FIELDS,
  unknownPlaceholders,
  type TemplateField,
} from "@/lib/admin/email-templates/templates";

/** The editor's state: the four texts as typed. */
export type TemplateValues = Record<TemplateField, string>;

export type TemplateFieldError =
  | { code: "required" }
  | { code: "tooLong"; max: number }
  | { code: "unknownPlaceholder"; names: string[] };

export type TemplateErrors = Partial<Record<TemplateField, TemplateFieldError>>;

const MAX_LENGTH: Record<TemplateField, number> = {
  subjectAr: MAX_SHORT_TEXT_LENGTH,
  subjectEn: MAX_SHORT_TEXT_LENGTH,
  bodyAr: MAX_LONG_TEXT_LENGTH,
  bodyEn: MAX_LONG_TEXT_LENGTH,
};

export function toValues(template: EmailTemplate): TemplateValues {
  const { subjectAr, subjectEn, bodyAr, bodyEn } = template;
  return { subjectAr, subjectEn, bodyAr, bodyEn };
}

/**
 * The same checks as `PATCH /api/admin/email-templates`, so the form names
 * the field: not empty, within the length limit, and only the placeholders
 * the event's payload has.
 */
export function validateTemplate(
  event: EmailEvent,
  values: TemplateValues,
): TemplateErrors {
  const errors: TemplateErrors = {};
  for (const field of TEMPLATE_FIELDS) {
    const text = values[field].trim();
    const unknown = unknownPlaceholders(event, text);
    if (text === "") errors[field] = { code: "required" };
    else if (text.length > MAX_LENGTH[field]) {
      errors[field] = { code: "tooLong", max: MAX_LENGTH[field] };
    } else if (unknown.length > 0) {
      errors[field] = { code: "unknownPlaceholder", names: unknown };
    }
  }
  return errors;
}

/** True when a text differs from what the page loaded, ignoring outer spaces. */
export function isChanged(values: TemplateValues, saved: EmailTemplate): boolean {
  return TEMPLATE_FIELDS.some((field) => values[field].trim() !== saved[field]);
}

export type TemplateRequestResult =
  | { ok: true }
  /** `message` is the server's text in the user's language, when it sent one. */
  | { ok: false; message: string | null };

/** A request that hangs is a failure the admin can retry, not a stuck button. */
const TIMEOUT_MS = 15_000;

async function send(
  method: "PATCH" | "DELETE",
  body: unknown,
  fetchImpl: typeof fetch,
): Promise<TemplateRequestResult> {
  let response: Response;
  try {
    response = await fetchImpl("/api/admin/email-templates", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, message: null };
  }
  if (response.ok) return { ok: true };
  const answer = (await response.json().catch(() => null)) as {
    error?: { message?: unknown };
  } | null;
  const message = answer?.error?.message;
  return { ok: false, message: typeof message === "string" ? message : null };
}

/** Saves one event's template. The route checks `team.manage`. */
export function saveTemplate(
  template: UpdateEmailTemplateRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<TemplateRequestResult> {
  return send("PATCH", template, fetchImpl);
}

/** "Reset to default": deletes the event's saved template. */
export function resetTemplate(
  event: EmailEvent,
  fetchImpl: typeof fetch = fetch,
): Promise<TemplateRequestResult> {
  return send("DELETE", { event }, fetchImpl);
}
