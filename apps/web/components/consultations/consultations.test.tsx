// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import arPage from "@/messages/ar/AccountConsultations.json";
import arWorkspace from "@/messages/ar/Workspace.json";
import enPage from "@/messages/en/AccountConsultations.json";
import enWorkspace from "@/messages/en/Workspace.json";
import { ApiError, consultationApi, type ConsultationApi, type PutFile } from "./api";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => router,
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { NewConsultationForm, preselectedService } = await import("./new-consultation-form");
const { ConsultationThread, attachmentHref } = await import("./consultation-thread");

const SERVICES = [
  { id: "11111111-1111-4111-8111-111111111111", slug: "strategy-review", title: "Strategy review" },
  { id: "22222222-2222-4222-8222-222222222222", slug: "governance", title: "Governance" },
];
const CONSULTATION = "33333333-3333-4333-8333-333333333333";

function wrap(node: ReactNode, locale: "ar" | "en" = "en") {
  const messages =
    locale === "ar"
      ? { AccountConsultations: arPage, Workspace: arWorkspace }
      : { AccountConsultations: enPage, Workspace: enWorkspace };
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );
}

function fakeApi(overrides: Partial<ConsultationApi> = {}): ConsultationApi & {
  create: ReturnType<typeof vi.fn>;
  upload: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn(async () => CONSULTATION),
    upload: vi.fn(async () => "44444444-4444-4444-8444-444444444444"),
    sendMessage: vi.fn(async () => "55555555-5555-4555-8555-555555555555"),
    linkedAttachmentIds: vi.fn(async () => new Set<string>()),
    downloadUrl: vi.fn(async () => "https://storage.invalid/signed"),
    ...overrides,
  } as never;
}

const pdf = (name = "brief.pdf") => new File(["%PDF-1.7"], name, { type: "application/pdf" });

function pick(files: File[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files } });
}

function fillForm() {
  fireEvent.change(screen.getByLabelText(enPage.form.service), { target: { value: SERVICES[0]!.id } });
  fireEvent.change(screen.getByLabelText(enPage.form.consultationTitle), { target: { value: "Board charter" } });
  fireEvent.change(screen.getByLabelText(enPage.form.description), {
    target: { value: "We need a review of our charter." },
  });
}

beforeEach(() => {
  router.push.mockReset();
  router.refresh.mockReset();
});
afterEach(cleanup);

describe("preselectedService", () => {
  it("matches ?service by slug, or by id from an older link", () => {
    expect(preselectedService(SERVICES, "governance")).toBe(SERVICES[1]!.id);
    expect(preselectedService(SERVICES, SERVICES[0]!.id)).toBe(SERVICES[0]!.id);
  });

  it("selects nothing for an unknown or missing value", () => {
    expect(preselectedService(SERVICES, "nope")).toBe("");
    expect(preselectedService(SERVICES, undefined)).toBe("");
  });
});

