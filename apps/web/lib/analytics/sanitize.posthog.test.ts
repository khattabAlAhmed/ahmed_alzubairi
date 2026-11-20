// @vitest-environment jsdom
import posthog, { type CaptureResult } from "posthog-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sanitizeEvent } from "./sanitize";

// Real posthog-js (the installed version) builds the events; nothing leaves:
// fetch is stubbed and only what `before_send` returns is recorded.
const sent: CaptureResult[] = [];
const realFetch = globalThis.fetch;

beforeAll(async () => {
  window.history.replaceState(
    null,
    "",
    "/en?utm_source=test&utm_medium=email&utm_term=x&utm_content=y&gclid=abc&email=a%40b.test#top",
  );
  globalThis.fetch = (async () => new Response("{}", { status: 200 })) as typeof fetch;
  posthog.init("phc_test", {
    api_host: "/ingest",
    defaults: "2026-08-30",
    persistence: "memory",
    autocapture: false,
    capture_pageview: "history_change",
    person_profiles: "identified_only",
    disable_session_recording: true,
    // jsdom's user agent reads as a bot.
    opt_out_useragent_filter: true,
    before_send: (event) => {
      const out = sanitizeEvent(event);
      if (out) sent.push(out);
      return out;
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  posthog.capture("signed_up", { locale: "en" });
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

describe("sanitizeEvent with posthog-js events from a campaign link", () => {
  it("sends the pageview with utm_source and utm_medium, without utm_term or other campaign keys", () => {
    const pageview = sent.find((event) => event.event === "$pageview");
    expect(pageview).toBeDefined();
    const properties = pageview?.properties ?? {};
    expect(properties).toMatchObject({ utm_source: "test", utm_medium: "email", $pathname: "/en" });
    const keys = Object.keys(properties);
    expect(keys.filter((key) => /utm_term|utm_content|gclid|fbclid|li_fat_id/.test(key))).toEqual([]);
  });

  it("keeps our own event, without campaign properties", () => {
    const signedUp = sent.find((event) => event.event === "signed_up");
    expect(signedUp).toBeDefined();
    expect(Object.keys(signedUp?.properties ?? {}).filter((key) => /utm|gclid/.test(key))).toEqual([]);
  });

  it("sends no query or hash in any property", () => {
    expect(sent.length).toBeGreaterThan(0);
    expect(JSON.stringify(sent)).not.toMatch(/utm_source=|email=|%40|#top|\?/);
  });
});

describe("sanitizeEvent with posthog-js pageviews of private records", () => {
  it("sends `:id` instead of the record or user id after a client-side navigation", async () => {
    window.history.pushState(null, "", "/ar/account/consultations/d66ead78-8d93-48fc-bd11-144f48abcfc7");
    await new Promise((resolve) => setTimeout(resolve, 100));
    window.history.pushState(null, "", "/ar/dashboard/clients/user_3MLNrB0rI1hd19tRinVFY9qZBt9?tab=notes");
    await new Promise((resolve) => setTimeout(resolve, 100));
    const paths = sent.filter((event) => event.event === "$pageview").map((event) => event.properties?.$pathname);
    expect(paths).toContain("/ar/account/consultations/:id");
    expect(paths).toContain("/ar/dashboard/clients/:id");
    expect(JSON.stringify(sent)).not.toMatch(/d66ead78|user_3M|tab=/);
  });
});
