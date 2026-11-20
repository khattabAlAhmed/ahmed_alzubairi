import { EVENT_PROPERTIES } from "./events";

type Properties = Record<string, unknown>;

/**
 * The rules every PostHog event passes before it leaves the browser (§9):
 * URLs lose their query string and hash at any depth (they can hold a search
 * term, an email or a token); campaign parameters are cut to the three a
 * pageview may keep; a PostHog event loses any other plain property, and one
 * of our own events with a property we didn't allow is dropped.
 */

/** Properties that hold a URL or a path. `$set`/`$set_once` copies too. */
export const URL_PROPERTIES = [
  "$current_url",
  "$pathname",
  "$referrer",
  "$prev_pageview_pathname",
  "$prev_pageview_url",
  "$initial_current_url",
  "$initial_pathname",
  "$initial_referrer",
  "$session_entry_url",
  "$session_entry_pathname",
  "$session_entry_referrer",
] as const;

/** PostHog's own events we keep. Any other `$` event is dropped. */
export const POSTHOG_EVENTS = new Set([
  "$pageview",
  "$pageleave",
  "$exception",
  "$snapshot",
  "$opt_in",
  "$web_vitals",
]);

/**
 * Non-`$` properties the SDK adds itself. `token` and `distinct_id` are kept;
 * `title` (the page title, which on a dashboard page can name a client) is
 * removed rather than dropping the event.
 */
const SDK_KEPT = new Set(["token", "distinct_id"]);
const SDK_REMOVED = new Set(["title"]);

/**
 * The campaign parameters posthog-js copies from the address onto every
 * event, plain and as `$session_entry_<key>` / `$initial_<key>` (its list in
 * 1.450). Only `$pageview` keeps the three below; every other one is removed.
 */
export const CAMPAIGN_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gad_source",
  "mc_cid",
  "gclid",
  "gclsrc",
  "dclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "twclid",
  "li_fat_id",
  "igshid",
  "ttclid",
  "rdt_cid",
  "epik",
  "qclid",
  "sccid",
  "oppref",
  "bfcid",
  "irclid",
  "_kx",
] as const;

/** Campaign attribution a pageview keeps (Kaz, T19): not personal data. */
export const PAGEVIEW_CAMPAIGN = ["utm_source", "utm_medium", "utm_campaign"] as const;

/** The longest campaign value sent; longer ones are cut. */
export const CAMPAIGN_MAX_LENGTH = 100;

const CAMPAIGN_PREFIXES = ["", "$session_entry_", "$initial_"] as const;

/** The campaign parameter a property name carries, plain or prefixed, or null. */
function campaignParam(key: string): string | null {
  for (const prefix of CAMPAIGN_PREFIXES) {
    if (!key.startsWith(prefix)) continue;
    const name = key.slice(prefix.length);
    if ((CAMPAIGN_PARAMS as readonly string[]).includes(name)) return name;
  }
  return null;
}

/**
 * Removes every campaign property, except the three a pageview keeps, cut to
 * `CAMPAIGN_MAX_LENGTH`. Empty values (posthog-js sends null for the ones the
 * address lacks) are removed too.
 */
function cutCampaign(properties: Properties, keep: boolean): void {
  for (const key of Object.keys(properties)) {
    const name = campaignParam(key);
    if (name === null) continue;
    const value = properties[key];
    if (keep && (PAGEVIEW_CAMPAIGN as readonly string[]).includes(name) && typeof value === "string" && value !== "") {
      properties[key] = value.slice(0, CAMPAIGN_MAX_LENGTH);
    } else {
      delete properties[key];
    }
  }
}

/** What an id-shaped path segment becomes. */
export const ID_SEGMENT = ":id";

/**
 * Path segments that name a record or a person (§9): a uuid (consultation,
 * request, document, course), a Clerk id (`user_…`, `org_…`, `sess_…`) or a
 * number. Public slugs never look like these, so funnels keep them.
 */
const ID_SHAPED = [
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^(user|org|sess|inv|sms|idn)_[A-Za-z0-9]{8,}$/,
  /^\d+$/,
] as const;

/** Where the path starts: after `scheme://host`, or at a leading "/"; -1 when the text isn't a URL or path. */
function pathStart(value: string): number {
  const absolute = /^[a-z][a-z0-9+.-]*:\/\/[^/]*/i.exec(value);
  if (absolute) return absolute[0].length;
  return value.startsWith("/") ? 0 : -1;
}

/** True when a path segment is id-shaped, as written or percent-decoded ("%36…" is "6…"). */
function isIdSegment(segment: string): boolean {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // A malformed escape is classified as written.
  }
  return ID_SHAPED.some((shape) => shape.test(decoded));
}

/** The URL or path with every id-shaped segment replaced by `:id`. Other text is kept. */
export function maskIds(value: string): string {
  const start = pathStart(value);
  if (start === -1) return value;
  const path = value
    .slice(start)
    .split("/")
    .map((segment) => (isIdSegment(segment) ? ID_SEGMENT : segment))
    .join("/");
  return value.slice(0, start) + path;
}

/**
 * The URL without its query string and hash, and with id-shaped path
 * segments as `:id`. Text that isn't a URL is kept as it is.
 */
