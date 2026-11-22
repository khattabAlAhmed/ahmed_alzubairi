// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import arBlog from "@/messages/ar/Blog.json";
import enBlog from "@/messages/en/Blog.json";
import arMedia from "@/messages/ar/Media.json";
import enMedia from "@/messages/en/Media.json";
import arResources from "@/messages/ar/Resources.json";
import enResources from "@/messages/en/Resources.json";
import MediaError from "../media/error";
import ResourcesError from "../resources/error";
import BlogError from "./error";

/*
 * An error page is a client component, and the browser gets none of the page
 * namespaces (the root layout sends only Header, Nav, Error and Consent). So
 * each page is rendered with no page messages at all: it must still show its
 * own copy in both languages, never a message key.
 */
afterEach(cleanup);

const pages: [string, ComponentType<{ reset: () => void }>, Record<"ar" | "en", { title: string; text: string; retry: string }>][] = [
  ["blog", BlogError, { ar: arBlog.error, en: enBlog.error }],
  ["resources", ResourcesError, { ar: arResources.error, en: enResources.error }],
  ["media", MediaError, { ar: arMedia.error, en: enMedia.error }],
];

describe.each(pages)("%s error page", (_name, ErrorPage, copy) => {
  it.each(["ar", "en"] as const)("shows its copy in %s, and retries", (locale) => {
    const missing: string[] = [];
    const reset = vi.fn();
    render(
      <NextIntlClientProvider locale={locale} messages={{}} onError={(error) => missing.push(error.message)}>
        <ErrorPage reset={reset} />
      </NextIntlClientProvider>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(copy[locale].title);
    expect(alert.textContent).toContain(copy[locale].text);
    expect(alert.textContent).not.toMatch(/\.error\.|projectsPage|Catalog|Blog\.|Resources\.|Media\./);
    expect(missing).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: copy[locale].retry }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
