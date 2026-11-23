// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import ErrorPage from "./error";

afterEach(cleanup);

// The root layout sends the Error namespace to the browser, so this page reads it.
describe("locale error page", () => {
  it.each([["ar", ar], ["en", en]] as const)("shows its copy in %s, and retries", (locale, messages) => {
    const retry = vi.fn();
    render(
      <NextIntlClientProvider locale={locale} messages={{ Error: messages.Error }}>
        <ErrorPage retry={retry} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(messages.Error.title);
    expect(screen.getByText(messages.Error.description)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: messages.Error.retry }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
