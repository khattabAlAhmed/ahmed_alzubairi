// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import StatisticsError from "./error";

afterEach(cleanup);

describe("statistics error", () => {
  it("retries with Next's retry(), which fetches the server read again", () => {
    const retry = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={{ Error: en.Error }}>
        <StatisticsError retry={retry} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("alert").textContent).toContain(en.Error.title);
    fireEvent.click(screen.getByRole("button", { name: en.Error.retry }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
