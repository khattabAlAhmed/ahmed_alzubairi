// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExpertiseArea } from "@/lib/content";
import type { ResourceListItem } from "@/lib/content/resources";
import ar from "@/messages/ar/Resources.json";
import en from "@/messages/en/Resources.json";

const startDownload = vi.hoisted(() => vi.fn());

vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
  useLocale: () => "en",
  useFormatter: () => ({ number: (value: number) => String(value) }),
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock("next/image", () => ({
  // A plain <img> stands in for next/image in tests.
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("@/i18n/navigation", () => ({
  // Serializes an object href the way next-intl's Link builds it.
  Link: ({
    href,
    children,
    "aria-current": current,
  }: {
    href: string | { pathname: string; query?: Record<string, string> };
    children: ReactNode;
    "aria-current"?: "true" | "page";
  }) => {
    const query = typeof href === "string" ? "" : new URLSearchParams(href.query).toString();
    const path = typeof href === "string" ? href : `${href.pathname}${query ? `?${query}` : ""}`;
    return (
      <a href={path} aria-current={current}>
        {children}
      </a>
    );
  },
}));
vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), startDownload }));

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/track", () => ({ track }));

const { requestDownload } = await import("./api");
const { listingQuery, parseResourcesQuery } = await import("./query");
const { ResourceDownload } = await import("./resource-download");
const { ResourcesList } = await import("./resources-list");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const ID = "3f2b8c1e-0000-4000-8000-000000000001";
const URL_OK = "https://files.example/signed?token=t";
const areas: ExpertiseArea[] = [{ id: "a1", slug: "governance", title: "Governance", summary: "" }];

function resource(overrides: Partial<ResourceListItem> = {}): ResourceListItem {
  return {
    id: ID,
    kind: "guide",
    title: "Board guide",
    description: "A short guide",
    access: "direct",
    expertise: { slug: "governance", title: "Governance" },
    ...overrides,
  };
}

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Stubs `fetch` with these replies, in order, and returns the mock. */
function stubFetch(...replies: Response[]) {
  const mock = vi.fn<typeof fetch>();
  for (const item of replies) mock.mockResolvedValueOnce(item);
  vi.stubGlobal("fetch", mock);
  return mock;
}

const sentBody = (mock: ReturnType<typeof stubFetch>, call = 0) =>
  JSON.parse(String(mock.mock.calls[call]?.[1]?.body)) as unknown;

describe("messages", () => {
  it("has the same keys in both languages", () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });
});

describe("parseResourcesQuery", () => {
  it("reads the area and the type", () => {
    expect(parseResourcesQuery({ area: " governance ", type: "template" })).toEqual({
      area: "governance",
      kind: "template",
    });
  });

  it("drops a type that doesn't exist, and blank values", () => {
    expect(parseResourcesQuery({ area: " ", type: "video" })).toEqual({ area: null, kind: null });
    expect(parseResourcesQuery({ type: ["guide", "template"] }).kind).toBe("guide");
  });

  it("gives the listing components only the set filters", () => {
    expect(listingQuery({ area: "governance", kind: null })).toEqual({ area: "governance" });
    expect(listingQuery({ area: null, kind: "guide" })).toEqual({ type: "guide" });
  });
});

