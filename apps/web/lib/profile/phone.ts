// Arabic-Indic (٠–٩) and Persian (۰–۹) digits, as Arabic keyboards type them.
const EASTERN_DIGIT = /[٠-٩۰-۹]/g;

// Spaces of any kind, hyphens and dashes, and parentheses.
const SEPARATOR = /[\s\-‐-―−()]/g;

/**
 * Tidies a phone number the way people type it, before the form sends it:
 * `٠٥٠ ١٢٣ ٤٥٦٧` and `(050) 123-4567` both become `0501234567`. The server's
 * schema stays strict, so anything else is still refused there.
 */
export function normalizePhone(value: string) {
  return value
    .replace(EASTERN_DIGIT, (digit) => String(digit.charCodeAt(0) & 0xf))
    .replace(SEPARATOR, "");
}
