import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { arabicDigitMessages, MESSAGE_FORMATS, mergeMessages, withArabicDigits } from "./messages";

// As in messages.test.ts: Vitest resolves `next-intl/server` to its client
// build, and only the Next compiler provides `next/root-params`.
vi.mock("next/root-params", () => ({ locale: async () => undefined }));
vi.mock("next-intl/server", () => ({
  getRequestConfig: <Config>(build: Config) => build,
}));

type Config = { locale: string; messages: Record<string, Record<string, unknown>>; formats?: unknown };
const loadConfig = async (locale: "ar" | "en") => {
  const { default: getConfig } = await import("./request");
  return (await getConfig({ locale, requestLocale: Promise.resolve(locale) })) as unknown as Config;
};

describe("withArabicDigits", () => {
  it("points unstyled numbers and plural # at the arab format", () => {
    expect(withArabicDigits("آخر {days, number} يومًا")).toBe("آخر {days, number, arab} يومًا");
    expect(withArabicDigits("{count, plural, one {ملف واحد} other {# ملفات}}")).toBe(
      "{count, plural, one {ملف واحد} other {{count, number, arab} ملفات}}",
    );
  });

  it("keeps # pointing at its own plural, through a select and a nested plural", () => {
    expect(
      withArabicDigits("{total, plural, other {{kind, select, a {# أ} other {{left, plural, other {# ب}}}}}}"),
    ).toBe(
      "{total, plural, other {{kind, select, a {{total, number, arab} أ} other {{left, plural, other {{left, number, arab} ب}}}}}}",
    );
  });

  it("leaves everything else as written", () => {
    for (const message of [
      "حتى {count} ملفات، {size}.",
      "{share, number, percent}",
      "{n, number, ::compact-short}",
      "{when, date, long}",
      "{kind, select, a {أ} other {ب}}",
      "# ليس عددًا هنا",
      "{n, plural, offset:1 other {# آخرون}}",
      "{n, plural, other {'#' حرفيًا}}",
      "لا '{'أقواس'}' هنا",
      "<b>نص</b> عادي",
    ]) {
      expect(withArabicDigits(message)).toBe(message);
    }
  });

  it("returns a string that isn't valid ICU unchanged (Clerk's {{name}} strings)", () => {
    for (const message of ["{count, plural, other {#}", "المتابعة إلى {{applicationName}}", "}"]) {
      expect(withArabicDigits(message)).toBe(message);
    }
  });
});

describe("messages in each language", () => {
  const source = {
    Test: {
      plural: "{count, plural, one {ملف واحد} two {ملفان} few {# ملفات} many {# ملفًا} other {# ملف}}",
      number: "آخر {days, number} يومًا",
      plain: "حتى {size}",
    },
  };
  const en = { Test: { plural: "{count, plural, one {# file} other {# files}}", number: "Last {days, number} days" } };

  it("renders Arabic-Indic digits in Arabic, for a plural # and a {n, number} argument", () => {
    const t = createTranslator({ locale: "ar", messages: arabicDigitMessages(source), formats: MESSAGE_FORMATS, namespace: "Test" });
    expect(t("plural", { count: 5 })).toBe("٥ ملفات");
    expect(t("plural", { count: 1200 })).toBe("١٬٢٠٠ ملف");
    expect(t("number", { days: 90 })).toBe("آخر ٩٠ يومًا");
    // Text passed in stays as it is.
    expect(t("plain", { size: "10 MB" })).toBe("حتى 10 MB");
  });

  it("renders Western digits in English", () => {
    const t = createTranslator({ locale: "en", messages: en, formats: MESSAGE_FORMATS, namespace: "Test" });
    expect(t("plural", { count: 1200 })).toBe("1,200 files");
    expect(t("number", { days: 90 })).toBe("Last 90 days");
  });

  it("keeps the routing locale `ar`, and rewrites only the Arabic messages", async () => {
    const config = await loadConfig("ar");
    expect(config.locale).toBe("ar");
    expect(config.formats).toEqual(MESSAGE_FORMATS);
    expect(config.messages.DashboardStatistics?.kpis).toMatchObject({
      firstReply: expect.objectContaining({ hint: expect.stringContaining("{days, number, arab}") }),
    });

    const english = await loadConfig("en");
    expect(english.locale).toBe("en");
    expect(JSON.stringify(english.messages)).not.toContain(", arab}");
  });
});

/** Every message string in a tree, with its dotted key. */
function strings(node: unknown, prefix = ""): [string, string][] {
  if (typeof node === "string") return [[prefix, node]];
  if (typeof node !== "object" || node === null) return [];
  return Object.entries(node).flatMap(([key, child]) => strings(child, prefix ? `${prefix}.${key}` : key));
}

describe("every Arabic message", () => {
  const files = import.meta.glob<unknown>("../messages/ar/*.json", { import: "default", eager: true });
  const base = import.meta.glob<unknown>("../messages/ar.json", { import: "default", eager: true });
  const all = mergeMessages(Object.values(base)[0] as Record<string, unknown>, files);
  const numeric = strings(all).filter(([, message]) => /, (number|plural|selectordinal)\b/.test(message));

  it("has numeric messages to check", () => {
    expect(numeric.length).toBeGreaterThan(20);
  });

  // The rewrite changes only the digits: the same message, formatted with the
  // numbering system in the locale tag, gives exactly the same text.
  it.each(numeric)("%s formats as with ar-u-nu-arab", (_key, message) => {
    const values: Record<string, unknown> = {};
    for (const [, name] of message.matchAll(/\{\s*(\w+)\s*\}/g)) values[name!] = "x";
    for (const [, name] of message.matchAll(/\{\s*(\w+)\s*,\s*select\b/g)) values[name!] = "other";
    for (const [, tag] of message.matchAll(/<(\w+)>/g)) values[tag!] = (chunks: string) => chunks;
    const numbers = [...message.matchAll(/\{\s*(\w+)\s*,\s*(?:number|plural|selectordinal)\b/g)].map(([, name]) => name!);

    for (const sample of [0, 1, 2, 3, 11, 100, 1200]) {
      for (const name of numbers) values[name] = sample;
      const expected = createTranslator({ locale: "ar-u-nu-arab" as "ar", messages: { m: message } }).markup(
        "m" as never,
        values as never,
      );
      const actual = createTranslator({
        locale: "ar",
        messages: { m: withArabicDigits(message) },
        formats: MESSAGE_FORMATS,
      }).markup("m" as never, values as never);
      expect(actual).toBe(expected);
    }
  });
});
