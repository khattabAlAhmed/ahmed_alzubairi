/**
 * A quick-stat value such as "15+", "1,200" or "٤٠" split into the number to
 * count up to and the text around it. Values with no single number, such as
 * "2010–2024", return null and are shown as written, without counting.
 */
export type StatValue = {
  prefix: string;
  target: number;
  suffix: string;
  decimals: number;
  grouped: boolean;
  arabicDigits: boolean;
};

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function toWestern(text: string) {
  return text
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/٬/g, ",")
    .replace(/٫/g, ".");
}

function toArabic(text: string) {
  return text
    .replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)])
    .replace(/,/g, "٬")
    .replace(/\./g, "٫");
}

/** Split a stat value into its number and surrounding text, or null when it has no single number. */
export function parseStatValue(value: string): StatValue | null {
  const trimmed = value.trim();
  const arabicDigits = /[٠-٩]/.test(trimmed);
  const match = /^(\D*?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\D*)$/.exec(toWestern(trimmed));
  if (!match) return null;
  const [, prefix, whole, fraction = "", suffix] = match;
  const target = Number(`${whole.replace(/,/g, "")}${fraction}`);
  if (!Number.isFinite(target)) return null;
  return {
    prefix: arabicDigits ? toArabic(prefix) : prefix,
    target,
    suffix: arabicDigits ? toArabic(suffix) : suffix,
    decimals: fraction ? fraction.length - 1 : 0,
    grouped: whole.includes(","),
    arabicDigits,
  };
}

/** The value with `current` in place of the number, in the original style. */
export function formatStatValue(stat: StatValue, current: number): string {
  const fixed = Math.min(current, stat.target).toFixed(stat.decimals);
  const [whole, fraction] = fixed.split(".");
  const grouped = stat.grouped ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : whole;
  const number = fraction ? `${grouped}.${fraction}` : grouped;
  return `${stat.prefix}${stat.arabicDigits ? toArabic(number) : number}${stat.suffix}`;
}
