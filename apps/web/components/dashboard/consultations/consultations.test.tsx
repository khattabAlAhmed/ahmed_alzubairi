// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/DashboardConsultations.json";
import en from "@/messages/en/DashboardConsultations.json";
import arWorkspace from "@/messages/ar/Workspace.json";
import enWorkspace from "@/messages/en/Workspace.json";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => router }));

const { AssignControl, StatusControl } = await import("./consultation-controls");
const { MeetingForm, toLocalInputs, toUtc } = await import("./meetings");
const { DeleteConsultation } = await import("./delete-consultation");
const send = await import("./send");

const ID = "11111111-1111-4111-8111-111111111111";
const ok = async () => ({ ok: true as const });

function wrap(node: ReactNode, locale: "ar" | "en" = "en") {
  const messages =
    locale === "ar"
      ? { DashboardConsultations: ar, Workspace: arWorkspace }
      : { DashboardConsultations: en, Workspace: enWorkspace };
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {node}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  router.push.mockReset();
  router.refresh.mockReset();
});
afterEach(cleanup);

describe("StatusControl", () => {
  it("changes the status and refreshes", async () => {
    const update = vi.fn(ok);
    wrap(<StatusControl id={ID} status="new" update={update} />);
    fireEvent.change(screen.getByLabelText(en.status.label), { target: { value: "in_progress" } });
    fireEvent.click(screen.getByRole("button", { name: en.status.save }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith(ID, { status: "in_progress" });
  });

  it("never offers closed in the list: closing asks first", async () => {
    const update = vi.fn(ok);
    wrap(<StatusControl id={ID} status="in_review" update={update} />);
    const options = Array.from((screen.getByLabelText(en.status.label) as HTMLSelectElement).options).map((o) => o.value);
    expect(options).not.toContain("closed");
    fireEvent.click(screen.getByRole("button", { name: en.status.close }));
    expect(screen.getByText(en.status.closeQuestion)).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: en.status.closeConfirm }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(ID, { status: "closed" }));
  });

  it("shows the server's message when refused", async () => {
    const update = vi.fn(async () => ({ ok: false as const, message: "This consultation is closed." }));
    wrap(<StatusControl id={ID} status="new" update={update} />);
    fireEvent.change(screen.getByLabelText(en.status.label), { target: { value: "in_review" } });
    fireEvent.click(screen.getByRole("button", { name: en.status.save }));
    expect(await screen.findByText("This consultation is closed.")).toBeTruthy();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("AssignControl", () => {
  const assignees = [
    { id: "user_a", name: "Assistant A" },
    { id: "user_b", name: "Assistant B" },
  ];

  it("assigns a member", async () => {
    const update = vi.fn(ok);
    wrap(<AssignControl id={ID} assignedTo={null} assignees={assignees} update={update} />);
    fireEvent.change(screen.getByLabelText(en.assign.label), { target: { value: "user_b" } });
    fireEvent.click(screen.getByRole("button", { name: en.assign.save }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(ID, { assignedTo: "user_b" }));
  });

  it("unassigns with null", async () => {
    const update = vi.fn(ok);
    wrap(<AssignControl id={ID} assignedTo="user_a" assignees={assignees} update={update} />);
    fireEvent.change(screen.getByLabelText(en.assign.label), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: en.assign.save }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(ID, { assignedTo: null }));
  });
});

describe("meeting times", () => {
  it("reads the inputs in the browser's zone and stores UTC, and back", () => {
    const iso = toUtc("2026-11-20", "14:30")!;
    expect(iso).toMatch(/Z$/);
    expect(toLocalInputs(iso)).toEqual({ date: "2026-11-20", time: "14:30" });
    expect(new Date(iso).getTime()).toBe(new Date(2026, 10, 20, 14, 30).getTime());
  });

  it("refuses unreadable inputs", () => {
    expect(toUtc("", "14:30")).toBeNull();
    expect(toUtc("2026-11-20", "")).toBeNull();
    expect(toUtc("20/11/2026", "14:30")).toBeNull();
  });
});

describe("MeetingForm", () => {
  function fill(values: Partial<Record<"platform" | "url" | "date" | "time" | "duration", string>>) {
    const labels = {
      platform: en.meeting.platform,
      url: en.meeting.url,
      date: en.meeting.date,
      time: en.meeting.time,
      duration: en.meeting.duration,
    };
    for (const [key, value] of Object.entries(values)) {
      fireEvent.change(screen.getByLabelText(labels[key as keyof typeof labels]), { target: { value } });
    }
  }

  it("creates a meeting in UTC and names the member's zone", async () => {
    const create = vi.fn(ok);
    const onDone = vi.fn();
    wrap(<MeetingForm consultationId={ID} onDone={onDone} create={create} />);
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(screen.getByText(en.meeting.zone.replace("{zone}", zone))).toBeTruthy();
    fill({ platform: " Zoom ", url: "https://zoom.example/j/1", date: "2026-11-20", time: "14:30", duration: "45" });
    fireEvent.click(screen.getByRole("button", { name: en.meeting.save }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith(ID, {
      platform: "Zoom",
      url: "https://zoom.example/j/1",
      startsAt: toUtc("2026-11-20", "14:30"),
      durationMinutes: 45,
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("refuses a link that isn't https, sending nothing", async () => {
    const create = vi.fn(ok);
    wrap(<MeetingForm consultationId={ID} onDone={() => {}} create={create} />);
    fill({ platform: "Zoom", url: "http://zoom.example/j/1", date: "2026-11-20", time: "14:30" });
    fireEvent.click(screen.getByRole("button", { name: en.meeting.save }));
    expect(await screen.findByText(en.meeting.invalidUrl)).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  it("asks for every field", async () => {
    const create = vi.fn(ok);
    wrap(<MeetingForm consultationId={ID} onDone={() => {}} create={create} />);
    fireEvent.click(screen.getByRole("button", { name: en.meeting.save }));
    expect(await screen.findByText(en.meeting.required)).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  it("edits a meeting, prefilled in local time", async () => {
    const update = vi.fn(ok);
    const meeting = {
      id: "22222222-2222-4222-8222-222222222222",
      platform: "Meet",
      url: "https://meet.example/abc",
      startsAt: toUtc("2026-11-21", "09:00")!,
      durationMinutes: 30,
      createdAt: "2026-11-14T10:00:00.000Z",
    };
    wrap(<MeetingForm consultationId={ID} meeting={meeting} onDone={() => {}} update={update} />);
    expect((screen.getByLabelText(en.meeting.time) as HTMLInputElement).value).toBe("09:00");
    fill({ url: "https://meet.example/new" });
    fireEvent.click(screen.getByRole("button", { name: en.meeting.save }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(ID, {
        meetingId: meeting.id,
        platform: "Meet",
        url: "https://meet.example/new",
        startsAt: meeting.startsAt,
        durationMinutes: 30,
      }),
    );
  });

  it("renders in Arabic", () => {
    wrap(<MeetingForm consultationId={ID} onDone={() => {}} />, "ar");
    expect(screen.getByRole("button", { name: ar.meeting.save })).toBeTruthy();
  });
});

describe("DeleteConsultation", () => {
  it("deletes only after both steps, then goes back to the list", async () => {
    const remove = vi.fn(ok);
    wrap(<DeleteConsultation id={ID} title="Board charter" remove={remove} />);
    fireEvent.click(screen.getByRole("button", { name: en.delete.button }));
    fireEvent.click(screen.getByRole("button", { name: enWorkspace.confirm.continue }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: en.delete.word } });
    fireEvent.click(screen.getByRole("button", { name: en.delete.confirm }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/consultations"));
    expect(remove).toHaveBeenCalledWith(ID);
  });
});

describe("send", () => {
  it("calls the T05 and T08 routes with the right bodies", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await send.updateConsultation(ID, { assignedTo: null }, fetchImpl as never);
    await send.createMeeting(ID, { platform: "Zoom", url: "https://z.example", startsAt: "2026-11-20T10:00:00.000Z", durationMinutes: 30 }, fetchImpl as never);
    await send.deleteConsultation(ID, fetchImpl as never);
    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([url, init]) => [init.method, url, JSON.parse(init.body as string)])).toEqual([
      ["PATCH", `/api/admin/consultations/${ID}`, { assignedTo: null }],
      ["POST", `/api/admin/consultations/${ID}/meetings`, { platform: "Zoom", url: "https://z.example", startsAt: "2026-11-20T10:00:00.000Z", durationMinutes: 30 }],
      ["DELETE", `/api/admin/consultations/${ID}`, { confirm: ID }],
    ]);
  });

  it("returns the server's message on a refusal", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { code: "forbidden", message: "No." } }), { status: 403 }));
    expect(await send.deleteConsultation(ID, fetchImpl as never)).toEqual({ ok: false, message: "No." });
  });
});
