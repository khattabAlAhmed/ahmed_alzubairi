// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import arAccount from "@/messages/ar/AccountDocuments.json";
import arDialog from "@/messages/ar/DocumentRequestDialog.json";
import arWorkspace from "@/messages/ar/Workspace.json";
import enAccount from "@/messages/en/AccountDocuments.json";
import enDialog from "@/messages/en/DocumentRequestDialog.json";
import enWorkspace from "@/messages/en/Workspace.json";
import { callsOn, fakeClient } from "@/components/dashboard/documents/fake-client.test-helper";

const auth = vi.hoisted(() => ({ isLoaded: true, isSignedIn: false as boolean | undefined }));
const search = vi.hoisted(() => ({ value: "" }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => router,
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={typeof href === "string" ? href : String(href)} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
// pdf.js needs a real canvas; the viewer's own logic is what's tested here.
vi.mock("./pdf-pages", () => ({
  PdfPages: ({ data, title }: { data: ArrayBuffer; title: string }) => (
    <div data-testid="pdf">{`${title}:${data.byteLength}`}</div>
  ),
}));

const { DocumentRequestProvider, RequestButton, SelectBox } = await import("./request-provider");
const { RequestCard } = await import("./request-card");
const { DocumentViewer, downloadName } = await import("./viewer");
const { downloadUrl, openDocument, sendDocumentRequest } = await import("./api");
const { groupRequests, isOpenable } = await import("./group");
const { parseRequestIds, requestPath } = await import("./paths");
const { readOwnRequest, readOwnRequests } = await import("./read");
type OwnRequest = import("./group").OwnRequest;

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const DOCS = [
  { id: A, title: "Course certificate" },
  { id: B, title: "Thank-you letter" },
];

const MESSAGES = {
  en: { DocumentRequestDialog: enDialog, AccountDocuments: enAccount, Workspace: enWorkspace },
  ar: { DocumentRequestDialog: arDialog, AccountDocuments: arAccount, Workspace: arWorkspace },
};

function withIntl(node: ReactNode, locale: "ar" | "en" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {node}
    </NextIntlClientProvider>,
  );
}

function list(locale: "ar" | "en" = "en") {
  return withIntl(
    <DocumentRequestProvider documents={DOCS}>
      {DOCS.map((document) => (
        <div key={document.id}>
          <SelectBox {...document} />
          <RequestButton {...document} />
        </div>
      ))}
    </DocumentRequestProvider>,
    locale,
  );
}

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function sent() {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    method: init?.method,
    body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
  }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  router.push.mockReset();
  router.replace.mockReset();
  auth.isLoaded = true;
  auth.isSignedIn = false;
  search.value = "";
  // jsdom has no showModal.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("paths", () => {
  it("reads uuids only, each once, in order", () => {
    expect(parseRequestIds(`${B},nope,${A.toUpperCase()},${B}`)).toEqual([B, A]);
    expect(parseRequestIds(null)).toEqual([]);
    expect(parseRequestIds(Array.from({ length: 60 }, (_, i) => `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`).join(","))).toHaveLength(50);
  });

  it("builds the documents page with the selection", () => {
    expect(requestPath([A, B])).toBe(`/documents?request=${A},${B}`);
    expect(requestPath([])).toBe("/documents");
  });
});

