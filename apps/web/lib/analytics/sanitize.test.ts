import { describe, expect, it } from "vitest";
import { MAX_DEPTH, maskAttribute, maskIds, sanitizeEvent, stripUrl } from "./sanitize";

describe("stripUrl", () => {
  it.each([
    ["https://site.test/en/contact?email=a@b.test#form", "https://site.test/en/contact"],
    ["https://site.test/ar/blog#top", "https://site.test/ar/blog"],
    ["/en/dashboard?search=Ahmed", "/en/dashboard"],
    ["https://site.test/en", "https://site.test/en"],
    ["$direct", "$direct"],
  ])("%s → %s", (input, output) => {
    expect(stripUrl(input)).toBe(output);
  });

  it("leaves a value that isn't text", () => {
    expect(stripUrl(null)).toBeNull();
    expect(stripUrl(3)).toBe(3);
  });
});

describe("maskIds", () => {
  const UUID = "d66ead78-8d93-48fc-bd11-144f48abcfc7";
  it.each([
    [`https://site.test/ar/account/consultations/${UUID}`, "https://site.test/ar/account/consultations/:id"],
    ["/ar/dashboard/clients/user_3MLNrB0rI1hd19tRinVFY9qZBt9", "/ar/dashboard/clients/:id"],
    [`/en/account/documents/${UUID.toUpperCase()}`, "/en/account/documents/:id"],
    [`/en/dashboard/document-requests/${UUID}`, "/en/dashboard/document-requests/:id"],
    ["/en/dashboard/training/42", "/en/dashboard/training/:id"],
    [`/api/consultations/${UUID}/messages`, "/api/consultations/:id/messages"],
    [`/en/account/consultations/%36${UUID.slice(1)}`, "/en/account/consultations/:id"],
    ["/ar/dashboard/clients/%75ser_3MLNrB0rI1hd19tRinVFY9qZBt9", "/ar/dashboard/clients/:id"],
    ["/en/dashboard/training/%34%32", "/en/dashboard/training/:id"],
  ])("%s → %s", (input, output) => {
    expect(maskIds(input)).toBe(output);
  });

  it.each([
    "https://site.test/en/services/governance-review",
    "/ar/blog/مقال-أول",
    "/en/training/example-governance-course",
    "/en/blog/2024-annual-report",
    "/en/projects/user-research",
    "$direct",
    "https://12345.example.test/en",
    "/en/blog/%E0%A4%A",
    "/ar/blog/%D9%85%D9%82%D8%A7%D9%84",
  ])("keeps %s", (value) => {
    expect(maskIds(value)).toBe(value);
  });

  it("is applied by stripUrl, after the query is cut", () => {
    expect(stripUrl(`/en/account/consultations/${UUID}?tab=files#x`)).toBe("/en/account/consultations/:id");
  });
});

