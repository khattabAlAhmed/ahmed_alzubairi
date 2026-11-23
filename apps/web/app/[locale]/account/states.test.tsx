// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

const nav = vi.hoisted(() => ({ pathname: "/ar/account" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => nav.pathname,
}));

const { default: AccountLoading, accountList } = await import("./loading");
const { default: AccountError } = await import("./error");

/*
 * The account's loading and error states are client components, and the
 * browser gets no page namespaces: each renders with no messages at all and
 * must still show its own copy in both languages, never a key.
 */
afterEach(cleanup);

const COPY = { ar: ar.Account.states, en: en.Account.states };
const LISTS = ["consultations", "documents", "courses"] as const;

function renderIn(locale: "ar" | "en", node: React.ReactNode) {
  const missing: string[] = [];
  render(
    <NextIntlClientProvider locale={locale} messages={{}} onError={(error) => missing.push(error.message)}>
      {node}
    </NextIntlClientProvider>,
  );
  return missing;
}

describe("accountList", () => {
  it("names the list page, and nothing else", () => {
    expect(accountList("/ar/account/consultations")).toBe("consultations");
    expect(accountList("/en/account/documents/")).toBe("documents");
    expect(accountList("/en/account/courses")).toBe("courses");
    expect(accountList("/en/account/consultations/new")).toBeNull();
    expect(accountList("/en/account/documents/0c8a")).toBeNull();
    expect(accountList("/en/account")).toBeNull();
    expect(accountList("/en/account/profile")).toBeNull();
  });
});

describe.each(["ar", "en"] as const)("account states in %s", (locale) => {
  it.each(LISTS)("loading %s shows that list's skeleton, busy, with a status", (list) => {
    nav.pathname = `/${locale}/account/${list}`;
    const missing = renderIn(locale, <AccountLoading />);
    expect(screen.getByRole("status").textContent).toBe(COPY[locale].loading[list]);
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(missing).toEqual([]);
  });

  it("loading another account page shows only the header's skeleton", () => {
    nav.pathname = `/${locale}/account/profile`;
    renderIn(locale, <AccountLoading />);
    expect(screen.getByRole("status").textContent).toBe(COPY[locale].loading.page);
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it.each([...LISTS, "page"] as const)("the %s error names it, and retries", (list) => {
    nav.pathname = list === "page" ? `/${locale}/account/consultations/new` : `/${locale}/account/${list}`;
    const reset = vi.fn();
    const missing = renderIn(locale, <AccountError reset={reset} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(COPY[locale].error[list]);
    expect(alert.textContent).toContain(COPY[locale].error.text);
    expect(alert.textContent).not.toMatch(/Account\.|states\./);
    expect(missing).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: COPY[locale].error.retry }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