describe("signed-out request round trip", () => {
  it("sends one document's request to sign-in and back with it selected", () => {
    list();
    fireEvent.click(screen.getByRole("button", { name: "Request to view: Thank-you letter" }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/sign-in",
      query: { redirect_url: `/en/documents?request=${B}` },
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps a multi-selection through sign-in", () => {
    list("ar");
    fireEvent.click(screen.getByLabelText("تحديد Course certificate"));
    fireEvent.click(screen.getByLabelText("تحديد Thank-you letter"));
    expect(screen.getByText("وثيقتان محددتان")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "طلب عدة وثائق" }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/sign-in",
      query: { redirect_url: `/ar/documents?request=${A},${B}` },
    });
  });

  it("back from sign-in, selects the documents and opens the dialog with them", () => {
    auth.isSignedIn = true;
    search.value = `request=${A},${B},${C}`;
    list();
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Course certificate");
    expect(dialog.textContent).toContain("Thank-you letter");
    // An id the page doesn't list is dropped.
    expect((screen.getByLabelText("Select Course certificate") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Select Thank-you letter") as HTMLInputElement).checked).toBe(true);
  });

  it("waits for Clerk before acting on the link", () => {
    auth.isLoaded = false;
    auth.isSignedIn = undefined;
    search.value = `request=${A}`;
    const { rerender } = list();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Request to view: Course certificate" }));
    expect(router.push).not.toHaveBeenCalled();
    auth.isLoaded = true;
    auth.isSignedIn = true;
    rerender(
      <NextIntlClientProvider locale="en" messages={MESSAGES.en}>
        <DocumentRequestProvider documents={DOCS}>
          <RequestButton {...DOCS[0]!} />
        </DocumentRequestProvider>
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("a signed-out visitor back from a stale link gets the selection, not the dialog", () => {
    search.value = `request=${A}`;
    list();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByLabelText("Select Course certificate") as HTMLInputElement).checked).toBe(true);
  });
});

describe("RequestDialog", () => {
  function openFor(id: string = A, locale: "ar" | "en" = "en") {
    auth.isSignedIn = true;
    list(locale);
    const name = locale === "ar" ? `طلب الاطلاع على: ${DOCS.find((d) => d.id === id)?.title}` : `Request to view: ${DOCS.find((d) => d.id === id)?.title}`;
    fireEvent.click(screen.getByRole("button", { name }));
  }

  it("asks for the purpose before sending", async () => {
    openFor();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send request" })));
    expect(screen.getByText("Tell us the purpose.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the documents and the trimmed purpose, then says it's under review", async () => {
    fetchMock.mockResolvedValueOnce(json({ requestIds: ["44444444-4444-4444-8444-444444444444"] }));
    openFor();
    fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "  a tender file  " } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send request" })));
    expect(sent()).toEqual([
      { url: "/api/document-requests", method: "POST", body: { documentIds: [A], purpose: "a tender file" } },
    ]);
    expect(screen.getByRole("status").textContent).toBe("Your request is under review.");
    expect(screen.getByRole("link", { name: "Go to My available documents" }).getAttribute("href")).toBe("/account/documents");
  });

  it("shows طلبك قيد المراجعة, not an error, for a merged duplicate", async () => {
    // The server merges a duplicate into the open request and answers 200 with its id.
    const existing = "55555555-5555-4555-8555-555555555555";
    fetchMock.mockResolvedValue(json({ requestIds: [existing] }));
    openFor(A, "ar");
    fireEvent.change(screen.getByLabelText("الغرض"), { target: { value: "مرة ثانية" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "إرسال الطلب" })));
    expect(screen.getByRole("status").textContent).toBe("طلبك قيد المراجعة");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears the selection once sent, and the link on close", async () => {
    fetchMock.mockResolvedValueOnce(json({ requestIds: [A] }));
    auth.isSignedIn = true;
    list();
    fireEvent.click(screen.getByLabelText("Select Course certificate"));
    fireEvent.click(screen.getByRole("button", { name: "Request selected documents" }));
    fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "x" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send request" })));
    expect((screen.getByLabelText("Select Course certificate") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/documents", { scroll: false });
  });

  it("points to the profile when it isn't finished", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: "profile_incomplete", message: "x" } }, 422));
    openFor();
    fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "x" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send request" })));
    expect(screen.getByRole("alert").textContent).toContain("Finish your profile first");
    expect(screen.getByRole("link", { name: "Finish my profile" }).getAttribute("href")).toBe(
      `/en/onboarding?redirect_url=${encodeURIComponent(`/en/documents?request=${A}`)}`,
    );
  });

  it("shows the server's message on another refusal, and keeps the purpose", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: "not_found", message: "Not published." } }, 404));
    openFor();
    fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "kept" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send request" })));
    expect(screen.getByRole("alert").textContent).toBe("Not published.");
    expect((screen.getByLabelText("Purpose") as HTMLTextAreaElement).value).toBe("kept");
  });

  it("renders titles as text, never HTML", () => {
    auth.isSignedIn = true;
    withIntl(
      <DocumentRequestProvider documents={[{ id: A, title: "<img src=x onerror=alert(1)>" }]}>
        <RequestButton id={A} title="<img src=x onerror=alert(1)>" />
      </DocumentRequestProvider>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("dialog").querySelector("img")).toBeNull();
  });
});

const REQUEST: OwnRequest = {
  id: "66666666-6666-4666-8666-666666666666",
  documentId: A,
  title: "Course certificate",
  category: "course_certificate",
  accessMode: "view",
  mime: "application/pdf",
  status: "granted",
  consultationId: null,
  expiresAt: null,
  createdAt: "2026-11-14T10:00:00.000Z",
};

