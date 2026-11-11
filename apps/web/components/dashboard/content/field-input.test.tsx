// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { LanguageTabs } from "@/components/ui";
import ar from "@/messages/ar/DashboardContent.json";
import en from "@/messages/en/DashboardContent.json";
import editorAr from "@/messages/ar/DashboardEditor.json";
import editorEn from "@/messages/en/DashboardEditor.json";
import { FieldInput } from "./field-input";
import type { FieldContext } from "./field-text";
import type { FieldDef } from "./registry";

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia;

afterEach(cleanup);

const MESSAGES = {
  ar: { DashboardContent: ar, DashboardEditor: editorAr },
  en: { DashboardContent: en, DashboardEditor: editorEn },
} as const;
const DIRECTION = { ar: "rtl", en: "ltr" } as const;
const SUFFIX = { ar: "Ar", en: "En" } as const;

const TITLE: FieldDef = { name: "title", kind: "text", localized: true };
const ORG_LABEL: FieldDef = { name: "orgLabel", kind: "text", localized: true };
const SUMMARY: FieldDef = { name: "summary", kind: "longtext", localized: true };
const BODY: FieldDef = { name: "body", kind: "richtext", localized: true };
const SLUG: FieldDef = { name: "slug", kind: "slug" };
const URL_FIELD: FieldDef = { name: "url", kind: "url" };
const LOCALIZED = [TITLE, ORG_LABEL, SUMMARY, BODY];

const names = (suffix: string) => LOCALIZED.map((field) => `${field.name}${suffix}`);

const ctx: FieldContext = {
  type: "services",
  values: {},
  original: null,
  // Every localized input has an error, so each one shows.
  errors: Object.fromEntries([...names("Ar"), ...names("En")].map((name) => [name, "required"])),
  setValue: () => {},
  refOptions: {},
  mediaBase: "https://x.test/m/",
  requiredNames: new Set(),
};

/** The localized fields in both panels and a slug and a URL outside them, on a page in the `ui` language. */
function renderFields(ui: "ar" | "en") {
  const panel = (lang: "ar" | "en") => ({
    label: MESSAGES[ui].DashboardContent.locales[lang],
    content: LOCALIZED.map((field) => {
      const name = `${field.name}${SUFFIX[lang]}`;
      return <FieldInput key={name} field={field} name={name} ctx={ctx} />;
    }),
  });
  render(
    <NextIntlClientProvider locale={ui} messages={MESSAGES[ui]}>
      <div lang={ui} dir={DIRECTION[ui]}>
        <LanguageTabs label="Language" arabic={panel("ar")} english={panel("en")} />
        <FieldInput field={SLUG} name="slug" ctx={ctx} />
        <FieldInput field={URL_FIELD} name="url" ctx={ctx} />
      </div>
    </NextIntlClientProvider>,
  );
}

/** The language and direction an element resolves to: its own, or the nearest above it. */
const resolved = (element: Element | null | undefined) => [
  element?.closest("[lang]")?.getAttribute("lang"),
  element?.closest("[dir]")?.getAttribute("dir"),
];

const own = (element: Element | null) => [element?.getAttribute("lang"), element?.getAttribute("dir")];

/** The elements a control names in an ARIA id list. */
const referenced = (control: Element, attribute: string) =>
  (control.getAttribute(attribute) ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id));

describe.each([
  ["ar", "en"],
  ["en", "ar"],
  ["ar", "ar"],
  ["en", "en"],
] as const)("FieldInput, %s UI, %s panel", (ui, panel) => {
  const suffix = SUFFIX[panel];

  it.each([
    ["text", `title${suffix}`, 1],
    ["text with a hint", `orgLabel${suffix}`, 2],
    ["long text", `summary${suffix}`, 1],
  ] as const)("gives a %s field the UI's label, hint and error, and the panel's input", (_kind, name, described) => {
    renderFields(ui);
    const input = document.querySelector(`[name="${name}"]`) as HTMLElement;
    expect(own(input)).toEqual([panel, DIRECTION[panel]]);

    const texts = [document.querySelector(`label[for="${input.id}"]`), ...referenced(input, "aria-describedby")];
    // The label, then the hint if the field has one, then the error.
    expect(texts).toHaveLength(1 + described);
    for (const text of texts) {
      expect(text?.textContent).toBeTruthy();
      expect(resolved(text)).toEqual([ui, DIRECTION[ui]]);
    }
  });

  it("gives the rich-text editor the UI's label and error, and the panel's editing area", async () => {
    renderFields(ui);
    const areas = await waitFor(() => {
      const found = document.querySelectorAll(".ProseMirror");
      if (found.length < 2) throw new Error("no editors yet");
      return found;
    });
    // Panels: Arabic first, English second.
    const area = areas[panel === "ar" ? 0 : 1];
    expect(own(area)).toEqual([panel, DIRECTION[panel]]);

    const texts = [...referenced(area, "aria-labelledby"), ...referenced(area, "aria-describedby")];
    expect(texts).toHaveLength(2);
    for (const text of texts) {
      expect(text?.textContent).toBeTruthy();
      expect(resolved(text)).toEqual([ui, DIRECTION[ui]]);
    }
    const toolbar = area.closest("[lang]:not(.ProseMirror)")?.querySelector('[role="toolbar"]');
    expect(resolved(toolbar)).toEqual([ui, DIRECTION[ui]]);
  });
});

describe.each(["ar", "en"] as const)("FieldInput outside a panel, %s UI", (ui) => {
  it("keeps slug and URL inputs left to right, with no language of their own", () => {
    renderFields(ui);
    for (const name of ["slug", "url"]) {
      const input = document.querySelector(`[name="${name}"]`) as HTMLElement;
      expect(own(input)).toEqual([null, "ltr"]);
      expect(resolved(document.querySelector(`label[for="${input.id}"]`))).toEqual([ui, DIRECTION[ui]]);
    }
  });
});
