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

const { Analytics } = await import("./analytics");

const fetcher = vi.fn();

beforeEach(() => {
  nav.pathname = "/ar";
  ph.state.recording = false;
  ph.state.persistence = "";
  for (const fn of [ph.init, ph.set_config, ph.startSessionRecording, ph.stopSessionRecording, ph.identify, ph.alias]) fn.mockClear();
  fetcher.mockReset().mockResolvedValue(Response.json({ key: "phc_1", host: "https://eu.i.posthog.com" }));
  vi.stubGlobal("fetch", fetcher);
  // Idle runs on the next tick in the test.
  vi.stubGlobal("requestIdleCallback", (callback: () => void) => window.setTimeout(callback, 0));
  vi.stubGlobal("cancelIdleCallback", (handle: number) => window.clearTimeout(handle));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

// Two idle periods: PostHog's start, then the recorder's.
const settle = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 20));
});

describe("Analytics", () => {
  it("starts in memory, records the public page, never identifies", async () => {
    render(<Analytics />);
    expect(ph.init).not.toHaveBeenCalled();
    await settle();
    expect(ph.init).toHaveBeenCalledWith("phc_1", expect.objectContaining({ persistence: "memory", api_host: "/ingest" }));
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
    await settle();
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
    expect(ph.startSessionRecording).not.toHaveBeenCalled();
  });

  describe("timing (TBT)", () => {
    // Idle callbacks wait here until the test runs them, in order.
    let idle: (() => void)[] = [];
    const runIdle = () => act(async () => {
      idle.shift()?.();
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    let readyState = "complete";

    beforeEach(() => {
      idle = [];
      readyState = "complete";
      vi.stubGlobal("requestIdleCallback", (callback: () => void) => idle.push(callback));
      vi.spyOn(document, "readyState", "get").mockImplementation(() => readyState as DocumentReadyState);
    });
    afterEach(() => vi.restoreAllMocks());

    it("waits for the page's load event before PostHog's idle start", async () => {
      readyState = "loading";
      render(<Analytics />);
      await settle();
      expect(idle).toHaveLength(0);
      readyState = "complete";
      act(() => {
        window.dispatchEvent(new Event("load"));
      });
      expect(idle).toHaveLength(1);
      await runIdle();
      expect(ph.init).toHaveBeenCalledOnce();
    });

    it("starts the recorder one idle period after PostHog, not with it", async () => {
      render(<Analytics />);
      await runIdle();
      expect(ph.init).toHaveBeenCalledOnce();
      expect(ph.startSessionRecording).not.toHaveBeenCalled();
      await runIdle();
      expect(ph.startSessionRecording).toHaveBeenCalledOnce();
    });

    it("never records a private page reached before the recorder was ready", async () => {
      const view = render(<Analytics />);
      await runIdle();
      nav.pathname = "/ar/account";
      view.rerender(<Analytics />);
      expect(ph.startSessionRecording).not.toHaveBeenCalled();
      await runIdle();
      expect(ph.startSessionRecording).not.toHaveBeenCalled();
      expect(ph.state.recording).toBe(false);
      nav.pathname = "/ar/about";
      view.rerender(<Analytics />);
      expect(ph.startSessionRecording).toHaveBeenCalledOnce();
    });

    it("starts nothing when the page goes away before load", async () => {
      readyState = "loading";
      const view = render(<Analytics />);
      view.unmount();
      act(() => {
        window.dispatchEvent(new Event("load"));
      });
      expect(idle).toHaveLength(0);
      expect(fetcher).not.toHaveBeenCalled();
    });
  });
});
