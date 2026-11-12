// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/DashboardNotifications.json";
import en from "@/messages/en/DashboardNotifications.json";
import type { NotificationItem } from "./data";

const nav = vi.hoisted(() => ({
  pathname: "/dashboard/notifications",
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, refresh: nav.refresh }),
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, refresh: nav.refresh }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));

const { DashboardNavLink } = await import("../dashboard-nav-link");
const { DashboardNavMenu } = await import("../dashboard-nav-menu");
const { NotificationList } = await import("./notification-list");
const { RefreshOnNavigation } = await import("./refresh-on-navigation");
const { sendRead } = await import("./send");
const { BADGE_MAX, UnreadBadge } = await import("./unread-badge");

const fetchMock = vi.fn<typeof fetch>();
const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async () => answer({ unread: 0 }));
  nav.push.mockReset();
  nav.refresh.mockReset();
  nav.pathname = "/dashboard/notifications";
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const UNREAD: NotificationItem = {
  id: "323e4567-e89b-42d3-a456-426614174002",
  typeKey: "contact_message",
  section: "messages",
  href: "/dashboard/messages",
  readAt: null,
  createdAt: "2026-11-12T10:00:00.000Z",
};
const READ: NotificationItem = {
  id: "423e4567-e89b-42d3-a456-426614174003",
  typeKey: "account_new",
  section: "overview",
  href: "/dashboard",
  readAt: "2026-11-12T11:00:00.000Z",
  createdAt: "2026-11-12T09:00:00.000Z",
};

function show(items: NotificationItem[], unread: number, locale: "ar" | "en" = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ DashboardNotifications: locale === "ar" ? ar : en }}
    >
      <NotificationList items={items} unread={unread} />
    </NextIntlClientProvider>,
  );
}

const sent = (call: number) => {
  const [url, init] = fetchMock.mock.calls[call] ?? [];
  return { url, method: init?.method, body: JSON.parse(String(init?.body)) as unknown };
};

describe("UnreadBadge", () => {
  it("is absent at zero", () => {
    const { container } = render(<UnreadBadge count={0} text="0" label="0 unread" />);
    expect(container.innerHTML).toBe("");
  });

  it("shows the number and reads its text alternative instead", () => {
    const { container } = render(
      <UnreadBadge count={3} text="3" label="3 unread notifications" />,
    );
    const badge = container.querySelector("[data-unread-badge]");
    expect(badge?.textContent).toBe("33 unread notifications");
    expect(badge?.querySelector('[aria-hidden="true"]')?.textContent).toBe("3");
    expect(badge?.querySelector(".sr-only")?.textContent).toBe("3 unread notifications");
    expect(BADGE_MAX).toBe(99);
  });
});

describe("the menu with the counter", () => {
  function Menu({ count }: { count: number }) {
    const badge = <UnreadBadge count={count} text={String(count)} label={`${count} unread`} />;
    return (
      <DashboardNavMenu label="Dashboard menu" badge={badge}>
        <li>
          <DashboardNavLink href="/dashboard" exact>
            Overview
          </DashboardNavLink>
        </li>
        <li>
          <DashboardNavLink href="/dashboard/notifications">
            <span>
              <span data-nav-label="">Notifications</span>
              {badge}
            </span>
          </DashboardNavLink>
        </li>
      </DashboardNavMenu>
    );
  }

  it("shows no badge at zero, on the button or the entry", () => {
    const { container } = render(<Menu count={0} />);
    expect(container.querySelector("[data-unread-badge]")).toBeNull();
    expect(screen.getByRole("link", { name: "Notifications" })).toBeTruthy();
  });

  it("shows the count on the phone's button and on the entry, with its text alternative", () => {
    const { container } = render(<Menu count={3} />);
    expect(container.querySelectorAll("[data-unread-badge]")).toHaveLength(2);
    // The entry is hidden while the list is folded, so look it up by its text.
    const entry = screen.getByText("Notifications", { selector: "[data-nav-label]" }).closest("a");
    expect(entry?.textContent).toContain("3 unread");
    const button = container.querySelector("button");
    expect(within(button as HTMLElement).getByText("3 unread")).toBeTruthy();
  });

  it("names the current entry on the button without the counter's text", () => {
    const { container } = render(<Menu count={3} />);
    const name = container.querySelector("button span.truncate");
    expect(name?.textContent).toBe("Dashboard menu: Notifications");
  });
});

