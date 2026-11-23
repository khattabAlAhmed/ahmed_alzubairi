// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/Catalog.json";
import en from "@/messages/en/Catalog.json";
import ProjectsError from "./error";

/*
 * An error page is a client component, and the browser gets none of the page
 * namespaces (the root layout sends only Header, Nav, Error and Consent). So
 * each page is rendered with no page messages at all: it must still show its
 * own copy in both languages, never a message key.
 */
afterEach(cleanup);

const pages: [string, ComponentType<{ retry: () => void }>, Record<"ar" | "en", { title: string; text: string; retry: string }>][] = [
  ["projects", ProjectsError, { ar: ar.projectsPage.error, en: en.projectsPage.error }],
];

describe.each(pages)("%s error page", (_name, ErrorPage, copy) => {
  it.each(["ar", "en"] as const)("shows its copy in %s, and retries", (locale) => {
    const missing: string[] = [];
    const retry = vi.fn();
    render(
      <NextIntlClientProvider locale={locale} messages={{}} onError={(error) => missing.push(error.message)}>
        <ErrorPage retry={retry} />
      </NextIntlClientProvider>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(copy[locale].title);
    expect(alert.textContent).toContain(copy[locale].text);
    expect(alert.textContent).not.toMatch(/\.error\.|projectsPage|Catalog|Blog\.|Resources\.|Media\./);
    expect(missing).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: copy[locale].retry }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
