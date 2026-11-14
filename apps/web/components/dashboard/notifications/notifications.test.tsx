// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import arContent from "@/messages/ar/DashboardContent.json";
import ar from "@/messages/ar/DashboardNotifications.json";
import enContent from "@/messages/en/DashboardContent.json";
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

// The server menu's sources: a signed-in, active team member who holds no
// permission at all, with nothing unread.
const server = vi.hoisted(() => ({ locale: "en" as "ar" | "en" }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: "user_member" }) }));
vi.mock("@/lib/auth/gates", () => ({
  readOwnProfile: async () => ({ role_id: "role-1", status: "active" }),
}));
vi.mock("../access", () => ({ grantedPermissions: async () => new Set() }));
vi.mock("./data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./data")>()),
  loadUnreadCount: async () => 0,
}));
vi.mock("next-intl/server", async () => {
  const arMessages = (await import("@/messages/ar/DashboardNotifications.json")).default;
  const enMessages = (await import("@/messages/en/DashboardNotifications.json")).default;
  const arNav = (await import("@/messages/ar/DashboardContent.json")).default;
  const enNav = (await import("@/messages/en/DashboardContent.json")).default;
  const { createTranslator: translator } = await import("next-intl");
  return {
    getTranslations: async (namespace: "DashboardContent" | "DashboardNotifications") => {
      const messages =
        server.locale === "ar"
          ? { DashboardContent: arNav, DashboardNotifications: arMessages }
          : { DashboardContent: enNav, DashboardNotifications: enMessages };
      return translator({ locale: server.locale, messages, namespace });
    },
  };
});

const { DashboardNavLink } = await import("../dashboard-nav-link");
const { DashboardNavMenu } = await import("../dashboard-nav-menu");
const { DashboardNav } = await import("../dashboard-nav");
const { notificationsPath, parsePage } = await import("./data");
const { NotificationList, OPEN_WAIT_MS } = await import("./notification-list");
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

