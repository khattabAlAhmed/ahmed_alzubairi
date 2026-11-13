// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/AccountProfile.json";
import en from "@/messages/en/AccountProfile.json";

const clerk = vi.hoisted(() => ({
  updatePassword: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: { updatePassword: clerk.updatePassword } }),
  useReverification: (fn: unknown) => fn,
  useClerk: () => ({ signOut: clerk.signOut }),
}));
vi.mock("@clerk/nextjs/errors", () => ({
  isClerkAPIResponseError: (error: unknown) =>
    typeof error === "object" && error !== null && "errors" in error,
  isReverificationCancelledError: (error: unknown) =>
    (error as { cancelled?: boolean } | null)?.cancelled === true,
}));
const nav = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => nav,
  usePathname: () => "/account/profile",
}));

const { changedFields, DetailsForm, timeZones } = await import("./details-form");
const { DisableAccount } = await import("./disable-account");
const { LanguageForm } = await import("./language-form");
const { NotifySwitch } = await import("./notify-switch");
const { PasswordForm, passwordErrorKey } = await import("./password-form");

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: true })));
  nav.refresh.mockReset();
  nav.replace.mockReset();
  clerk.updatePassword.mockReset().mockResolvedValue({});
  clerk.signOut.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wrap(node: ReactNode, locale: "ar" | "en" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ AccountProfile: locale === "ar" ? ar : en }}>
      {node}
    </NextIntlClientProvider>,
  );
}

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1) ?? [];
  return { url, method: init?.method, body: JSON.parse(String(init?.body)) };
}

const SAVED = {
  phone: "+966500000000",
  orgType: "company" as const,
  orgName: "Example Co",
  jobTitle: null,
  timezone: "Asia/Riyadh",
};

describe("changedFields", () => {
  it("sends only what changed, with the phone tidied", () => {
    expect(
      changedFields(SAVED, { ...SAVED, phone: "٠٥٠ ١٢٣ ٤٥٦٧", jobTitle: " Analyst " }),
    ).toEqual({ body: { phone: "0501234567", jobTitle: "Analyst" }, emptied: [] });
    expect(changedFields(SAVED, SAVED)).toEqual({ body: {}, emptied: [] });
  });

  it("reports a saved text field that was emptied, and doesn't send it", () => {
    expect(changedFields(SAVED, { ...SAVED, orgName: "  " })).toEqual({
      body: {},
      emptied: ["orgName"],
    });
  });

  it("keeps a saved time zone the browser doesn't list", () => {
    expect(timeZones("Mars/Olympus")[0]).toBe("Mars/Olympus");
  });
});

describe("DetailsForm", () => {
  const show = () => wrap(<DetailsForm saved={SAVED} fullName="Test Client" email="client@example.com" />);

  it("saves the changed fields, then refreshes", async () => {
    show();
    fireEvent.change(screen.getByLabelText(en.details.jobTitle), { target: { value: "Analyst" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.details.save })));
    expect(lastRequest()).toEqual({ url: "/api/profile", method: "PATCH", body: { jobTitle: "Analyst" } });
    expect(screen.getByRole("status").textContent).toBe(en.details.saved);
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("refuses an emptied field and a bad phone before sending", async () => {
    show();
    fireEvent.change(screen.getByLabelText(en.details.orgName), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(en.details.phone), { target: { value: "12" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.details.save })));
    expect(screen.getByText(en.details.cantEmpty)).toBeTruthy();
    expect(screen.getByText(en.details.phoneInvalid)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says when nothing changed, and sends nothing", async () => {
    show();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.details.save })));
    expect(screen.getByRole("status").textContent).toBe(en.details.nothing);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's error text", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "validation_failed", message: "Bad." } }), { status: 400 }),
    );
    show();
    fireEvent.change(screen.getByLabelText(en.details.jobTitle), { target: { value: "Analyst" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.details.save })));
    expect(screen.getByRole("alert").textContent).toBe("Bad.");
  });

  it("shows name and email as text", () => {
    const { container } = wrap(
      <DetailsForm saved={SAVED} fullName="<img src=x onerror=alert(1)>" email="client@example.com" />,
    );
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("LanguageForm", () => {
  it("saves the language, then switches the UI to it", async () => {
    wrap(<LanguageForm saved="ar" />);
    fireEvent.change(screen.getByLabelText(en.language.label), { target: { value: "en" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.language.save })));
    expect(lastRequest().body).toEqual({ locale: "en" });
    expect(nav.replace).toHaveBeenCalledWith("/account/profile", { locale: "en" });
  });

  it("stays put when the save fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    wrap(<LanguageForm saved="ar" />);
    fireEvent.change(screen.getByLabelText(en.language.label), { target: { value: "en" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.language.save })));
    expect(nav.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(en.language.failed);
  });
});

