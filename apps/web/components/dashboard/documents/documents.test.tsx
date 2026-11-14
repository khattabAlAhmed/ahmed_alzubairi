// @vitest-environment jsdom
import { PERMISSIONS, type AdminDocument, type Permission } from "@repo/shared";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import arDocs from "@/messages/ar/DashboardDocuments.json";
import arWorkspace from "@/messages/ar/Workspace.json";
import enDocs from "@/messages/en/DashboardDocuments.json";
import enWorkspace from "@/messages/en/Workspace.json";
import { AccessLog } from "./access-log";
import { ACCESS_LOG_LIMIT, documentsAccess, loadAccessLog, loadDocument, profileNames } from "./data";
import { DeleteDocument } from "./delete-document";
import { DocumentForm } from "./document-form";
import { callsOn, fakeClient } from "./fake-client.test-helper";
import { PublishToggle } from "./publish-toggle";
import { deleteDocument, fileProblem } from "./send";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
const router = { refresh: vi.fn(), push: vi.fn() };
vi.mock("@/i18n/navigation", () => ({ useRouter: () => router }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: "en", messages: { DashboardDocuments: enDocs }, namespace: namespace as never }),
}));

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => json({ ok: true }));
  router.refresh.mockReset();
  router.push.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const DOC: AdminDocument = {
  id: "11111111-1111-4111-8111-111111111111",
  category: "thank_you_letter",
  titleAr: "خطاب شكر",
  titleEn: "Thank-you letter",
  mime: "application/pdf",
  accessMode: "view",
  status: "draft",
};

function withIntl(node: React.ReactNode, locale: "ar" | "en" = "en") {
  const messages =
    locale === "ar"
      ? { DashboardDocuments: arDocs, Workspace: arWorkspace }
      : { DashboardDocuments: enDocs, Workspace: enWorkspace };
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );
}

/** The calls `fetch` got: url, method and parsed body. */
function sent() {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    method: init?.method,
    body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : init?.body,
  }));
}

describe("documentsAccess", () => {
  const params = Promise.resolve({ locale: "en" });
  const grant = (keys: Permission[]) => vi.fn(async () => new Set<Permission>(keys));

  it.each([
    [[PERMISSIONS.DOCUMENTS_MANAGE, PERMISSIONS.DATA_DELETE, PERMISSIONS.DOCUMENT_REQUESTS_DECIDE], true, true, true],
    [[PERMISSIONS.DOCUMENTS_MANAGE], true, false, false],
    [[PERMISSIONS.DOCUMENTS_VIEW, PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND], false, false, false],
    [[PERMISSIONS.DATA_DELETE], false, true, false],
    [[], false, false, false],
  ] as const)("with %j: opens %s, deletes %s, sees the log %s", async (keys, allowed, canDelete, canSeeLog) => {
    const check = grant([...keys]);
    expect(await documentsAccess(params, check)).toEqual({ locale: "en", allowed, canDelete, canSeeLog });
    expect(check).toHaveBeenCalledWith(
      [PERMISSIONS.DOCUMENTS_MANAGE, PERMISSIONS.DATA_DELETE, PERMISSIONS.DOCUMENT_REQUESTS_DECIDE],
      "en",
    );
  });
});

describe("loadDocument", () => {
  it("maps the row and never selects the storage key", async () => {
    const { client, queries } = fakeClient(() => ({
      data: { id: DOC.id, category: DOC.category, title_ar: DOC.titleAr, title_en: DOC.titleEn, mime: DOC.mime, access_mode: "view", status: "draft" },
      error: null,
    }));
    expect(await loadDocument(DOC.id, client)).toEqual(DOC);
    const [select] = callsOn(queries, "documents")[0] ?? [];
    expect(String(select?.[1])).not.toContain("storage_key");
  });

  it("is null when RLS shows no row", async () => {
    const { client } = fakeClient(() => ({ data: null, error: null }));
    expect(await loadDocument(DOC.id, client)).toBeNull();
  });
});