describe("the dashboard menu's profile entry", () => {
  async function showNav(locale: "ar" | "en") {
    server.locale = locale;
    const menu = await DashboardNav({ params: Promise.resolve({ locale }) });
    return render(
      <NextIntlClientProvider
        locale={locale}
        messages={{
          DashboardContent: locale === "ar" ? arContent : enContent,
          DashboardNotifications: locale === "ar" ? ar : en,
        }}
      >
        {menu}
      </NextIntlClientProvider>,
    );
  }

  it.each([
    ["en", "My profile"],
    ["ar", "ملفي الشخصي"],
  ] as const)("shows a member with no permission the profile link, in %s", async (locale, label) => {
    await showNav(locale);
    const link = screen.getByRole("link", { name: label });
    expect(link.getAttribute("href")).toBe("/account/profile");
    // Next to Notifications, in the one list the phone folds away.
    const items = within(screen.getByRole("navigation")).getAllByRole("listitem");
    const names = items.map((item) => item.textContent);
    expect(names.at(-1)).toBe(label);
    expect(names.at(-2)).toBe(locale === "ar" ? ar.nav : en.nav);
    // Every other section needs a permission this member doesn't hold.
    expect(names).toEqual([
      (locale === "ar" ? arContent : enContent).nav.home,
      locale === "ar" ? ar.nav : en.nav,
      label,
    ]);
  });

  it("is in the phone's folded list, which opens from the menu button", async () => {
    await showNav("en");
    const button = screen.getByRole("button", { expanded: false });
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const list = document.getElementById(button.getAttribute("aria-controls") ?? "");
    expect(list?.className).toContain("flex");
    expect(within(list!).getByRole("link", { name: "My profile" })).toBeTruthy();
  });

  it("is not current on a dashboard page", async () => {
    nav.pathname = "/dashboard";
    await showNav("en");
    expect(screen.getByRole("link", { name: "My profile" }).getAttribute("aria-current")).toBeNull();
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

  it("shows the server's message when mark all fails, and reads the page again", async () => {
    fetchMock.mockResolvedValueOnce(
      answer({ error: { code: "internal_error", message: "Server said no." } }, 500),
    );
    show([UNREAD], 1);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.markAll }));
    });
    expect(screen.getByRole("alert").textContent).toBe("Server said no.");
    // The rows may be marked although the answer failed.
    expect(nav.refresh).toHaveBeenCalledTimes(1);
  });

  it("drops the failure once the page shows the change was saved", async () => {
    fetchMock.mockResolvedValueOnce(
      answer({ error: { code: "internal_error", message: "Server said no." } }, 500),
    );
    const view = show([UNREAD], 1);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.markAll }));
    });
    expect(screen.getByRole("alert")).toBeTruthy();
    // The refresh brings the same count: the failure stays.
    view.rerender(
      <NextIntlClientProvider locale="en" messages={{ DashboardNotifications: en }}>
        <NotificationList items={[UNREAD]} unread={1} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    // Another action read one of two: mark all still didn't finish.
    view.rerender(
      <NextIntlClientProvider locale="en" messages={{ DashboardNotifications: en }}>
        <NotificationList items={[UNREAD, { ...UNREAD, id: READ.id }]} unread={2} />
      </NextIntlClientProvider>,
    );
    view.rerender(
      <NextIntlClientProvider locale="en" messages={{ DashboardNotifications: en }}>
        <NotificationList items={[UNREAD, READ]} unread={1} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("alert").textContent).toBe("Server said no.");
    // The refresh brings zero: it was saved after all.
    view.rerender(
      <NextIntlClientProvider locale="en" messages={{ DashboardNotifications: en }}>
        <NotificationList items={[{ ...UNREAD, readAt: READ.readAt }]} unread={0} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a read request that hangs doesn't keep the member from the section", async () => {
    vi.useFakeTimers();
    try {
      let settle: (response: Response) => void = () => {};
      fetchMock.mockImplementationOnce(
        () => new Promise<Response>((resolve) => (settle = resolve)),
      );
      show([UNREAD, { ...UNREAD, id: READ.id, href: "/dashboard" }], 2);
      const [first, second] = screen.getAllByRole("link");
      await act(async () => {
        fireEvent.click(first);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(nav.push).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(OPEN_WAIT_MS);
      });
      expect(nav.push).toHaveBeenCalledWith("/dashboard/messages");
      // The mark lands late: the count is read again then, and not before.
      expect(nav.refresh).not.toHaveBeenCalled();
      await act(async () => settle(answer({ unread: 1 })));
      expect(nav.refresh).toHaveBeenCalledTimes(1);
      // The list takes clicks again.
      await act(async () => {
        fireEvent.click(second);
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ["moves to another page", "navigate"],
    ["leaves the list", "unmount"],
  ] as const)("a pending open doesn't push once the member %s", async (_label, how) => {
    vi.useFakeTimers();
    try {
      let settle: (response: Response) => void = () => {};
      fetchMock.mockImplementationOnce(
        () => new Promise<Response>((resolve) => (settle = resolve)),
      );
      const view = show([UNREAD], 1);
      await act(async () => {
        fireEvent.click(screen.getByRole("link"));
      });
      if (how === "navigate") {
        nav.pathname = "/dashboard/content";
        view.rerender(
          <NextIntlClientProvider locale="en" messages={{ DashboardNotifications: en }}>
            <NotificationList items={[UNREAD]} unread={1} />
          </NextIntlClientProvider>,
        );
      } else {
        view.unmount();
      }
      await act(async () => {
        await vi.advanceTimersByTimeAsync(OPEN_WAIT_MS);
      });
      expect(nav.push).not.toHaveBeenCalled();
      // The mark still lands, and the count is read again.
      await act(async () => settle(answer({ unread: 0 })));
      expect(nav.refresh).toHaveBeenCalledTimes(1);
      expect(nav.push).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a mark that lands before the wait ends, after the member moved on, still refreshes the count", async () => {
    let settle: (response: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => (settle = resolve)),
    );
    const view = show([UNREAD], 1);
    await act(async () => {
      fireEvent.click(screen.getByRole("link"));
    });
    nav.pathname = "/dashboard/content";
    view.rerender(
      <NextIntlClientProvider locale="en" messages={{ DashboardNotifications: en }}>
        <NotificationList items={[UNREAD]} unread={1} />
      </NextIntlClientProvider>,
    );
    await act(async () => settle(answer({ unread: 0 })));
    expect(nav.push).not.toHaveBeenCalled();
    expect(nav.refresh).toHaveBeenCalledTimes(1);
  });

  it("a pending open still pushes when the page didn't change", async () => {
    let settle: (response: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => (settle = resolve)),
    );
    const view = show([UNREAD], 1);
    await act(async () => {
      fireEvent.click(screen.getByRole("link"));
    });
    // A refresh renders the list again on the same page.
    view.rerender(
      <NextIntlClientProvider locale="en" messages={{ DashboardNotifications: en }}>
        <NotificationList items={[UNREAD]} unread={1} />
      </NextIntlClientProvider>,
    );
    await act(async () => settle(answer({ unread: 0 })));
    expect(nav.push).toHaveBeenCalledWith("/dashboard/messages");
  });

  it("a second open waits for the first: one request, one destination", async () => {
    const OTHER: NotificationItem = { ...UNREAD, id: READ.id, section: "overview", href: "/dashboard" };
    let finish: (value: Response) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (finish = resolve)));
    show([UNREAD, OTHER], 2);
    const [first, second] = screen.getAllByRole("link") as [HTMLElement, HTMLElement];
    fireEvent.click(first);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    second.dispatchEvent(event);
    // The second click neither navigates on its own nor sends a request.
    expect(event.defaultPrevented).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish(answer({ unread: 1 }));
    });
    expect(nav.push.mock.calls).toEqual([["/dashboard/messages"]]);
  });

  it("a middle click marks it read and leaves the new tab to the browser", async () => {
    show([UNREAD, READ], 1);
    const [unreadLink, readLink] = screen.getAllByRole("link") as [HTMLElement, HTMLElement];
    const event = new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 });
    await act(async () => {
      unreadLink.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    expect(sent(0).body).toEqual({ ids: [UNREAD.id] });
    expect(nav.push).not.toHaveBeenCalled();
    expect(nav.refresh).toHaveBeenCalledTimes(1);
    // A right click, and a middle click on a read one, send nothing.
    await act(async () => {
      fireEvent(unreadLink, new MouseEvent("auxclick", { bubbles: true, button: 2 }));
      fireEvent(readLink, new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

describe("the list's pages", () => {
  it("reads a whole page number from 1, and falls back to 1", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2", "9"])).toBe(2);
    for (const raw of [undefined, "", "0", "-1", "1.5", "abc", "1e3", " 2", "9999999"]) {
      expect(parsePage(raw)).toBe(1);
    }
  });

  it("leaves page 1 out of the address", () => {
    expect(notificationsPath(1)).toBe("/dashboard/notifications");
    expect(notificationsPath(3)).toBe("/dashboard/notifications?page=3");
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
