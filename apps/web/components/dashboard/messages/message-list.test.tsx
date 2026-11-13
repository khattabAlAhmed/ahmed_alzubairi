// @vitest-environment jsdom
import type { ContactMessage } from "@repo/shared";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/DashboardMessages.json";
import en from "@/messages/en/DashboardMessages.json";
import { MessageList } from "./message-list";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: true })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const UNREAD: ContactMessage = {
  id: "323e4567-e89b-42d3-a456-426614174002",
  name: "<i>Example</i> Visitor",
  email: "visitor@example.com",
  orgType: "company",
  subject: "<script>alert(1)</script> A question",
  message: '<b>Hello</b> <img src=x onerror="alert(1)">\nSecond line',
  readAt: null,
  createdAt: "2026-11-11T10:00:00.000Z",
};
const READ: ContactMessage = {
  ...UNREAD,
  id: "423e4567-e89b-42d3-a456-426614174003",
  subject: "Already read",
  readAt: "2026-11-11T11:00:00.000Z",
};

function show(messages: ContactMessage[], locale: "ar" | "en" = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ DashboardMessages: locale === "ar" ? ar : en }}
    >
      <MessageList messages={messages} />
    </NextIntlClientProvider>,
  );
}

const body = (call: number) =>
  JSON.parse(String(fetchMock.mock.calls[call]?.[1]?.body)) as unknown;

describe("MessageList", () => {
  it("shows a message containing HTML as text, never as elements", () => {
    const { container } = show([UNREAD]);
    expect(screen.getByText(UNREAD.subject)).toBeTruthy();
    expect(screen.getByText(UNREAD.name)).toBeTruthy();
    expect(container.textContent).toContain('<b>Hello</b> <img src=x onerror="alert(1)">');
    expect(container.querySelector("script, img, b, i")).toBeNull();
  });

  it("keeps the email left-to-right and shows the organization type", () => {
    show([UNREAD], "ar");
    const email = screen.getByText(UNREAD.email);
    expect(email.tagName).toBe("BDI");
    expect(email.getAttribute("dir")).toBe("ltr");
    expect(screen.getByText(ar.orgTypes.company, { exact: false })).toBeTruthy();
  });

  it("shows the time in the viewer's locale and time zone", () => {
    const { container } = show([UNREAD]);
    const time = container.querySelector("time");
    expect(time?.getAttribute("datetime")).toBe(UNREAD.createdAt);
    expect(time?.textContent).toBe(
      new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(UNREAD.createdAt),
      ),
    );
  });

  it("opening an unread message shows its text and marks it read", async () => {
    show([UNREAD]);
    const row = screen.getByRole("listitem");
    expect(within(row).getByText(en.row.unread)).toBeTruthy();
    const toggle = within(row).getByRole("button", { expanded: false });
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body(0)).toEqual({ id: UNREAD.id, read: true });
    expect(within(row).getByText(en.row.read)).toBeTruthy();
    expect(
      within(row).getByRole("link", { name: en.row.reply }).getAttribute("href"),
    ).toBe("mailto:visitor@example.com");
  });

  it("opening a read message sends nothing; the button marks it unread again", async () => {
    show([READ]);
    const row = screen.getByRole("listitem");
    await act(async () => {
      fireEvent.click(within(row).getByRole("button", { expanded: false }));
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(row).getByRole("button", { name: en.row.markUnread }));
    });
    expect(body(0)).toEqual({ id: READ.id, read: false });
    expect(within(row).getByText(en.row.unread)).toBeTruthy();
    expect(within(row).getByRole("status").textContent).toBe(en.row.markedUnread);
  });

  it("keeps the message unread and says so when the change is refused", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: { code: "forbidden", message: "Not allowed." } }), {
          status: 403,
        }),
    );
    show([UNREAD]);
    const row = screen.getByRole("listitem");
    await act(async () => {
      fireEvent.click(within(row).getByRole("button", { expanded: false }));
    });
    expect(within(row).getByText(en.row.unread)).toBeTruthy();
    expect(within(row).getByRole("alert").textContent).toBe("Not allowed.");
  });
});
