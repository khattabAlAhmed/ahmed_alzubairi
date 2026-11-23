// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/Training.json";
import en from "@/messages/en/Training.json";
import CourseError from "./error";

/*
 * An error page is a client component, and the browser gets none of the page
 * namespaces (the root layout sends only Header, Nav, Error and Consent). So
 * the page is rendered with no page messages at all: it must still show its
 * own copy in both languages, never a message key.
 */
afterEach(cleanup);

describe("course error page", () => {
  it.each([
    ["ar", ar.course.error],
    ["en", en.course.error],
  ] as const)("shows its copy in %s, and the button calls retry()", (locale, copy) => {
    const missing: string[] = [];
    const retry = vi.fn();
    render(
      <NextIntlClientProvider locale={locale} messages={{}} onError={(error) => missing.push(error.message)}>
        <CourseError retry={retry} />
      </NextIntlClientProvider>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(copy.title);
    expect(alert.textContent).toContain(copy.text);
    expect(alert.textContent).not.toMatch(/\.error\.|course\.|Training\./);
    expect(missing).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: copy.retry }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