describe("NotifySwitch", () => {
  it("names what it covers, and turns off and on", async () => {
    wrap(<NotifySwitch saved />);
    const toggle = screen.getByRole("switch", { name: en.notifications.label });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(en.notifications.covers)).toBeTruthy();
    await act(async () => fireEvent.click(toggle));
    expect(lastRequest().body).toEqual({ notifyOptional: false });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    await act(async () => fireEvent.click(toggle));
    expect(lastRequest().body).toEqual({ notifyOptional: true });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("keeps its state when the save fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    wrap(<NotifySwitch saved={false} />);
    const toggle = screen.getByRole("switch");
    await act(async () => fireEvent.click(toggle));
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("alert").textContent).toBe(en.notifications.failed);
  });
});

describe("PasswordForm", () => {
  function fill(next: string, repeat = next) {
    fireEvent.change(screen.getByLabelText(en.password.current), { target: { value: "old password 1" } });
    fireEvent.change(screen.getByLabelText(en.password.new), { target: { value: next } });
    fireEvent.change(screen.getByLabelText(en.password.confirm), { target: { value: repeat } });
  }

  it("changes the password through Clerk, signing out other devices by default", async () => {
    wrap(<PasswordForm />);
    fill("a new password 12");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.password.save })));
    expect(clerk.updatePassword).toHaveBeenCalledWith({
      currentPassword: "old password 1",
      newPassword: "a new password 12",
      signOutOfOtherSessions: true,
    });
    expect(screen.getByRole("status").textContent).toBe(en.password.saved);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks length and the repeat before calling Clerk", async () => {
    wrap(<PasswordForm />);
    fill("short", "other");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.password.save })));
    expect(screen.getByText(en.password.tooShort)).toBeTruthy();
    expect(screen.getByText(en.password.mismatch)).toBeTruthy();
    expect(clerk.updatePassword).not.toHaveBeenCalled();
  });

  it("shows Clerk's refusal in the user's language", async () => {
    clerk.updatePassword.mockRejectedValueOnce({ errors: [{ code: "form_password_incorrect" }] });
    wrap(<PasswordForm />, "ar");
    fireEvent.change(screen.getByLabelText(ar.password.current), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText(ar.password.new), { target: { value: "a new password 12" } });
    fireEvent.change(screen.getByLabelText(ar.password.confirm), { target: { value: "a new password 12" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: ar.password.save })));
    expect(screen.getByRole("alert").textContent).toBe(ar.password.incorrect);
  });

  it("says nothing when the user closes Clerk's reverification", async () => {
    clerk.updatePassword.mockRejectedValueOnce({ cancelled: true });
    wrap(<PasswordForm />);
    fill("a new password 12");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.password.save })));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    [{ errors: [{ code: "form_password_pwned" }] }, "pwned"],
    [{ errors: [{ code: "form_password_length_too_short" }] }, "tooShort"],
    [{ errors: [{ code: "form_password_validation_failed" }] }, "weak"],
    [{ errors: [{ code: "rate_limit_exceeded" }] }, "failed"],
    [new Error("network"), "failed"],
  ])("maps %o to %s", (error, key) => {
    expect(passwordErrorKey(error)).toBe(key);
  });
});

describe("DisableAccount", () => {
  it("needs two steps and the admin-only tick, then signs out", async () => {
    wrap(<DisableAccount />);
    expect(screen.getByText(en.disable.adminOnly)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.disable.start }));
    const confirm = screen.getByRole("button", { name: en.disable.confirm }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(en.disable.understand));
    expect(confirm.disabled).toBe(false);
    await act(async () => fireEvent.click(confirm));
    expect(lastRequest()).toEqual({ url: "/api/account/disable", method: "POST", body: {} });
    expect(clerk.signOut).toHaveBeenCalledWith({ redirectUrl: "/en" });
  });

  it("cancel closes the confirm and sends nothing", () => {
    wrap(<DisableAccount />);
    fireEvent.click(screen.getByRole("button", { name: en.disable.start }));
    fireEvent.click(screen.getByRole("button", { name: en.disable.cancel }));
    expect(screen.queryByRole("button", { name: en.disable.confirm })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's error and stays signed in", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "forbidden", message: en.errors.teamMember } }), {
        status: 403,
      }),
    );
    wrap(<DisableAccount />);
    fireEvent.click(screen.getByRole("button", { name: en.disable.start }));
    fireEvent.click(screen.getByLabelText(en.disable.understand));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.disable.confirm })));
    expect(screen.getByRole("alert").textContent).toBe(en.errors.teamMember);
    expect(clerk.signOut).not.toHaveBeenCalled();
  });
});