describe("groupRequests", () => {
  const now = new Date("2026-11-14T12:00:00.000Z");
  const req = (over: Partial<OwnRequest>): OwnRequest => ({ ...REQUEST, ...over });

  it("splits available, in progress and ended", () => {
    const groups = groupRequests(
      [
        req({ id: "g", status: "granted" }),
        req({ id: "p", documentId: B, status: "pending_review" }),
        req({ id: "c", documentId: C, status: "in_contact" }),
        req({ id: "x", documentId: "d", status: "expired" }),
        req({ id: "r", documentId: "e", status: "revoked" }),
      ],
      now,
    );
    expect(groups.available.map((r) => r.id)).toEqual(["g"]);
    expect(groups.inProgress.map((r) => r.id)).toEqual(["p", "c"]);
    expect(groups.ended.map((r) => [r.id, r.canRequestAgain])).toEqual([
      ["x", true],
      ["r", true],
    ]);
  });

  it("counts a grant past its expiry as ended before the hourly job runs", () => {
    const late = req({ expiresAt: "2026-11-14T11:59:59.000Z" });
    expect(isOpenable(late, now)).toBe(false);
    expect(groupRequests([late], now).ended).toHaveLength(1);
    expect(isOpenable(req({ expiresAt: "2026-11-15T00:00:00.000Z" }), now)).toBe(true);
  });

  it("offers no request-again while the same document has a live request, and one entry per document", () => {
    const groups = groupRequests(
      [
        req({ id: "new", status: "pending_review" }),
        req({ id: "old", status: "revoked" }),
        req({ id: "older", status: "expired" }),
      ],
      now,
    );
    expect(groups.ended.map((r) => [r.id, r.canRequestAgain])).toEqual([["old", false]]);
  });
});

describe("RequestCard", () => {
  it("opens an available document in the viewer, with its expiry", () => {
    withIntl(<RequestCard request={{ ...REQUEST, expiresAt: "2099-12-31T20:59:59.000Z" }} group="available" />);
    expect(screen.getByRole("link", { name: "Open Course certificate" }).getAttribute("href")).toBe(
      `/account/documents/${REQUEST.id}`,
    );
    expect(screen.getByText(/Available until/)).toBeTruthy();
  });

  it("shows طلب مجدداً on an expired request, back to the documents page with it selected", () => {
    withIntl(<RequestCard request={{ ...REQUEST, status: "expired" }} group="ended" canRequestAgain />, "ar");
    const link = screen.getByRole("link", { name: "طلب مجدداً: Course certificate" });
    expect(link.textContent).toBe("طلب مجدداً");
    expect(link.getAttribute("href")).toBe(`/documents?request=${A}`);
    expect(screen.getByText("منتهية")).toBeTruthy();
  });

  it("shows a late grant as expired", () => {
    withIntl(<RequestCard request={{ ...REQUEST, expiresAt: "2000-01-01T00:00:00.000Z" }} group="ended" canRequestAgain />);
    expect(screen.getByText("Expired")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^Open/ })).toBeNull();
  });

  it("offers no request-again when the document already has a live request", () => {
    withIntl(<RequestCard request={{ ...REQUEST, status: "revoked" }} group="ended" canRequestAgain={false} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links a request in contact to its chat", () => {
    const chat = "77777777-7777-4777-8777-777777777777";
    withIntl(<RequestCard request={{ ...REQUEST, status: "in_contact", consultationId: chat }} group="inProgress" />);
    expect(screen.getByRole("link", { name: "Go to the conversation" }).getAttribute("href")).toBe(
      `/account/consultations/${chat}`,
    );
  });
});

describe("api", () => {
  it("opens with view by default and download on request", async () => {
    fetchMock.mockResolvedValue(json({ url: "https://s.test/x", expiresInSeconds: 60, accessMode: "view" }));
    await openDocument(A);
    await openDocument(A, "download");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `/api/documents/${A}/open`,
      `/api/documents/${A}/open?action=download`,
    ]);
  });

  it("adds Storage's download flag", () => {
    expect(downloadUrl("https://s.test/object/sign/x?token=t", "a.pdf")).toBe(
      "https://s.test/object/sign/x?token=t&download=a.pdf",
    );
  });

  it("reports a network failure without throwing", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await sendDocumentRequest([A], "x")).toEqual({ ok: false, status: 0, code: null, message: null });
  });

  it("names a download from the title", () => {
    expect(downloadName("شهادة دورة: 2026/11", "application/pdf")).toBe("شهادة-دورة-2026-11.pdf");
    expect(downloadName("***", "image/png")).toBe("document.png");
  });
});

