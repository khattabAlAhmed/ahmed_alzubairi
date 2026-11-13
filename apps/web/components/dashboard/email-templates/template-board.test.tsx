// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultTemplate,
  templateEntries,
} from "@/lib/admin/email-templates/templates";
import en from "@/messages/en/DashboardEmailTemplates.json";

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: nav.refresh }),
}));
// The preview draws a whole email document; these tests are about the form.
vi.mock("./email-preview", () => ({ EmailPreview: () => null }));

// jsdom has no matchMedia. Wide screen: both language panels side by side.
window.matchMedia = ((query: string) => ({
  matches: true,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia;

const { TemplateBoard } = await import("./template-board");

const fetchMock = vi.fn<typeof fetch>();
const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const sentBodies = () =>
  fetchMock.mock.calls.map(([, init]) => ({
    method: init?.method,
    body: JSON.parse(String(init?.body)) as Record<string, string>,
  }));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async () => answer({ ok: true }));
  nav.refresh.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const contact = defaultTemplate("contact_message");

function show(saved = templateEntries([])) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ DashboardEmailTemplates: en }}>
      <TemplateBoard templates={saved} />
    </NextIntlClientProvider>,
  );
}

const openContact = () =>
  fireEvent.click(screen.getByRole("button", { name: "Edit: Contact message" }));
const field = (name: string) =>
  document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name=${name}]`)!;
const type = (name: string, value: string) =>
  fireEvent.change(field(name), { target: { value } });
const save = () =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name: en.save }));
  });

describe("TemplateBoard", () => {
  it("lists the 13 events by name, each marked default or edited", () => {
    show(templateEntries([{ ...contact, bodyEn: "Mine" }]));
    expect(screen.getAllByRole("listitem")).toHaveLength(13);
    expect(screen.getAllByText(en.status.edited)).toHaveLength(1);
    expect(screen.getAllByText(en.status.default)).toHaveLength(12);
    expect(screen.getByRole("heading", { name: "Meeting reminder" })).toBeTruthy();
  });

  it("opens one editor at a time, with that event's placeholders", () => {
    show();
    openContact();
    expect(field("subjectEn").value).toBe(contact.subjectEn);
    expect(screen.getByText("{{name}}")).toBeTruthy();
    expect(screen.queryByText("{{title}}")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit: Meeting" }));
    expect(screen.getByText("{{startsAt}}")).toBeTruthy();
    expect(screen.queryByText("{{name}}")).toBeNull();
  });

  it("names an unknown placeholder and sends nothing; correcting the field clears the error", async () => {
    show();
    openContact();
    type("bodyEn", "Hello {{title}}");
    await save();
    expect(fetchMock).not.toHaveBeenCalled();
    const alerts = screen.getAllByRole("alert").map((alert) => alert.textContent);
    expect(alerts.some((text) => text?.includes("{{title}}"))).toBe(true);
    expect(alerts).toContain(en.fixErrors);
    expect(field("bodyEn").getAttribute("aria-invalid")).toBe("true");

    type("bodyEn", "Hello {{name}}");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(field("bodyEn").getAttribute("aria-invalid")).toBeNull();
  });

  it("saves the four texts with PATCH and reads the page again", async () => {
    show();
    openContact();
    type("subjectAr", "[رسالة] {{subject}}");
    await save();
    expect(sentBodies()).toEqual([
      { method: "PATCH", body: { ...contact, subjectAr: "[رسالة] {{subject}}" } },
    ]);
    expect(screen.getByRole("status").textContent).toBe(en.saved);
    expect(nav.refresh).toHaveBeenCalledTimes(1);
  });

  it("compares the next save with what was just saved, before the page is read again", async () => {
    show();
    openContact();
    type("bodyEn", "B");
    await save();
    // Back to the text the page loaded with: that is a change now.
    type("bodyEn", contact.bodyEn);
    await save();
    expect(sentBodies().map((sent) => sent.body.bodyEn)).toEqual(["B", contact.bodyEn]);
    // The same text again is not.
    await save();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status").textContent).toBe(en.unchanged);
  });

  it("keeps the editor open while a save is on its way: no second save for the event", async () => {
    let settle: (response: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => (settle = resolve)),
    );
    show();
    openContact();
    type("bodyEn", "B");
    await save();
    const close = screen.getByRole<HTMLButtonElement>("button", {
      name: "Close: Contact message",
    });
    const other = screen.getByRole<HTMLButtonElement>("button", { name: "Edit: Meeting" });
    expect(close.disabled).toBe(true);
    expect(other.disabled).toBe(true);
    fireEvent.click(close);
    fireEvent.click(other);
    expect(field("bodyEn").value).toBe("B");
    // A second press of the save button sends nothing either.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(en.saving) }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => settle(answer({ ok: true })));
    expect(close.disabled).toBe(false);
    expect(other.disabled).toBe(false);
  });

  it("shows the server's message when a save is refused", async () => {
    fetchMock.mockResolvedValueOnce(
      answer({ error: { code: "forbidden", message: "Server said no." } }, 403),
    );
    show();
    openContact();
    type("bodyEn", "B");
    await save();
    expect(screen.getByRole("alert").textContent).toBe("Server said no.");
    expect(nav.refresh).not.toHaveBeenCalled();
  });

  it("offers reset only for an edited template, asks first, then brings the default back", async () => {
    show();
    openContact();
    expect(screen.queryByRole("button", { name: en.reset })).toBeNull();
    cleanup();

    show(templateEntries([{ ...contact, bodyEn: "Mine", bodyAr: "نصي" }]));
    openContact();
    fireEvent.click(screen.getByRole("button", { name: en.reset }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: en.resetNo }));
    expect(field("bodyEn").value).toBe("Mine");

    fireEvent.click(screen.getByRole("button", { name: en.reset }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.resetYes }));
    });
    expect(sentBodies()).toEqual([
      { method: "DELETE", body: { event: "contact_message" } },
    ]);
    expect(field("bodyEn").value).toBe(contact.bodyEn);
    expect(field("bodyAr").value).toBe(contact.bodyAr);
    expect(screen.getByRole("status").textContent).toBe(en.resetDone);
    expect(screen.queryByRole("button", { name: en.reset })).toBeNull();
    expect(nav.refresh).toHaveBeenCalledTimes(1);
  });

  it("content inputs carry their own language; a typed tag stays text", () => {
    show();
    openContact();
    expect(field("subjectAr").getAttribute("dir")).toBe("rtl");
    expect(field("bodyEn").getAttribute("lang")).toBe("en");
    type("bodyEn", "<b>x</b>");
    expect(document.querySelector("form b")).toBeNull();
  });
});