describe("loadAccessLog", () => {
  const row = {
    id: "22222222-2222-4222-8222-222222222222",
    request_id: "33333333-3333-4333-8333-333333333333",
    document_id: DOC.id,
    client_id: "user_client",
    action: "view",
    created_at: "2026-11-14 10:00:00+00",
  };

  it("reads one document's log, newest first, with the client's name", async () => {
    const { client, queries } = fakeClient(() => ({ data: [row, { ...row, id: "x", action: "bogus" }], error: null }));
    const names = vi.fn(async () => new Map([["user_client", "Test Client"]]));
    const entries = await loadAccessLog({ documentId: DOC.id }, { user: client, names });
    expect(entries).toEqual([
      {
        id: row.id,
        requestId: row.request_id,
        documentId: DOC.id,
        clientId: "user_client",
        clientName: "Test Client",
        action: "view",
        createdAt: "2026-11-14T10:00:00.000Z",
      },
    ]);
    const calls = callsOn(queries, "document_access_log")[0];
    expect(calls).toContainEqual(["eq", "document_id", DOC.id]);
    expect(calls).toContainEqual(["order", "created_at", { ascending: false }]);
    expect(calls).toContainEqual(["limit", ACCESS_LOG_LIMIT]);
    expect(names).toHaveBeenCalledWith(["user_client", "user_client"]);
  });

  it("filters by request", async () => {
    const { client, queries } = fakeClient(() => ({ data: [], error: null }));
    await loadAccessLog({ requestId: row.request_id }, { user: client, names: async () => new Map() });
    expect(callsOn(queries, "document_access_log")[0]).toContainEqual(["eq", "request_id", row.request_id]);
  });

  it("throws the code only", async () => {
    const { client } = fakeClient(() => ({ data: null, error: { code: "42501" } }));
    await expect(loadAccessLog({ documentId: DOC.id }, { user: client })).rejects.toThrow(
      "access log read failed: 42501",
    );
  });
});

describe("profileNames", () => {
  it("reads nothing for no ids, and each id once", async () => {
    const { client, queries } = fakeClient(() => ({
      data: [{ clerk_user_id: "user_a", full_name: "A" }],
      error: null,
    }));
    expect((await profileNames([], client)).size).toBe(0);
    expect(queries).toHaveLength(0);
    expect((await profileNames(["user_a", "user_a"], client)).get("user_a")).toBe("A");
    expect(callsOn(queries, "profiles")[0]).toContainEqual(["in", "clerk_user_id", ["user_a"]]);
  });
});