describe("DocumentViewer", () => {
  const opened = (accessMode: "view" | "view_download" = "view") =>
    json({ url: "https://s.test/object/sign/document-views/c.pdf?token=t", expiresInSeconds: 60, accessMode });

  function show(over: Partial<{ mime: string; accessMode: "view" | "view_download" }> = {}, locale: "ar" | "en" = "en") {
    return withIntl(
      <DocumentViewer
        documentId={A}
        title="Course certificate"
        mime={over.mime ?? "application/pdf"}
        accessMode={over.accessMode ?? "view"}
        fetchImpl={fetchMock}
      />,
      locale,
    );
  }

  it("has no download button for a view-only document", async () => {
    fetchMock.mockResolvedValueOnce(opened()).mockResolvedValueOnce(new Response(new Uint8Array(8)));
    await act(async () => void show({}, "ar"));
    expect(screen.queryByRole("button", { name: "تحميل" })).toBeNull();
    expect(screen.getByText(/عرض فقط/)).toBeTruthy();
    expect(screen.getByTestId("pdf").textContent).toBe("Course certificate:8");
  });

  it("fetches the PDF once and draws it", async () => {
    fetchMock.mockResolvedValueOnce(opened()).mockResolvedValueOnce(new Response(new Uint8Array(12)));
    await act(async () => void show());
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      `/api/documents/${A}/open`,
      "https://s.test/object/sign/document-views/c.pdf?token=t",
    ]);
    expect(screen.getByTestId("pdf").textContent).toBe("Course certificate:12");
  });

  it("opens again when the link ran out before the file loaded", async () => {
    fetchMock
      .mockResolvedValueOnce(opened())
      .mockResolvedValueOnce(new Response("expired", { status: 400 }))
      .mockResolvedValueOnce(opened())
      .mockResolvedValueOnce(new Response(new Uint8Array(4)));
    await act(async () => void show());
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/"))).toHaveLength(2);
    expect(screen.getByTestId("pdf")).toBeTruthy();
  });

  it("shows the route's refusal, with a retry", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: "not_found", message: "Not available to you." } }, 404));
    await act(async () => void show());
    expect(screen.getByRole("alert").textContent).toContain("Not available to you.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("shows an image as is, with no overlay", async () => {
    fetchMock.mockResolvedValueOnce(opened());
    await act(async () => void show({ mime: "image/png" }));
    const image = screen.getByRole("img", { name: "Course certificate, with your watermark" });
    expect(image.getAttribute("src")).toBe("https://s.test/object/sign/document-views/c.pdf?token=t");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("downloads through the route's download action, for view and download only", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    fetchMock
      .mockResolvedValueOnce(opened("view_download"))
      .mockResolvedValueOnce(new Response(new Uint8Array(4)))
      .mockResolvedValueOnce(opened("view_download"));
    await act(async () => void show({ accessMode: "view_download" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Download" })));
    expect(String(fetchMock.mock.calls[2]?.[0])).toBe(`/api/documents/${A}/open?action=download`);
    expect(assign).toHaveBeenCalledWith(
      "https://s.test/object/sign/document-views/c.pdf?token=t&download=Course-certificate.pdf",
    );
  });
});

describe("read", () => {
  const row = {
    id: REQUEST.id,
    document_id: A,
    status: "granted",
    consultation_id: null,
    expires_at: null,
    created_at: "2026-11-14 10:00:00+00",
    document: { title_ar: "", title_en: "Course certificate", category: "course_certificate", access_mode: "view", mime: "application/pdf" },
  };

  it("reads the client's own requests, newest first, with the other title as a stand-in", async () => {
    const { client, queries } = fakeClient(() => ({ data: [row, { ...row, id: "bad", status: "rejected" }], error: null }));
    expect(await readOwnRequests("user_client", "ar", client)).toEqual([REQUEST]);
    const calls = callsOn(queries, "document_requests")[0];
    expect(calls).toContainEqual(["eq", "client_id", "user_client"]);
    expect(calls).toContainEqual(["order", "created_at", { ascending: false }]);
    expect(String(calls?.[0]?.[1])).not.toContain("storage_key");
  });

  it("reads one own request, or null", async () => {
    const found = fakeClient(() => ({ data: row, error: null }));
    expect(await readOwnRequest("user_client", REQUEST.id, "en", found.client)).toEqual(REQUEST);
    expect(callsOn(found.queries, "document_requests")[0]).toContainEqual(["eq", "client_id", "user_client"]);
    const none = fakeClient(() => ({ data: null, error: null }));
    expect(await readOwnRequest("user_client", REQUEST.id, "en", none.client)).toBeNull();
  });
});