describe("RefreshOnNavigation", () => {
  it("reads the layout again when the page changes, and not before", () => {
    const { rerender } = render(<RefreshOnNavigation />);
    expect(nav.refresh).not.toHaveBeenCalled();
    rerender(<RefreshOnNavigation />);
    expect(nav.refresh).not.toHaveBeenCalled();
    nav.pathname = "/dashboard/messages";
    rerender(<RefreshOnNavigation />);
    expect(nav.refresh).toHaveBeenCalledTimes(1);
    rerender(<RefreshOnNavigation />);
    expect(nav.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("NotificationList", () => {
  it("lists each notification as a link to its section, with its label and state", () => {
    show([UNREAD, READ], 1);
    const rows = within(screen.getByRole("list", { name: en.listLabel })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    const first = within(rows[0] as HTMLElement).getByRole("link");
    expect(first.getAttribute("href")).toBe("/dashboard/messages");
    expect(first.textContent).toContain(en.types.contact_message);
    expect(first.textContent).toContain("Opens Messages");
    expect(first.textContent).toContain(en.row.unread);
    const second = within(rows[1] as HTMLElement).getByRole("link");
    expect(second.getAttribute("href")).toBe("/dashboard");
    expect(second.textContent).toContain(en.types.account_new);
    expect(second.textContent).toContain(en.row.read);
    expect(screen.getByRole("status").textContent).toBe("1 unread notification");
    // The time is in the row, with its machine-readable value.
    expect(first.querySelector("time")?.getAttribute("datetime")).toBe(UNREAD.createdAt);
  });

  it("shows Arabic copy in Arabic", () => {
    show([UNREAD], 1, "ar");
    const link = screen.getByRole("link");
    expect(link.textContent).toContain(ar.types.contact_message);
    expect(link.textContent).toContain(ar.row.unread);
    expect(screen.getByRole("button", { name: ar.markAll })).toBeTruthy();
  });

  it("opening an unread notification marks it read, then goes to its section", async () => {
    show([UNREAD, READ], 1);
    await act(async () => {
      fireEvent.click(screen.getAllByRole("link")[0] as HTMLElement);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent(0)).toEqual({
      url: "/api/notifications/read",
      method: "POST",
      body: { ids: [UNREAD.id] },
    });
    expect(nav.push).toHaveBeenCalledWith("/dashboard/messages");
  });

  it("still opens the section when marking fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    show([UNREAD], 1);
    await act(async () => {
      fireEvent.click(screen.getByRole("link"));
    });
    expect(nav.push).toHaveBeenCalledWith("/dashboard/messages");
  });

  it("opening a read notification sends nothing: the link just opens", async () => {
    show([READ], 0);
    const link = screen.getByRole("link");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    await act(async () => {
      link.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("a click that opens a new tab marks it read and leaves the link alone", async () => {
    show([UNREAD], 1);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
    await act(async () => {
      screen.getByRole("link").dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    expect(sent(0).body).toEqual({ ids: [UNREAD.id] });
    expect(nav.push).not.toHaveBeenCalled();
    expect(nav.refresh).toHaveBeenCalledTimes(1);
  });

  it("mark all as read sends no ids, says so, and reads the page again", async () => {
    show([UNREAD, READ], 1);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.markAll }));
    });
    expect(sent(0)).toEqual({ url: "/api/notifications/read", method: "POST", body: {} });
    expect(screen.getAllByRole("status").some((el) => el.textContent === en.markedAll)).toBe(true);
    expect(nav.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the server's message when mark all fails, and doesn't refresh", async () => {
    fetchMock.mockResolvedValueOnce(
      answer({ error: { code: "internal_error", message: "Server said no." } }, 500),
    );
    show([UNREAD], 1);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.markAll }));
    });
    expect(screen.getByRole("alert").textContent).toBe("Server said no.");
    expect(nav.refresh).not.toHaveBeenCalled();
  });

  it("falls back to its own message when the request never arrives", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    show([UNREAD], 1);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.markAll }));
    });
    expect(screen.getByRole("alert").textContent).toBe(en.failed);
  });

  it("disables mark all when nothing is unread", () => {
    show([READ], 0);
    const button = screen.getByRole("button", { name: en.markAll });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("No unread notifications");
  });

  it("works by keyboard: the rows are links and mark all is a button", () => {
    show([UNREAD, READ], 1);
    for (const link of screen.getAllByRole("link")) {
      expect(link.tagName).toBe("A");
      expect(link.getAttribute("href")).toBeTruthy();
      expect(link.getAttribute("tabindex")).toBeNull();
    }
    expect(screen.getByRole("button", { name: en.markAll }).tagName).toBe("BUTTON");
  });
});

describe("sendRead", () => {
  it("sends the ids, or an empty object for all, and returns the count", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => answer({ unread: 2 }));
    expect(await sendRead(["a"], { fetchImpl })).toEqual({ ok: true, unread: 2 });
    expect(await sendRead(undefined, { fetchImpl })).toEqual({ ok: true, unread: 2 });
    expect(fetchImpl.mock.calls.map((call) => String(call[1]?.body))).toEqual([
      '{"ids":["a"]}',
      "{}",
    ]);
  });

  it("is a failure when the answer isn't the counter", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => answer({ unread: -1 }));
    expect(await sendRead(undefined, { fetchImpl })).toEqual({ ok: false, message: null });
  });

  it("passes on the server's message, and only a string", async () => {
    const withText = vi.fn<typeof fetch>(async () =>
      answer({ error: { code: "unauthenticated", message: "Sign in." } }, 401),
    );
    expect(await sendRead(undefined, { fetchImpl: withText })).toEqual({
      ok: false,
      message: "Sign in.",
    });
    const odd = vi.fn<typeof fetch>(async () => answer({ error: { message: { a: 1 } } }, 500));
    expect(await sendRead(undefined, { fetchImpl: odd })).toEqual({ ok: false, message: null });
  });
});