describe("fileProblem", () => {
  it.each([
    ["a.pdf", "application/pdf", 1000, null],
    ["a.png", "image/png", 1000, null],
    ["a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 1000, "fileType"],
    ["a.pdf", "application/pdf", 11 * 1024 * 1024, "fileSize"],
  ] as const)("%s (%s, %i bytes): %s", (name, type, size, problem) => {
    const file = new File(["x"], name, { type });
    Object.defineProperty(file, "size", { value: size });
    expect(fileProblem(file)).toBe(problem);
  });
});

describe("DocumentForm", () => {
  it("asks for both titles and a file before uploading anything", async () => {
    withIntl(<DocumentForm />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add document" })));
    expect(screen.getAllByText("Fill this in.")).toHaveLength(2);
    expect(screen.getByText("Choose a file.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads with the document target, creates the row, then opens it", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ url: "https://storage.test/upload", key: "k/doc.pdf" }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(json({ key: "k/doc.pdf" }))
      .mockResolvedValueOnce(json({ id: DOC.id }));
    withIntl(<DocumentForm />);
    fireEvent.change(screen.getByLabelText("Title in Arabic"), { target: { value: " خطاب " } });
    fireEvent.change(screen.getByLabelText("Title in English"), { target: { value: "Letter" } });
    fireEvent.change(screen.getByLabelText("Access"), { target: { value: "view_download" } });
    const file = new File(["%PDF"], "doc.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("File"), { target: { files: [file] } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add document" })));

    const calls = sent();
    expect(calls[0]).toMatchObject({ url: "/api/admin/uploads/upload-url", body: { target: "document", mime: "application/pdf" } });
    expect(calls[2]).toMatchObject({ url: "/api/admin/uploads/finalize", body: { target: "document", key: "k/doc.pdf" } });
    expect(calls[3]).toEqual({
      url: "/api/admin/documents",
      method: "POST",
      body: {
        titleAr: "خطاب",
        titleEn: "Letter",
        category: "course_certificate",
        accessMode: "view_download",
        status: "draft",
        key: "k/doc.pdf",
      },
    });
    expect(router.push).toHaveBeenCalledWith(`/dashboard/documents/${DOC.id}`);
  });

  it("saves an edit without a new file and sends no key", async () => {
    withIntl(<DocumentForm document={DOC} />);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "published" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save changes" })));
    expect(sent()).toEqual([
      {
        url: "/api/admin/documents",
        method: "PATCH",
        body: {
          id: DOC.id,
          titleAr: DOC.titleAr,
          titleEn: DOC.titleEn,
          category: DOC.category,
          accessMode: "view",
          status: "published",
        },
      },
    ]);
    expect(screen.getByRole("status").textContent).toBe("Saved.");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows the server's message when the save is refused", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: "forbidden", message: "Not allowed." } }, 403));
    withIntl(<DocumentForm document={DOC} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save changes" })));
    expect(screen.getByRole("alert").textContent).toBe("Not allowed.");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("refuses a file that isn't a PDF, JPG or PNG", async () => {
    withIntl(<DocumentForm document={DOC} />);
    const file = new File(["x"], "a.docx", { type: "application/msword" });
    fireEvent.change(screen.getByLabelText("Replace the file"), { target: { files: [file] } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save changes" })));
    expect(screen.getByText("Choose a PDF, JPG or PNG file.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps unsaved edits and takes the new status after Publish elsewhere", () => {
    const { rerender } = withIntl(<DocumentForm document={DOC} />);
    fireEvent.change(screen.getByLabelText("Title in English"), { target: { value: "Edited" } });
    rerender(
      <NextIntlClientProvider locale="en" messages={{ DashboardDocuments: enDocs, Workspace: enWorkspace }}>
        <DocumentForm document={{ ...DOC, status: "published" }} />
      </NextIntlClientProvider>,
    );
    expect((screen.getByLabelText("Title in English") as HTMLInputElement).value).toBe("Edited");
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("published");
  });

  it("locks the fields while a save runs", async () => {
    let finish: (value: Response) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (finish = resolve)));
    withIntl(<DocumentForm document={DOC} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save changes" })));
    expect(screen.getByLabelText("Title in English").matches(":disabled")).toBe(true);
    expect(screen.getByLabelText("Replace the file").matches(":disabled")).toBe(true);
    await act(async () => finish(json({ ok: true })));
    expect(screen.getByLabelText("Title in English").matches(":disabled")).toBe(false);
  });

  it("renders in Arabic", () => {
    withIntl(<DocumentForm />, "ar");
    expect(screen.getByRole("button", { name: "إضافة الوثيقة" })).toBeTruthy();
    expect(screen.getByLabelText("العنوان بالعربية").getAttribute("dir")).toBe("rtl");
  });
});

describe("PublishToggle", () => {
  it("publishes a draft", async () => {
    withIntl(<PublishToggle id={DOC.id} title="Letter" status="draft" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Publish Letter" })));
    expect(sent()).toEqual([{ url: "/api/admin/documents", method: "PATCH", body: { id: DOC.id, status: "published" } }]);
    expect(router.refresh).toHaveBeenCalled();
  });

  it("unpublishes a published one", async () => {
    withIntl(<PublishToggle id={DOC.id} title="Letter" status="published" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Unpublish Letter" })));
    expect(sent()[0]?.body).toEqual({ id: DOC.id, status: "draft" });
  });
});

describe("DeleteDocument", () => {
  it("sends the row id in the path and the body, after both steps", async () => {
    expect(await deleteDocument(DOC.id, fetchMock)).toEqual({ ok: true, body: { ok: true } });
    expect(sent()).toEqual([
      { url: `/api/admin/documents/${DOC.id}`, method: "DELETE", body: { confirm: DOC.id } },
    ]);
  });

  it("asks twice before deleting", async () => {
    withIntl(<DeleteDocument id={DOC.id} title="Letter" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete document" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const confirm = screen.getByRole("button", { name: "Delete for good" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "DELETE" } });
    await act(async () => fireEvent.click(confirm));
    expect(sent()[0]).toMatchObject({ method: "DELETE", body: { confirm: DOC.id } });
    expect(router.push).toHaveBeenCalledWith("/dashboard/documents");
  });
});

describe("AccessLog", () => {
  const entry = {
    id: "22222222-2222-4222-8222-222222222222",
    requestId: "33333333-3333-4333-8333-333333333333",
    documentId: DOC.id,
    clientId: "user_client",
    clientName: "Test Client",
    action: "download" as const,
    createdAt: "2026-11-14T10:00:00.000Z",
  };

  it("lists who opened it and how", async () => {
    render(await AccessLog({ entries: [entry, { ...entry, id: "b", clientName: "", action: "view" }], locale: "en", scope: "document" }));
    expect(screen.getByText("Test Client")).toBeTruthy();
    expect(screen.getByText("Downloaded")).toBeTruthy();
    expect(screen.getByText("Viewed")).toBeTruthy();
    expect(screen.getByText("(unknown client)")).toBeTruthy();
    expect(screen.queryByText(/Showing the latest/)).toBeNull();
  });

  it("says when no one has opened it", async () => {
    render(await AccessLog({ entries: [], locale: "en", scope: "request" }));
    expect(screen.getByText("No one has opened it yet.")).toBeTruthy();
  });

  it("says when the list is cut at the limit", async () => {
    const many = Array.from({ length: ACCESS_LOG_LIMIT }, (_, index) => ({ ...entry, id: String(index) }));
    render(await AccessLog({ entries: many, locale: "en", scope: "document" }));
    expect(screen.getByText(`Showing the latest ${ACCESS_LOG_LIMIT}.`)).toBeTruthy();
  });
});
