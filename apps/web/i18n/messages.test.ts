import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Messages } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import ar from "../messages/ar.json";
import en from "../messages/en.json";
import { mergeMessages, namespaceFromPath, pathsForLocale } from "./messages";

function keyPaths(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === "object" && child !== null
      ? keyPaths(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("mergeMessages", () => {
  const base = { Common: { loading: "Loading…" } };

  it("loads two namespace files side by side", () => {
    const merged = mergeMessages(base, {
      "../messages/en/ContactForm.json": { title: "Contact" },
      "../messages/en/DashboardSettings.json": { title: "Settings" },
    });
    expect(merged).toEqual({
      Common: { loading: "Loading…" },
      ContactForm: { title: "Contact" },
      DashboardSettings: { title: "Settings" },
    });
  });

  it("fails loudly on a namespace the base file already has", () => {
    expect(() =>
      mergeMessages(base, { "../messages/en/Common.json": { loading: "x" } }),
    ).toThrow(
      'Message namespace "Common" in ../messages/en/Common.json is already defined in the base file',
    );
  });

  it("fails loudly on a namespace two files define", () => {
    expect(() =>
      mergeMessages(base, {
        "../messages/en/Form.json": { a: "A" },
        "./other/en/Form.json": { b: "B" },
      }),
    ).toThrow(
      'Message namespace "Form" in ./other/en/Form.json is already defined in ../messages/en/Form.json',
    );
  });

  it.each([[["a"]], ["text"], [null], [1]])(
    "refuses a file that isn't a JSON object: %j",
    (content) => {
      expect(() =>
        mergeMessages(base, { "../messages/en/Bad.json": content }),
      ).toThrow("must hold a JSON object");
    },
  );

  it("leaves its inputs unchanged", () => {
    const files = { "../messages/en/Extra.json": { a: "A" } };
    const baseCopy = structuredClone(base);
    const filesCopy = structuredClone(files);
    mergeMessages(base, files);
    expect(base).toEqual(baseCopy);
    expect(files).toEqual(filesCopy);
  });

  it("returns the base messages when there are no files", () => {
    expect(mergeMessages(base, {})).toEqual(base);
  });
});

describe("namespaceFromPath", () => {
  it("names the namespace after the file", () => {
    expect(namespaceFromPath("../messages/ar/ContactForm.json")).toBe(
      "ContactForm",
    );
  });

  it.each([
    "../messages/ar/contact-form.json",
    "../messages/ar/contactForm.json",
    "../messages/ar/Contact.Form.json",
    "../messages/ar/ContactForm.ts",
  ])("refuses %s", (path) => {
    expect(() => namespaceFromPath(path)).toThrow("PascalCase");
  });
});

describe("pathsForLocale", () => {
  it("keeps one locale's files", () => {
    const paths = [
      "../messages/ar/A.json",
      "../messages/en/A.json",
      "../messages/ar/B.json",
    ];
    expect(pathsForLocale(paths, "ar")).toEqual([
      "../messages/ar/A.json",
      "../messages/ar/B.json",
    ]);
    expect(pathsForLocale(paths, "en")).toEqual(["../messages/en/A.json"]);
  });
});

describe("the namespace files in messages/", () => {
  // The same glob as request.ts.
  const files = import.meta.glob<unknown>("../messages/*/*.json", {
    import: "default",
    eager: true,
  });
  const arPaths = pathsForLocale(Object.keys(files), "ar");
  const enPaths = pathsForLocale(Object.keys(files), "en");
  const names = (paths: string[]) => paths.map(namespaceFromPath).sort();

  it("exist in both languages", () => {
    expect(names(enPaths)).toEqual(names(arPaths));
  });

  it.each(arPaths)("%s has the same keys in English", (arPath) => {
    const enPath = arPath.replace("/messages/ar/", "/messages/en/");
    expect(keyPaths(files[enPath] as object).sort()).toEqual(
      keyPaths(files[arPath] as object).sort(),
    );
  });

  it.each(arPaths)("%s has a .d.ts, so its keys are type-checked", (path) => {
    const declaration = new URL(path.replace(/\.json$/, ".d.ts"), import.meta.url);
    expect(existsSync(fileURLToPath(declaration))).toBe(true);
  });

  it("merge with the base files without a clash", () => {
    const pick = (paths: string[]) =>
      Object.fromEntries(paths.map((path) => [path, files[path]]));
    expect(() => mergeMessages(ar, pick(arPaths))).not.toThrow();
    expect(() => mergeMessages(en, pick(enPaths))).not.toThrow();
  });
});

// Only the Next compiler provides `next/root-params`, and Vitest resolves
// `next-intl/server` to its client build. The tests pass the locale.
vi.mock("next/root-params", () => ({ locale: async () => undefined }));
vi.mock("next-intl/server", () => ({
  getRequestConfig: <Config>(build: Config) => build,
}));

describe("request config", () => {
  it.each(["ar", "en"] as const)(
    "loads the base and namespace messages for %s",
    async (locale) => {
      const { default: getConfig } = await import("./request");
      const config = await getConfig({
        locale,
        requestLocale: Promise.resolve(locale),
      });
      const messages = config.messages as Messages;
      expect(messages.Common).toEqual(locale === "ar" ? ar.Common : en.Common);
      // TEMPORARY (P2P-T01 done-when 5): remove with messages/*/T01Check.*.
      expect(messages.T01Check.title).toBe(
        locale === "ar" ? "فحص المساحات" : "Namespace check",
      );
      // @ts-expect-error A key the namespace file doesn't have.
      expect(messages.T01Check.missing).toBeUndefined();
    },
  );
});
