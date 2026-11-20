import { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { describe, expect, it } from "vitest";
import ar from "../messages/ar.json";
import en from "../messages/en.json";
import { localeDirection, otherLocale, routing } from "./routing";

function keyPaths(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === "object"
      ? keyPaths(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("routing", () => {
  it("serves Arabic and English, with Arabic as the default", () => {
    expect(routing.locales).toEqual(["ar", "en"]);
    expect(routing.defaultLocale).toBe("ar");
  });

  it("ignores the browser language, so / always goes to /ar", () => {
    expect(routing.localeDetection).toBe(false);
  });

  it("sets no cookie, so public pages stay cacheable", () => {
    expect(routing.localeCookie).toBe(false);
  });

  it("sends no hreflang Link header: only the page's own metadata names its alternates", async () => {
    expect(routing.alternateLinks).toBe(false);
    const handle = createMiddleware(routing);
    for (const path of ["/ar", "/en/services/english-only-service", "/ar/blog/مقال"]) {
      const response = handle(new NextRequest(new URL(encodeURI(path), "https://example.test")));
      expect(response.headers.get("link") ?? "").not.toMatch(/hreflang/i);
    }
  });
});

describe("localeDirection", () => {
  it("is rtl for Arabic and ltr for English", () => {
    expect(localeDirection("ar")).toBe("rtl");
    expect(localeDirection("en")).toBe("ltr");
  });
});

describe("otherLocale", () => {
  it("swaps the two languages", () => {
    expect(otherLocale("ar")).toBe("en");
    expect(otherLocale("en")).toBe("ar");
  });
});

describe("messages", () => {
  it("has the same keys in both languages", () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(ar).sort());
  });
});