describe("requestDownload", () => {
  it("posts no email for a direct download, and returns the signed URL", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(reply(200, { url: URL_OK }));
    expect(await requestDownload(ID, undefined, fetchMock)).toEqual({ ok: true, url: URL_OK });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/resources/${ID}/download`);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST", body: "{}" });
  });

  it("sends the email, and the consent flag only when the box is ticked", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(reply(200, { url: URL_OK }));
    await requestDownload(ID, { email: "a@example.com", consent: false }, fetchMock);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ email: "a@example.com" });
    await requestDownload(ID, { email: "a@example.com", consent: true }, fetchMock);
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ email: "a@example.com", consent: true });
  });

  it("returns the server's code and message on a refusal", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(reply(429, { error: { code: "rate_limited", message: "Later" } }));
    expect(await requestDownload(ID, undefined, fetchMock)).toEqual({
      ok: false,
      code: "rate_limited",
      message: "Later",
    });
  });

  it("fails without a message when the network fails or the answer has no URL", async () => {
    const down = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    expect(await requestDownload(ID, undefined, down)).toEqual({ ok: false, code: null, message: null });
    const odd = vi.fn<typeof fetch>().mockResolvedValue(reply(200, { url: "not a url" }));
    expect(await requestDownload(ID, undefined, odd)).toEqual({ ok: false, code: null, message: null });
  });

  it("gives up on a request that hangs past the timeout", async () => {
    const hang = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
        ),
    );
    expect(await requestDownload(ID, undefined, hang, 10)).toEqual({ ok: false, code: null, message: null });
    expect(hang.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
});

describe("ResourceDownload", () => {
  it("downloads a direct resource in one click", async () => {
    const fetchMock = stubFetch(reply(200, { url: URL_OK }));
    render(<ResourceDownload id={ID} title="Board guide" access="direct" />);
    fireEvent.click(screen.getByRole("button", { name: /^downloadLabel/ }));
    await waitFor(() => expect(startDownload).toHaveBeenCalledWith(URL_OK));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBody(fetchMock)).toEqual({});
    expect(screen.getByRole("status").textContent).toBe("started");
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("shows the server's message when a direct download is refused", async () => {
    stubFetch(reply(404, { error: { code: "not_found", message: "Gone" } }));
    render(<ResourceDownload id={ID} title="Board guide" access="direct" />);
    fireEvent.click(screen.getByRole("button", { name: /^downloadLabel/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Gone");
    expect(startDownload).not.toHaveBeenCalled();
  });

  it("asks for the email first, and downloads only once it's accepted", async () => {
    const fetchMock = stubFetch(
      reply(400, { error: { code: "validation_failed", message: "Bad email" } }),
      reply(200, { url: URL_OK }),
    );
    render(<ResourceDownload id={ID} title="Board guide" access="email" />);
    fireEvent.click(screen.getByRole("button", { name: /^downloadByEmailLabel/ }));
    // Opening the form asks the server for nothing.
    expect(fetchMock).not.toHaveBeenCalled();
    const dialog = within(screen.getByRole("form"));

    // No email: nothing is sent.
    fireEvent.click(dialog.getByRole("button", { name: "gateSubmit", hidden: true }));
    expect(dialog.getByText("emailRequired")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    // A refused email: the server's message shows, and nothing downloads.
    fireEvent.change(dialog.getByLabelText("email"), { target: { value: " bad@example.com " } });
    fireEvent.click(dialog.getByRole("button", { name: "gateSubmit", hidden: true }));
    expect(await dialog.findByText("Bad email")).toBeTruthy();
    expect(sentBody(fetchMock)).toEqual({ email: "bad@example.com" });
    expect(startDownload).not.toHaveBeenCalled();

    // Editing the email clears the server's message about the old one.
    fireEvent.change(dialog.getByLabelText("email"), { target: { value: "good@example" } });
    expect(dialog.queryByText("Bad email")).toBeNull();

    // An accepted email: the download starts.
    fireEvent.change(dialog.getByLabelText("email"), { target: { value: "good@example.com" } });
    fireEvent.click(dialog.getByRole("button", { name: "gateSubmit", hidden: true }));
    await waitFor(() => expect(startDownload).toHaveBeenCalledWith(URL_OK));
    expect(sentBody(fetchMock, 1)).toEqual({ email: "good@example.com" });
    // The form gives way to the result, under the row.
    expect(screen.getByText("started")).toBeTruthy();
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("has the newsletter box unticked, and sends consent only once it's ticked", async () => {
    const fetchMock = stubFetch(reply(200, { url: URL_OK }));
    render(<ResourceDownload id={ID} title="Board guide" access="email" />);
    fireEvent.click(screen.getByRole("button", { name: /^downloadByEmailLabel/ }));
    const dialog = within(screen.getByRole("form"));
    const box = dialog.getByRole("checkbox", { name: "newsletterConsent", hidden: true }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(box.getAttribute("aria-describedby")).toBeTruthy();

    fireEvent.click(box);
    expect(box.checked).toBe(true);
    fireEvent.change(dialog.getByLabelText("email"), { target: { value: "good@example.com" } });
    fireEvent.click(dialog.getByRole("button", { name: "gateSubmit", hidden: true }));
    await waitFor(() => expect(startDownload).toHaveBeenCalledWith(URL_OK));
    expect(sentBody(fetchMock)).toEqual({ email: "good@example.com", consent: true });
  });

  it("states the consent in both languages, with the double opt-in", () => {
    for (const messages of [ar, en]) {
      expect(messages.newsletterConsent).toBeTruthy();
      expect(messages.newsletterConsentHint).toBeTruthy();
    }
    expect(en.newsletterConsentHint).toMatch(/confirm/);
    expect(ar.newsletterConsentHint).toMatch(/تأكيد/);
  });

  it("opens the email form when a resource became email-gated after the page was cached", async () => {
    stubFetch(reply(400, { error: { code: "validation_failed", message: "Enter your email" } }));
    render(<ResourceDownload id={ID} title="Board guide" access="direct" />);
    fireEvent.click(screen.getByRole("button", { name: /^downloadLabel/ }));
    expect(await screen.findByRole("form")).toBeTruthy();
    expect(startDownload).not.toHaveBeenCalled();
  });
});

describe("ResourcesList", () => {
  it("shows a card per resource with its download action", () => {
    render(
      <ResourcesList
        resources={[resource(), resource({ id: "r2", title: "Budget template", kind: "template", access: "email" })]}
        areas={areas}
        query={{ area: null, kind: null }}
      />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Board guide" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^downloadLabel/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^downloadByEmailLabel/ })).toBeTruthy();
    // The list's count comes first; each card has its own download status after it.
    expect(screen.getAllByRole("status")[0]?.textContent).toBe('resultsCount:{"count":2}');
  });

  it("has area and type chips that keep the other filter", () => {
    render(<ResourcesList resources={[resource()]} areas={areas} query={{ area: "governance", kind: null }} />);
    const kinds = within(screen.getByRole("navigation", { name: "kindLabel" }));
    expect(kinds.getByRole("link", { name: "resourceKind.template" }).getAttribute("href")).toBe(
      "/resources?area=governance&type=template",
    );
    const areaChips = within(screen.getByRole("navigation", { name: "areaLabel" }));
    expect(areaChips.getByRole("link", { name: "Governance" }).getAttribute("aria-current")).toBe("true");
    expect(areaChips.getByRole("link", { name: "filterAll" }).getAttribute("href")).toBe("/resources");
  });

  it("tells an empty library from filters that match nothing", () => {
    const { rerender } = render(<ResourcesList resources={[]} areas={[]} query={{ area: null, kind: null }} />);
    expect(screen.getByText("empty")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "clearFilters" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("");

    rerender(<ResourcesList resources={[]} areas={areas} query={{ area: null, kind: "guide" }} />);
    expect(screen.getByText("noResults")).toBeTruthy();
    expect(screen.getByRole("link", { name: "clearFilters" }).getAttribute("href")).toBe("/resources");
    expect(screen.getByRole("status").textContent).toBe('resultsCount:{"count":0}');
  });
});

describe("ResourceDownload analytics", () => {
  it("sends resource_downloaded once for a direct download, with its access only", async () => {
    stubFetch(reply(200, { url: URL_OK }));
    render(<ResourceDownload id={ID} title="Board guide" access="direct" />);
    fireEvent.click(screen.getByRole("button", { name: /^downloadLabel/ }));
    await waitFor(() => expect(startDownload).toHaveBeenCalled());
    expect(track).toHaveBeenCalledExactlyOnceWith("resource_downloaded", { resource_access: "direct" });
  });

  it("sends it once for an email-gated download, never on a refused email", async () => {
    stubFetch(reply(400, { error: { code: "validation_failed", message: "Bad email" } }), reply(200, { url: URL_OK }));
    render(<ResourceDownload id={ID} title="Board guide" access="email" />);
    fireEvent.click(screen.getByRole("button", { name: /^downloadByEmailLabel/ }));
    const dialog = within(screen.getByRole("form"));
    fireEvent.change(dialog.getByLabelText("email"), { target: { value: "bad@example.com" } });
    fireEvent.click(dialog.getByRole("button", { name: "gateSubmit", hidden: true }));
    expect(await dialog.findByText("Bad email")).toBeTruthy();
    expect(track).not.toHaveBeenCalled();
    fireEvent.change(dialog.getByLabelText("email"), { target: { value: "good@example.com" } });
    fireEvent.click(dialog.getByRole("button", { name: "gateSubmit", hidden: true }));
    await waitFor(() => expect(startDownload).toHaveBeenCalled());
    expect(track).toHaveBeenCalledExactlyOnceWith("resource_downloaded", { resource_access: "email" });
  });

  it("sends nothing when a direct download is refused", async () => {
    stubFetch(reply(404, { error: { code: "not_found", message: "Gone" } }));
    render(<ResourceDownload id={ID} title="Board guide" access="direct" />);
    fireEvent.click(screen.getByRole("button", { name: /^downloadLabel/ }));
    await screen.findByRole("alert");
    expect(track).not.toHaveBeenCalled();
  });
});