describe("sanitizeEvent", () => {
  it("strips the query and hash from every URL property, $set and $set_once too", () => {
    const out = sanitizeEvent({
      event: "$pageview",
      properties: {
        $current_url: "https://site.test/en/resources?q=name#x",
        $pathname: "/en/resources?q=name",
        $referrer: "https://search.test/?q=Ahmed+Alzubairi",
        $prev_pageview_pathname: "/en?ref=mail",
        $browser: "Chrome",
        token: "phc_test",
        distinct_id: "anon",
      },
      $set: { $current_url: "https://site.test/en?x=1" },
      $set_once: { $initial_referrer: "https://ref.test/?a=b" },
    });
    expect(out?.properties).toEqual({
      $current_url: "https://site.test/en/resources",
      $pathname: "/en/resources",
      $referrer: "https://search.test/",
      $prev_pageview_pathname: "/en",
      $browser: "Chrome",
      token: "phc_test",
      distinct_id: "anon",
    });
    expect(out?.$set).toEqual({ $current_url: "https://site.test/en" });
    expect(out?.$set_once).toEqual({ $initial_referrer: "https://ref.test/" });
  });

  it("removes the page title, which can name a client on a dashboard page", () => {
    const out = sanitizeEvent({ event: "$pageview", properties: { title: "Consultation — Jane Doe", $browser: "x" } });
    expect(out?.properties).toEqual({ $browser: "x" });
  });

  it("removes a plain property outside the allow-list from a PostHog event, never dropping it", () => {
    expect(sanitizeEvent({ event: "$pageview", properties: { message: "Hello", $browser: "x" } })?.properties).toEqual({
      $browser: "x",
    });
    expect(sanitizeEvent({ event: "$exception", properties: { email: "a@b.test", $exception_list: [] } })?.properties).toEqual({
      $exception_list: [],
    });
  });

  it("keeps utm_source, utm_medium and utm_campaign on a pageview, cut to 100 characters, and removes the rest", () => {
    const out = sanitizeEvent({
      event: "$pageview",
      properties: {
        $current_url: "https://site.test/en?utm_source=news&utm_term=x",
        utm_source: "news",
        utm_medium: "email",
        utm_campaign: "c".repeat(150),
        utm_term: "x",
        utm_content: "y",
        gclid: "abc",
        fbclid: null,
        $session_entry_utm_source: "news",
        $session_entry_utm_term: "x",
        $session_entry_gclid: "abc",
        $session_entry_url: "https://site.test/en?utm_source=news",
        distinct_id: "anon",
      },
      $set_once: { $initial_utm_source: "news", $initial_utm_term: "x", $initial_gclid: "abc", $initial_fbclid: null },
    });
    expect(out?.properties).toEqual({
      $current_url: "https://site.test/en",
      utm_source: "news",
      utm_medium: "email",
      utm_campaign: "c".repeat(100),
      $session_entry_utm_source: "news",
      $session_entry_url: "https://site.test/en",
      distinct_id: "anon",
    });
    expect(out?.$set_once).toEqual({ $initial_utm_source: "news" });
  });

  it("removes every campaign property from other events, so they aren't dropped", () => {
    const campaign = { utm_source: "news", utm_term: "x", gclid: "abc", li_fat_id: null, $session_entry_utm_source: "news" };
    expect(sanitizeEvent({ event: "signed_up", properties: { locale: "en", ...campaign } })?.properties).toEqual({ locale: "en" });
    expect(sanitizeEvent({ event: "$web_vitals", properties: { $web_vitals_LCP_value: 1, ...campaign } })?.properties).toEqual({
      $web_vitals_LCP_value: 1,
    });
  });

  it("strips the query and hash from URLs nested in a web vitals event", () => {
    const url = "https://site.test/en/services?utm_source=news&email=a@b.test#x";
    const out = sanitizeEvent({
      event: "$web_vitals",
      properties: {
        $current_url: url,
        $web_vitals_FCP_value: 812,
        // The plugin copies the whole web-vitals metric (posthog-js 1.450).
        $web_vitals_FCP_event: {
          name: "FCP",
          value: 812,
          rating: "good",
          delta: 812,
          id: "v5-1",
          navigationType: "navigate",
          entries: [{ name: "first-contentful-paint", entryType: "paint", startTime: 812 }],
          attribution: { timeToFirstByte: 90, navigationEntry: { name: url, entryType: "navigation" } },
          $current_url: url,
          navigationURL: url,
          timestamp: 1,
        },
      },
    });
    expect(JSON.stringify(out)).not.toMatch(/[?#]|email|utm/);
    expect(out?.properties?.$web_vitals_FCP_event).toMatchObject({
      name: "FCP",
      $current_url: "https://site.test/en/services",
      navigationURL: "https://site.test/en/services",
      attribution: { timeToFirstByte: 90, navigationEntry: { name: "https://site.test/en/services" } },
    });
  });

  it("keeps the fields of a native entry (toJSON), with its URL stripped", () => {
    class Entry {
      get name() {
        return "https://site.test/en?email=a@b.test";
      }
      get entryType() {
        return "navigation";
      }
      toJSON() {
        return { name: this.name, entryType: this.entryType, startTime: 0 };
      }
    }
    const out = sanitizeEvent({
      event: "$web_vitals",
      properties: { $web_vitals_LCP_event: { name: "LCP", entries: [new Entry()] } },
    });
    expect(out?.properties?.$web_vitals_LCP_event).toEqual({
      name: "LCP",
      entries: [{ name: "https://site.test/en", entryType: "navigation", startTime: 0 }],
    });
  });

  it("removes nesting deeper than MAX_DEPTH instead of sending it unchecked", () => {
    let deep: Record<string, unknown> = { url: "https://site.test/en?token=1" };
    for (let level = 0; level < MAX_DEPTH + 2; level++) deep = { next: deep };
    const out = sanitizeEvent({ event: "$web_vitals", properties: { $web_vitals_CLS_event: deep } });
    expect(out).not.toBeNull();
    expect(JSON.stringify(out)).not.toMatch(/token|\?/);
  });

  it("masks ids in every URL property at any depth, $set_once and replay records too", () => {
    const url = "https://site.test/ar/dashboard/clients/user_3MLNrB0rI1hd19tRinVFY9qZBt9";
    const pageview = sanitizeEvent({
      event: "$pageview",
      properties: {
        $current_url: url,
        $pathname: "/ar/dashboard/clients/user_3MLNrB0rI1hd19tRinVFY9qZBt9",
        $session_entry_url: url,
        $prev_pageview_pathname: "/ar/account/consultations/d66ead78-8d93-48fc-bd11-144f48abcfc7",
      },
      $set_once: { $initial_current_url: url },
    });
    expect(JSON.stringify(pageview)).not.toMatch(/user_3M|d66ead78/);
    expect(pageview?.properties?.$pathname).toBe("/ar/dashboard/clients/:id");
    const vitals = sanitizeEvent({ event: "$web_vitals", properties: { $web_vitals_LCP_event: { navigationURL: url } } });
    expect(vitals?.properties?.$web_vitals_LCP_event).toEqual({ navigationURL: "https://site.test/ar/dashboard/clients/:id" });
    const snapshot = sanitizeEvent({ event: "$snapshot", properties: { $snapshot_data: [{ type: 4, data: { href: url } }] } });
    expect(JSON.stringify(snapshot)).not.toContain("user_3M");
    expect(maskAttribute("href", "/en/account/consultations/d66ead78-8d93-48fc-bd11-144f48abcfc7")).toBe("/en/account/consultations/:id");
  });

  it("keeps service and blog slugs, which the funnel matches", () => {
    const out = sanitizeEvent({ event: "$pageview", properties: { $pathname: "/en/services/governance-review", $current_url: "https://site.test/ar/blog/first-article" } });
    expect(out?.properties).toEqual({ $pathname: "/en/services/governance-review", $current_url: "https://site.test/ar/blog/first-article" });
  });

  it("keeps text that isn't a URL as it is, at any depth", () => {
    const out = sanitizeEvent({
      event: "$exception",
      properties: { $exception_list: [{ type: "Error", value: "Expected ? here", stacktrace: { frames: [{ filename: "/_next/a.js?v=1" }] } }] },
    });
    expect(out?.properties?.$exception_list).toEqual([
      { type: "Error", value: "Expected ? here", stacktrace: { frames: [{ filename: "/_next/a.js" }] } },
    ]);
  });

  it("keeps our listed events with their allowed properties only", () => {
    expect(sanitizeEvent({ event: "contact_sent", properties: { org_type: "company", locale: "ar", $lib: "web" } })).not.toBeNull();
    expect(sanitizeEvent({ event: "contact_sent", properties: { org_type: "company", subject: "Hi" } })).toBeNull();
    expect(sanitizeEvent({ event: "document_requested", properties: { count: 2, request_id: "x" } })).toBeNull();
    expect(sanitizeEvent({ event: "not_listed", properties: {} })).toBeNull();
  });

  it("drops PostHog events we didn't keep (autocapture, clicks, identify)", () => {
    for (const event of ["$autocapture", "$rageclick", "$dead_click", "$identify", "$set", "$groupidentify"]) {
      expect(sanitizeEvent({ event, properties: {} })).toBeNull();
    }
  });

  it("keeps exceptions, with the same URL stripping", () => {
    const out = sanitizeEvent({
      event: "$exception",
      properties: { $exception_list: [], $current_url: "https://site.test/ar?token=1" },
    });
    expect(out?.properties?.$current_url).toBe("https://site.test/ar");
  });

  it("strips the page address from a replay's Meta record", () => {
    const out = sanitizeEvent({
      event: "$snapshot",
      properties: {
        $snapshot_data: [
          { type: 4, data: { href: "https://site.test/en/contact?email=a@b.test", width: 1 } },
          { type: 3, data: { source: 1 } },
        ],
      },
    });
    expect(out?.properties?.$snapshot_data).toEqual([
      { type: 4, data: { href: "https://site.test/en/contact", width: 1 } },
      { type: 3, data: { source: 1 } },
    ]);
  });

  it("drops what it can't read, never throws", () => {
    expect(sanitizeEvent(null)).toBeNull();
    expect(sanitizeEvent({ event: 3 as unknown as string })).toBeNull();
    const hostile = { event: "$pageview", get properties(): Record<string, unknown> { throw new Error("boom"); } };
    expect(sanitizeEvent(hostile)).toBeNull();
  });
});

describe("maskAttribute (replay)", () => {
  it.each([
    ["href", "/en/blog?search=Jane#c", "/en/blog"],
    ["HREF", "https://site.test/en/contact?email=a@b.test", "https://site.test/en/contact"],
    ["src", "/img.png?token=1", "/img.png"],
    ["action", "/api/contact?x=1", "/api/contact"],
    ["formaction", "/a?b", "/a"],
    ["poster", "/v.jpg#t", "/v.jpg"],
    ["xlink:href", "#icon", ""],
  ])("strips %s", (name, value, out) => {
    expect(maskAttribute(name, value)).toBe(out);
  });

  it.each([
    ["/a.png?w=1 1x, /b.png?w=2 2x", "/a.png 1x, /b.png 2x"],
    ["/a.png?labels=public,private-label 1x", "/a.png 1x"],
    ["/a.png?x=1,/b.png?y=2 2x", "/a.png 2x"],
    ["/a.png?x=1, /b.png", "/a.png, /b.png"],
    ["data:image/png;base64,AAA= 1x, /b.png#f 2x", "data:image/png;base64,AAA= 1x, /b.png 2x"],
    ["/a.png 100w (min-width: 2px), /b.png 200w", "/a.png 100w (min-width: 2px), /b.png 200w"],
    ["  ", ""],
  ])("strips each srcset candidate whole: %s", (value, out) => {
    expect(maskAttribute("srcset", value)).toBe(out);
  });

  it("keeps attributes that aren't URLs", () => {
    expect(maskAttribute("class", "a?b")).toBe("a?b");
    expect(maskAttribute("aria-label", "What? #1")).toBe("What? #1");
  });
});