export function stripUrl(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const cut = value.search(/[?#]/);
  return maskIds(cut === -1 ? value : value.slice(0, cut));
}

/** DOM attributes that hold a URL, which replay records on every element. */
const URL_ATTRIBUTES = new Set(["href", "src", "action", "formaction", "poster", "cite", "data", "xlink:href"]);

/**
 * `srcset` candidates parsed as the HTML spec does: a URL runs to the next
 * whitespace (commas inside it stay), trailing commas end it, and its
 * descriptor runs to the next comma outside parentheses. Each URL loses its
 * query and hash; descriptors are kept.
 */
export function stripSrcset(value: string): string {
  const candidates: string[] = [];
  let at = 0;
  while (at < value.length) {
    while (at < value.length && /[\s,]/.test(value[at] as string)) at++;
    if (at >= value.length) break;
    let end = at;
    while (end < value.length && !/\s/.test(value[end] as string)) end++;
    let url = value.slice(at, end);
    let descriptor = "";
    if (/,+$/.test(url)) {
      url = url.replace(/,+$/, "");
    } else {
      let depth = 0;
      let stop = end;
      while (stop < value.length) {
        const char = value[stop];
        if (char === "(") depth++;
        else if (char === ")") depth = Math.max(0, depth - 1);
        else if (char === "," && depth === 0) break;
        stop++;
      }
      descriptor = value.slice(end, stop).trim();
      end = stop;
    }
    candidates.push(descriptor ? `${stripUrl(url) as string} ${descriptor}` : (stripUrl(url) as string));
    at = end;
  }
  return candidates.join(", ");
}

/**
 * Replay's attribute mask: URL attributes lose their query and hash
 * (`srcset` per candidate). Every other attribute is kept.
 */
export function maskAttribute(name: string, value: string): string {
  const key = name.toLowerCase();
  if (key === "srcset") return stripSrcset(value);
  return URL_ATTRIBUTES.has(key) ? (stripUrl(value) as string) : value;
}

/** Text that reads as an absolute URL or a path: no spaces, starts with `http(s)://` or `/`. */
const URL_LIKE = /^(?:https?:\/\/|\/)\S*$/i;

/**
 * A copy with the query and hash cut from every URL-like string at any depth:
 * nested objects such as `$web_vitals_<metric>_event` (its `$current_url`,
 * `navigationURL`, performance `entries`) carry the full address.
 */
/** Nesting deeper than this is removed, never sent unchecked. */
export const MAX_DEPTH = 10;

function stripDeep(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return URL_LIKE.test(value) ? stripUrl(value) : value;
  if (typeof value !== "object" || value === null) return value;
  if (depth > MAX_DEPTH) return undefined;
  // Native objects (a PerformanceEntry) keep their fields on the prototype;
  // their JSON form is what would be sent.
  const toJSON = (value as { toJSON?: unknown }).toJSON;
  if (typeof toJSON === "function") return stripDeep(toJSON.call(value), depth + 1);
  if (Array.isArray(value)) return value.map((item) => stripDeep(item, depth + 1));
  const copy: Properties = {};
  for (const [key, item] of Object.entries(value)) copy[key] = stripDeep(item, depth + 1);
  return copy;
}

function stripUrls(properties: Properties | undefined): Properties | undefined {
  if (!properties) return properties;
  const copy: Properties = {};
  for (const [key, value] of Object.entries(properties)) {
    // Replay records keep their own rules (stripSnapshotUrls, maskAttribute).
    copy[key] = key === "$snapshot_data" ? value : stripDeep(value);
  }
  for (const key of URL_PROPERTIES) {
    if (key in copy) copy[key] = stripUrl(copy[key]);
  }
  return copy;
}

/** rrweb's Meta record (type 4) carries the page's full `href`. */
function stripSnapshotUrls(data: unknown): unknown {
  if (!Array.isArray(data)) return data;
  return data.map((record: unknown) => {
    if (typeof record !== "object" || record === null) return record;
    const item = record as { type?: unknown; data?: { href?: unknown } };
    if (item.type === 4 && item.data && typeof item.data.href === "string") {
      return { ...item, data: { ...item.data, href: stripUrl(item.data.href) } };
    }
    return record;
  });
}

/** The parts of a PostHog `CaptureResult` these rules read. */
export type AnalyticsEvent = {
  event: string;
  properties?: Properties;
  $set?: Properties;
  $set_once?: Properties;
};

/**
 * The event as it may be sent, or null to drop it. Used as PostHog's
 * `before_send`; it never throws, and drops what it can't read.
 */
export function sanitizeEvent<T extends AnalyticsEvent>(event: T | null): T | null {
  try {
    if (!event || typeof event.event !== "string") return null;
    const name = event.event;
    const allowed = EVENT_PROPERTIES[name];
    if (name.startsWith("$") ? !POSTHOG_EVENTS.has(name) : allowed === undefined) return null;
    const properties = stripUrls(event.properties);
    const $set = stripUrls(event.$set);
    const $set_once = stripUrls(event.$set_once);
    const keepCampaign = name === "$pageview";
    for (const bag of [properties, $set, $set_once]) if (bag) cutCampaign(bag, keepCampaign);
    if (properties) for (const key of SDK_REMOVED) delete properties[key];
    const own = Object.keys(properties ?? {}).filter(
      (key) => !key.startsWith("$") && !SDK_KEPT.has(key) && !(keepCampaign && campaignParam(key) !== null),
    );
    if (name.startsWith("$")) {
      // A PostHog event is never dropped for a property: the property goes.
      for (const key of own) delete properties?.[key];
    } else if (own.some((key) => !(allowed ?? []).includes(key))) {
      // One of ours with a property outside its allow-list is a bug: send nothing.
      return null;
    }
    if (properties && name === "$snapshot" && "$snapshot_data" in properties) {
      properties.$snapshot_data = stripSnapshotUrls(properties.$snapshot_data);
    }
    return { ...event, properties, $set, $set_once } as T;
  } catch {
    return null;
  }
}