describe("NewConsultationForm", () => {
  it("preselects the service from ?service and prefills the organization", () => {
    wrap(<NewConsultationForm services={SERVICES} initialService="governance" organization="Ministry X" api={fakeApi()} />);
    expect((screen.getByLabelText(enPage.form.service) as HTMLSelectElement).value).toBe(SERVICES[1]!.id);
    expect((screen.getByLabelText(enPage.form.organization) as HTMLInputElement).value).toBe("Ministry X");
  });

  it("asks for the required fields and sends nothing", async () => {
    const api = fakeApi();
    wrap(<NewConsultationForm services={SERVICES} organization={null} api={api} />);
    fireEvent.click(screen.getByRole("button", { name: enPage.form.submit }));
    expect(await screen.findByText(enPage.form.serviceRequired)).toBeTruthy();
    expect(screen.getByText(enPage.form.titleRequired)).toBeTruthy();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("refuses a wrong file type before upload, with its reason", async () => {
    const api = fakeApi();
    wrap(<NewConsultationForm services={SERVICES} organization={null} api={api} />);
    pick([new File(["MZ"], "setup.exe", { type: "application/x-msdownload" })]);
    expect(await screen.findByText(enWorkspace.file.reasons.wrongType)).toBeTruthy();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: enPage.form.submit }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(api.upload).not.toHaveBeenCalled();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("creates, uploads, posts the first message with the files, then opens the consultation", async () => {
    const api = fakeApi();
    wrap(<NewConsultationForm services={SERVICES} organization="Ministry X" api={api} />);
    fillForm();
    pick([pdf()]);
    fireEvent.click(screen.getByRole("button", { name: enPage.form.submit }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/account/consultations/${CONSULTATION}`));
    expect(api.create).toHaveBeenCalledWith({
      serviceId: SERVICES[0]!.id,
      title: "Board charter",
      description: "We need a review of our charter.",
      organization: "Ministry X",
    });
    expect(api.upload).toHaveBeenCalledWith(CONSULTATION, expect.any(File), expect.any(Function));
    expect(api.sendMessage).toHaveBeenCalledWith(CONSULTATION, {
      attachmentIds: ["44444444-4444-4444-8444-444444444444"],
    });
  });

  it("posts no message when there are no files", async () => {
    const api = fakeApi();
    wrap(<NewConsultationForm services={SERVICES} organization={null} api={api} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: enPage.form.submit }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("keeps everything typed after a failed upload, and a retry doesn't create a second consultation", async () => {
    const api = fakeApi();
    api.upload.mockRejectedValueOnce(new ApiError("The file didn't finish uploading. Try again."));
    wrap(<NewConsultationForm services={SERVICES} organization={null} api={api} />);
    fillForm();
    pick([pdf()]);
    fireEvent.click(screen.getByRole("button", { name: enPage.form.submit }));

    const alert = await screen.findByText(/The file didn't finish uploading/);
    expect(alert.textContent).toContain(enPage.form.retry);
    expect(screen.getByText(enWorkspace.file.reasons.failed)).toBeTruthy();
    expect((screen.getByLabelText(enPage.form.consultationTitle) as HTMLInputElement).value).toBe("Board charter");
    expect((screen.getByLabelText(enPage.form.description) as HTMLTextAreaElement).value).toBe(
      "We need a review of our charter.",
    );
    expect(router.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: enPage.form.submit }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/account/consultations/${CONSULTATION}`));
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.upload).toHaveBeenCalledTimes(2);
  });

  it("doesn't send the first message again when the lost one had landed", async () => {
    const api = fakeApi();
    api.sendMessage.mockRejectedValueOnce(new ApiError(null));
    (api.linkedAttachmentIds as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Set(["44444444-4444-4444-8444-444444444444"]),
    );
    wrap(<NewConsultationForm services={SERVICES} organization={null} api={api} />);
    fillForm();
    pick([pdf()]);
    fireEvent.click(screen.getByRole("button", { name: enPage.form.submit }));
    expect(await screen.findByText(enPage.form.failed)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: enPage.form.submit }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/account/consultations/${CONSULTATION}`));
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.upload).toHaveBeenCalledTimes(1);
    expect(api.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("sends the first message again when the lost one hadn't landed", async () => {
    const api = fakeApi();
    api.sendMessage.mockRejectedValueOnce(new ApiError(null));
    wrap(<NewConsultationForm services={SERVICES} organization={null} api={api} />);
    fillForm();
    pick([pdf()]);
    fireEvent.click(screen.getByRole("button", { name: enPage.form.submit }));
    expect(await screen.findByText(enPage.form.failed)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: enPage.form.submit }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(api.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("counts a failed upload toward the file limit", async () => {
    const api = fakeApi();
    api.upload.mockRejectedValueOnce(new ApiError(null));
    wrap(<NewConsultationForm services={SERVICES} organization={null} api={api} />);
    fillForm();
    pick([pdf("1.pdf"), pdf("2.pdf"), pdf("3.pdf"), pdf("4.pdf")]);
    fireEvent.click(screen.getByRole("button", { name: enPage.form.submit }));
    expect(await screen.findByText(enWorkspace.file.reasons.failed)).toBeTruthy();
    pick([pdf("5.pdf"), pdf("6.pdf")]);
    expect(await screen.findByText(enWorkspace.file.reasons.tooMany.replace("{count}", "5"))).toBeTruthy();
  });

  it("shows the server's message when the request is refused, and keeps the text", async () => {
    const api = fakeApi({ create: vi.fn(async () => Promise.reject(new ApiError("This service isn't available."))) });
    wrap(<NewConsultationForm services={SERVICES} organization={null} api={api} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: enPage.form.submit }));
    expect(await screen.findByText("This service isn't available.")).toBeTruthy();
    expect((screen.getByLabelText(enPage.form.consultationTitle) as HTMLInputElement).value).toBe("Board charter");
  });

  it("renders in Arabic", () => {
    wrap(<NewConsultationForm services={SERVICES} organization={null} api={fakeApi()} />, "ar");
    expect(screen.getByRole("button", { name: arPage.form.submit })).toBeTruthy();
  });
});

const MESSAGES = [
  {
    id: "m1",
    senderName: "Client Name",
    mine: true,
    body: "<b>bold?</b>\n<script>alert(1)</script>",
    sentAt: "2026-11-14T10:00:00.000Z",
    attachments: [
      {
        id: "a1",
        name: "brief.pdf",
        sizeBytes: 2048,
        mime: "application/pdf",
        state: "ready" as const,
        href: attachmentHref("a1"),
      },
    ],
  },
  { id: "m2", senderName: "Team Member", mine: false, body: "Thanks.", sentAt: "2026-11-14T11:00:00.000Z", attachments: [] },
];

describe("ConsultationThread", () => {
  it("renders messages as text, never HTML, in time order", () => {
    const { container } = wrap(<ConsultationThread consultationId={CONSULTATION} messages={MESSAGES} closed={false} api={fakeApi()} />);
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(/<b>bold\?<\/b>/)).toBeTruthy();
    const articles = screen.getAllByRole("article");
    expect(within(articles[0]!).getByText(/bold/)).toBeTruthy();
    expect(within(articles[1]!).getByText("Thanks.")).toBeTruthy();
  });

  it("hides the composer when closed, with the closed note", () => {
    wrap(<ConsultationThread consultationId={CONSULTATION} messages={MESSAGES} closed api={fakeApi()} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(enPage.detail.closed)).toBeTruthy();
  });

  it("shows the composer when open, sends a reply and refreshes", async () => {
    const api = fakeApi();
    wrap(<ConsultationThread consultationId={CONSULTATION} messages={[]} closed={false} api={api} />);
    expect(screen.getByText(enPage.detail.noMessages)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(enPage.detail.reply), { target: { value: "  Hello  " } });
    fireEvent.click(screen.getByRole("button", { name: enWorkspace.composer.send }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(api.sendMessage).toHaveBeenCalledWith(CONSULTATION, { body: "Hello" });
  });

  it("keeps text typed while the reply was sending", async () => {
    let finish: (id: string) => void = () => {};
    const api = fakeApi({ sendMessage: vi.fn(() => new Promise<string>((resolve) => (finish = resolve))) });
    wrap(<ConsultationThread consultationId={CONSULTATION} messages={[]} closed={false} api={api} />);
    const box = screen.getByLabelText(enPage.detail.reply) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "First" } });
    fireEvent.click(screen.getByRole("button", { name: enWorkspace.composer.send }));
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalled());
    fireEvent.change(box, { target: { value: "Second draft" } });
    finish("m");
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(box.value).toBe("Second draft");
  });

  it("retries a reply whose only file failed", async () => {
    const api = fakeApi();
    api.upload.mockRejectedValueOnce(new ApiError(null));
    wrap(<ConsultationThread consultationId={CONSULTATION} messages={[]} closed={false} api={api} />);
    pick([pdf()]);
    fireEvent.click(screen.getByRole("button", { name: enWorkspace.composer.send }));
    fireEvent.click(await screen.findByRole("button", { name: enPage.detail.retry }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(api.upload).toHaveBeenCalledTimes(2);
    expect(api.sendMessage).toHaveBeenCalledWith(CONSULTATION, {
      attachmentIds: ["44444444-4444-4444-8444-444444444444"],
    });
  });

  it("keeps the reply text when sending fails", async () => {
    const api = fakeApi({ sendMessage: vi.fn(async () => Promise.reject(new ApiError(null))) });
    wrap(<ConsultationThread consultationId={CONSULTATION} messages={[]} closed={false} api={api} />);
    fireEvent.change(screen.getByLabelText(enPage.detail.reply), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: enWorkspace.composer.send }));
    expect(await screen.findByText(enPage.detail.sendFailed)).toBeTruthy();
    expect((screen.getByLabelText(enPage.detail.reply) as HTMLTextAreaElement).value).toBe("Hello");
  });

  it("opens a file through GET /api/attachments/:id", async () => {
    const api = fakeApi({ downloadUrl: vi.fn(async () => Promise.reject(new ApiError(null))) });
    wrap(<ConsultationThread consultationId={CONSULTATION} messages={MESSAGES} closed={false} api={api} />);
    fireEvent.click(screen.getByRole("link", { name: "brief.pdf" }));
    await waitFor(() => expect(api.downloadUrl).toHaveBeenCalledWith("a1"));
    expect(await screen.findByText(enPage.detail.downloadFailed)).toBeTruthy();
  });
});

describe("consultationApi", () => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("upload: asks for a URL, sends the file, then finalizes", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith("/upload-url") ? json({ url: "https://storage.invalid/put", attachmentId: "a1" }) : json({ ok: true }),
    );
    const put = vi.fn<PutFile>(async () => {});
    const id = await consultationApi(fetchImpl as never, put).upload(CONSULTATION, pdf(), () => {});
    expect(id).toBe("a1");
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      `/api/consultations/${CONSULTATION}/attachments/upload-url`,
      `/api/consultations/${CONSULTATION}/attachments/finalize`,
    ]);
    expect(JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({
      fileName: "brief.pdf",
      mime: "application/pdf",
      sizeBytes: 8,
    });
    expect(put).toHaveBeenCalledWith("https://storage.invalid/put", expect.any(File), expect.any(Function));
  });

  it("carries the server's localized message on a refusal", async () => {
    const fetchImpl = vi.fn(async () => json({ error: { code: "file_type_not_allowed", message: "Not allowed." } }, 415));
    await expect(consultationApi(fetchImpl as never).upload(CONSULTATION, pdf(), () => {})).rejects.toMatchObject({
      serverMessage: "Not allowed.",
    });
  });

  it("downloadUrl reads the signed URL", async () => {
    const fetchImpl = vi.fn(async () => json({ url: "https://storage.invalid/signed" }));
    expect(await consultationApi(fetchImpl as never).downloadUrl("a1")).toBe("https://storage.invalid/signed");
    expect(fetchImpl).toHaveBeenCalledWith("/api/attachments/a1", undefined);
  });
});
