// @vitest-environment jsdom
import { PERMISSIONS, type Permission } from "@repo/shared";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/DashboardClients.json";
import en from "@/messages/en/DashboardClients.json";
import { AccountControl, sendStatus } from "./account-control";
import { CLIENT_COLUMNS } from "@/lib/admin/clients/store";
import { clientAccess, loadClient } from "./data";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh }) }));

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: true })));
  refresh.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function show(status: "active" | "disabled", locale: "ar" | "en" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ DashboardClients: locale === "ar" ? ar : en }}>
      <AccountControl id="user_client" name="Test Client" status={status} />
    </NextIntlClientProvider>,
  );
}

describe("clientAccess", () => {
  const params = Promise.resolve({ locale: "en" });
  const grant = (keys: Permission[]) => vi.fn(async () => new Set<Permission>(keys));

  it.each([
    [[PERMISSIONS.CLIENTS_VIEW_ALL], true, true],
    [[PERMISSIONS.CONSULTATIONS_REPLY], true, false],
    [[PERMISSIONS.TRAINING_MANAGE], true, false],
    [[], false, false],
  ] as const)("with %j: opens %s, manages %s", async (keys, allowed, canManage) => {
    const check = grant([...keys]);
    expect(await clientAccess(params, check)).toEqual({ locale: "en", allowed, canManage });
    expect(check).toHaveBeenCalledWith(
      [PERMISSIONS.CLIENTS_VIEW_ALL, PERMISSIONS.CONSULTATIONS_REPLY, PERMISSIONS.TRAINING_MANAGE],
      "en",
    );
  });
});

describe("loadClient", () => {
  function recorder(result: unknown) {
    const calls: unknown[][] = [];
    const query: Record<string, unknown> = {};
    for (const name of ["from", "select", "eq", "is"]) {
      query[name] = (...args: unknown[]) => {
        calls.push([name, ...args]);
        return query;
      };
    }
    query.maybeSingle = async () => result;
    return { calls, client: query as never };
  }

  const ROW = {
    clerk_user_id: "user_client",
    full_name: "Test Client",
    email: "client@example.com",
    phone: "+966500000000",
    org_type: "company",
    org_name: "Example Co",
    job_title: null,
    locale: "ar",
    status: "disabled",
    created_at: "2026-11-07T10:00:00+00:00",
  };

  it("reads one client with no role, through the given client", async () => {
    const { calls, client } = recorder({ data: ROW, error: null });
    expect(await loadClient("user_client", client)).toMatchObject({
      id: "user_client",
      orgType: "company",
      status: "disabled",
      createdAt: "2026-11-07T10:00:00.000Z",
    });
    expect(calls).toEqual([
      ["from", "profiles"],
      ["select", CLIENT_COLUMNS],
      ["eq", "clerk_user_id", "user_client"],
      ["is", "role_id", null],
    ]);
  });

  it("is null when RLS shows no such client", async () => {
    const { client } = recorder({ data: null, error: null });
    expect(await loadClient("user_other", client)).toBeNull();
  });

  it("throws on a database error", async () => {
    const { client } = recorder({ data: null, error: { code: "42501" } });
    await expect(loadClient("user_client", client)).rejects.toThrow("42501");
  });
});

describe("AccountControl", () => {
  it("asks first, saying open consultations will be closed", () => {
    show("active");
    fireEvent.click(screen.getByRole("button", { name: en.account.disable }));
    expect(screen.getByText(/open consultations will be closed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.account.cancel }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says it in Arabic too", () => {
    show("active", "ar");
    fireEvent.click(screen.getByRole("button", { name: ar.account.disable }));
    expect(screen.getByText(/ستُغلق استشاراته المفتوحة/)).toBeTruthy();
  });

  it("disables through the clients route, then refreshes", async () => {
    show("active");
    fireEvent.click(screen.getByRole("button", { name: en.account.disable }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.account.confirm })));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/clients",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ id: "user_client", status: "disabled" }) }),
    );
    expect(screen.getByRole("status").textContent).toBe(en.account.disabledDone);
    expect(refresh).toHaveBeenCalled();
  });

  it("reactivates a disabled client", async () => {
    show("disabled");
    fireEvent.click(screen.getByRole("button", { name: en.account.enable }));
    expect(screen.getByText(/stay closed/)).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.account.confirm })));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      id: "user_client",
      status: "active",
    });
  });

  it("shows the server's error text, or its own", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "internal_error", message: "Clerk is down." } }), {
        status: 502,
      }),
    );
    show("active");
    fireEvent.click(screen.getByRole("button", { name: en.account.disable }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.account.confirm })));
    expect(screen.getByRole("alert").textContent).toBe("Clerk is down.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("sendStatus returns no text when the network fails", async () => {
    const down = vi.fn<typeof fetch>(async () => {
      throw new TypeError("offline");
    });
    expect(await sendStatus("user_client", "active", down)).toEqual({ ok: false, message: null });
  });
});
