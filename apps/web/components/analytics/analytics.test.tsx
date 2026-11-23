// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeConsent } from "@/lib/analytics/consent";

const nav = vi.hoisted(() => ({ pathname: "/ar" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

const ph = vi.hoisted(() => {
  const state = { recording: false, persistence: "" };
  return {
    state,
    init: vi.fn((_key: string, options: { persistence: string }) => {
      state.persistence = options.persistence;
    }),
    set_config: vi.fn((config: { persistence?: string }) => {
      if (config.persistence) state.persistence = config.persistence;
    }),
    get_config: vi.fn(() => state.persistence),
    startSessionRecording: vi.fn(() => {
      state.recording = true;
    }),
    stopSessionRecording: vi.fn(() => {
      state.recording = false;
    }),
    sessionRecordingStarted: vi.fn(() => state.recording),
    identify: vi.fn(),
    alias: vi.fn(),
  };
});
vi.mock("posthog-js", () => ({ default: ph }));

const { Analytics, RECORDING_DELAY_MS } = await import("./analytics");

const fetcher = vi.fn();

beforeEach(() => {
  nav.pathname = "/ar";
  ph.state.recording = false;
  ph.state.persistence = "";
  for (const fn of [ph.init, ph.set_config, ph.startSessionRecording, ph.stopSessionRecording, ph.identify, ph.alias]) fn.mockClear();
  fetcher.mockReset().mockResolvedValue(Response.json({ key: "phc_1", host: "https://eu.i.posthog.com" }));
  vi.stubGlobal("fetch", fetcher);
  vi.useFakeTimers();
  // Idle runs on the next tick in the test.
  vi.stubGlobal("requestIdleCallback", (callback: () => void) => window.setTimeout(callback, 0));
  vi.stubGlobal("cancelIdleCallback", (handle: number) => window.clearTimeout(handle));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Lets `ms` of (fake) time pass, running timers and promises in between. */
const wait = (ms: number) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms);
});
/** PostHog has started (idle + config + import). */
const settle = () => wait(5);
/** The recorder's delay after `load` has passed too. */
const settleRecording = () => wait(RECORDING_DELAY_MS);

describe("Analytics", () => {
  it("starts in memory, records the public page, never identifies", async () => {
    render(<Analytics />);
    expect(ph.init).not.toHaveBeenCalled();
    await settle();
    expect(ph.init).toHaveBeenCalledWith("phc_1", expect.objectContaining({ persistence: "memory", api_host: "/ingest" }));
    await settleRecording();
    expect(ph.startSessionRecording).toHaveBeenCalledOnce();
    expect(ph.identify).not.toHaveBeenCalled();
    expect(ph.alias).not.toHaveBeenCalled();
  });

  it("stays off when the config answers 204", async () => {
    fetcher.mockResolvedValue(new Response(null, { status: 204 }));
    render(<Analytics />);
    await settle();
    expect(ph.init).not.toHaveBeenCalled();
  });

  it("starts with cookies when consent was given before", async () => {
    localStorage.setItem("consent", "granted");
    render(<Analytics />);
    await settle();
    expect(ph.init).toHaveBeenCalledWith("phc_1", expect.objectContaining({ persistence: "localStorage+cookie" }));
  });

  it("switches to cookies on accept, stays in memory on decline", async () => {
    render(<Analytics />);
    await settle();
    act(() => writeConsent("denied"));
    expect(ph.state.persistence).toBe("memory");
    act(() => writeConsent("granted"));
    expect(ph.state.persistence).toBe("localStorage+cookie");
  });

  it("stops recording on the account and dashboard, starts again on a public page", async () => {
    const view = render(<Analytics />);
    await settleRecording();
    expect(ph.state.recording).toBe(true);
    nav.pathname = "/ar/account";
    view.rerender(<Analytics />);
    expect(ph.state.recording).toBe(false);
    nav.pathname = "/ar/dashboard";
    view.rerender(<Analytics />);
    expect(ph.state.recording).toBe(false);
    nav.pathname = "/ar/about";
    view.rerender(<Analytics />);
    expect(ph.state.recording).toBe(true);
  });

  it("never starts recording when the first page is private", async () => {
    nav.pathname = "/en/dashboard";
    render(<Analytics />);
    await settle();
    expect(ph.init).toHaveBeenCalled();
    await wait(RECORDING_DELAY_MS * 3);
    expect(ph.startSessionRecording).not.toHaveBeenCalled();
  });

  describe("recorder delay (TBT)", () => {
    it("starts the recorder 5 s after load, not with PostHog", async () => {
      render(<Analytics />);
      await settle();
      expect(ph.init).toHaveBeenCalledOnce();
      await wait(RECORDING_DELAY_MS - 100);
      expect(ph.startSessionRecording).not.toHaveBeenCalled();
      await wait(100);
      expect(ph.startSessionRecording).toHaveBeenCalledOnce();
    });

    it("counts the delay from the load event when the page is still loading", async () => {
      vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
      render(<Analytics />);
      await wait(RECORDING_DELAY_MS * 2);
      expect(ph.init).toHaveBeenCalledOnce();
      expect(ph.startSessionRecording).not.toHaveBeenCalled();
      act(() => {
        window.dispatchEvent(new Event("load"));
      });
      await wait(RECORDING_DELAY_MS - 100);
      expect(ph.startSessionRecording).not.toHaveBeenCalled();
      await wait(100);
      expect(ph.startSessionRecording).toHaveBeenCalledOnce();
    });

    it("cancels the pending start on a move to a private page inside the delay", async () => {
      const view = render(<Analytics />);
      await settle();
      nav.pathname = "/ar/account";
      view.rerender(<Analytics />);
      await wait(RECORDING_DELAY_MS * 3);
      expect(ph.startSessionRecording).not.toHaveBeenCalled();
      nav.pathname = "/ar/dashboard";
      view.rerender(<Analytics />);
      await wait(RECORDING_DELAY_MS * 3);
      expect(ph.startSessionRecording).not.toHaveBeenCalled();
      expect(ph.state.recording).toBe(false);
    });

    it("starts on a public page reached later, once 5 s after load have passed", async () => {
      nav.pathname = "/ar/account";
      const view = render(<Analytics />);
      await settle();
      nav.pathname = "/ar/about";
      view.rerender(<Analytics />);
      await wait(RECORDING_DELAY_MS - 100);
      expect(ph.startSessionRecording).not.toHaveBeenCalled();
      await wait(100);
      expect(ph.startSessionRecording).toHaveBeenCalledOnce();
    });

    it("starts nothing after unmount", async () => {
      const view = render(<Analytics />);
      await settle();
      view.unmount();
      await wait(RECORDING_DELAY_MS * 3);
      expect(ph.startSessionRecording).not.toHaveBeenCalled();
    });

    it("waits for PostHog when the delay ends first", async () => {
      let answer: (value: Response) => void = () => {};
      fetcher.mockReturnValue(new Promise<Response>((resolve) => (answer = resolve)));
      render(<Analytics />);
      await wait(RECORDING_DELAY_MS * 2);
      expect(ph.init).not.toHaveBeenCalled();
      await act(async () => {
        answer(Response.json({ key: "phc_1", host: "https://eu.i.posthog.com" }));
        await vi.advanceTimersByTimeAsync(5);
      });
      expect(ph.init).toHaveBeenCalledOnce();
      expect(ph.startSessionRecording).toHaveBeenCalledOnce();
      expect(ph.identify).not.toHaveBeenCalled();
    });
  });
});
