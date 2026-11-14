// @vitest-environment jsdom
import {
  CONSULTATION_STATUSES,
  DOCUMENT_ACCESS_MODES,
  DOCUMENT_CATEGORIES,
  DOCUMENT_REQUEST_STATUSES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "@repo/shared";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/Workspace.json";
import en from "@/messages/en/Workspace.json";
import {
  allowedTypeNames,
  attachmentRefusal,
  ChatMessage,
  Composer,
  ConfirmTwice,
  DocumentCard,
  FileChip,
  fileKind,
  formatBytes,
  MeetingCard,
  StatusPill,
  wordMatches,
} from ".";

afterEach(cleanup);

function wrap(node: ReactNode, locale: "ar" | "en" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ Workspace: locale === "ar" ? ar : en }}>
      {node}
    </NextIntlClientProvider>,
  );
}

describe("StatusPill", () => {
  it.each(["ar", "en"] as const)("labels every consultation status in %s", (locale) => {
    const messages = locale === "ar" ? ar : en;
    for (const status of CONSULTATION_STATUSES) {
      const label = messages.status.consultation[status];
      expect(label, status).toBeTruthy();
      wrap(<StatusPill kind="consultation" status={status} />, locale);
      expect(screen.getByText(label)).toBeTruthy();
      cleanup();
    }
  });

  it.each(["ar", "en"] as const)("labels every document request status in %s", (locale) => {
    const messages = locale === "ar" ? ar : en;
    for (const status of DOCUMENT_REQUEST_STATUSES) {
      const label = messages.status.documentRequest[status];
      expect(label, status).toBeTruthy();
      wrap(<StatusPill kind="documentRequest" status={status} />, locale);
      expect(screen.getByText(label)).toBeTruthy();
      cleanup();
    }
  });

  it("uses the §6.17 and §6.18 Arabic labels", () => {
    expect(ar.status.consultation).toEqual({
      new: "جديد",
      in_review: "قيد المراجعة",
      in_progress: "قيد المتابعة",
      scheduled: "موعد مجدول",
      closed: "مغلق",
    });
    expect(ar.status.documentRequest).toEqual({
      pending_review: "بانتظار المراجعة",
      in_contact: "قيد التواصل",
      granted: "متاحة",
      expired: "منتهية",
      revoked: "مسحوبة",
    });
  });
});

describe("ChatMessage", () => {
  it("renders <b> and a script tag as visible text, never as HTML", () => {
    const body = "<b>x</b> <script>alert(1)</script>";
    const { container } = wrap(
      <ChatMessage senderName="<i>Sara</i>" mine={false} body={body} sentAt="2026-11-20T11:00:00Z" timeZone="UTC" />,
    );
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("i")).toBeNull();
    expect(screen.getByText(body)).toBeTruthy();
    expect(screen.getByText("<i>Sara</i>")).toBeTruthy();
  });

  it("keeps line breaks as text, without adding <br>", () => {
    const { container } = wrap(
      <ChatMessage senderName="Sara" mine body={"first\nsecond"} sentAt="2026-11-20T11:00:00Z" timeZone="UTC" />,
    );
    const paragraph = container.querySelector("p[dir='auto']");
    expect(paragraph?.textContent).toBe("first\nsecond");
    expect(paragraph?.querySelector("br")).toBeNull();
    expect(paragraph?.className).toContain("whitespace-pre-wrap");
  });

  it("says You for the viewer's own message and sits on the end side", () => {
    const { container } = wrap(
      <ChatMessage senderName="Sara" mine body="hi" sentAt="2026-11-20T11:00:00Z" timeZone="UTC" />,
    );
    expect(screen.getByRole("article", { name: "You" })).toBeTruthy();
    expect(container.querySelector("article")?.className).toContain("justify-end");
  });

  it("names the zone with the time", () => {
    wrap(<ChatMessage senderName="Sara" mine={false} body="hi" sentAt="2026-11-20T11:00:00Z" timeZone="Asia/Riyadh" />);
    expect(screen.getByText(/2:00 PM GMT\+3/)).toBeTruthy();
  });
});

describe("ConfirmTwice", () => {
  function open(onConfirm = vi.fn()) {
    wrap(
      <ConfirmTwice
        open
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        title="Delete chat"
        question="Delete this chat and its files?"
        word="DELETE"
        confirmLabel="Delete for good"
      />,
    );
    return onConfirm;
  }

  it("asks first, then keeps the final button disabled until the word matches", () => {
    const onConfirm = open();
    expect(screen.queryByRole("button", { name: "Delete for good" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const final = screen.getByRole<HTMLButtonElement>("button", { name: "Delete for good" });
    expect(final.disabled).toBe(true);
    const field = screen.getByLabelText("To confirm, type the word: DELETE");
    fireEvent.change(field, { target: { value: "DELET" } });
    expect(final.disabled).toBe(true);
    expect(screen.getByText("The word doesn't match.")).toBeTruthy();
    fireEvent.click(final);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: " DELETE " } });
    expect(final.disabled).toBe(false);
    fireEvent.click(final);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("renders nothing while closed", () => {
    wrap(
      <ConfirmTwice open={false} onCancel={vi.fn()} onConfirm={vi.fn()} title="t" question="q" word="w" confirmLabel="c" />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("matches the word exactly, apart from outer spaces and Unicode form", () => {
    expect(wordMatches("حذف", "حذف")).toBe(true);
    expect(wordMatches("  حذف ", "حذف")).toBe(true);
    expect(wordMatches("delete", "DELETE")).toBe(false);
    expect(wordMatches("", "DELETE")).toBe(false);
  });
});

describe("FileChip", () => {
  const base = { id: "f1", name: "report.pdf", sizeBytes: 2_516_582, mime: "application/pdf" };

  it("shows upload progress", () => {
    wrap(<FileChip file={{ ...base, state: "uploading", progress: 42 }} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("42");
    expect(screen.getByText("Uploading 42%")).toBeTruthy();
  });

  it("shows the refusal reason with the limit", () => {
    wrap(<FileChip file={{ ...base, state: "refused", reason: "tooLarge" }} />);
    expect(screen.getByRole("alert").textContent).toBe("It's larger than 10 MB.");
  });

  it("renders the name as text and offers remove", () => {
    const onRemove = vi.fn();
    const { container } = wrap(
      <FileChip file={{ ...base, name: "<img src=x onerror=alert(1)>.pdf", state: "ready" }} onRemove={onRemove} />,
    );
    expect(container.querySelector("img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove <img src=x onerror=alert(1)>.pdf" }));
    expect(onRemove).toHaveBeenCalledWith("f1");
  });
});

describe("Composer", () => {
  function setup(props: Partial<Parameters<typeof Composer>[0]> = {}) {
    const onSend = vi.fn();
    wrap(
      <Composer
        value=""
        onChange={vi.fn()}
        files={[]}
        onAttach={vi.fn()}
        onRemoveFile={vi.fn()}
        onSend={onSend}
        {...props}
      />,
    );
    return onSend;
  }

  it("shows the limit line from the shared limits", () => {
    setup();
    expect(screen.getByText(`Up to ${MAX_ATTACHMENTS_PER_MESSAGE} files per message, 10 MB each. Allowed types: PDF, DOCX, XLSX, JPG, PNG.`)).toBeTruthy();
  });

  it("keeps the typed text when an error shows", () => {
    setup({ value: "My detailed question", error: "The message wasn't sent." });
    expect(screen.getByRole("alert").textContent).toBe("The message wasn't sent.");
    expect(screen.getByLabelText<HTMLTextAreaElement>("Your message").value).toBe("My detailed question");
  });

  it("waits for uploads and needs text or a ready file", () => {
    const onSend = setup({
      value: "hello",
      files: [{ id: "a", name: "a.pdf", sizeBytes: 10, mime: "application/pdf", state: "uploading", progress: 10 }],
    });
    const send = screen.getByRole<HTMLButtonElement>("button", { name: "Send" });
    expect(send.disabled).toBe(true);
    cleanup();
    setup({ value: "   " });
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Send" }).disabled).toBe(true);
    cleanup();
    const ready = setup({ value: "hello" });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(ready).toHaveBeenCalledOnce();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("passes picked files up and disables attach at the limit", () => {
    const onAttach = vi.fn();
    setup({ onAttach });
    const input = screen.getByLabelText<HTMLInputElement>("Attach files");
    const file = new File(["x"], "a.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onAttach).toHaveBeenCalledWith([file]);
    cleanup();
    const full = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE }, (_, i) => ({
      id: String(i),
      name: `${i}.pdf`,
      sizeBytes: 10,
      mime: "application/pdf",
      state: "ready" as const,
    }));
    setup({ files: full });
    expect(screen.getByLabelText<HTMLInputElement>("Attach files").disabled).toBe(true);
  });
});

describe("MeetingCard and DocumentCard", () => {
  it("shows the meeting date, time range, duration and the named zone", () => {
    wrap(
      <MeetingCard platform="Zoom" url="https://zoom.us/j/1" startsAt="2026-11-20T11:00:00Z" durationMinutes={45} timeZone="Asia/Riyadh" />,
    );
    expect(screen.getByText("Friday, November 20, 2026")).toBeTruthy();
    expect(screen.getByText(/2:00\s*–\s*2:45\s*PM/)).toBeTruthy();
    expect(screen.getByText("45 minutes")).toBeTruthy();
    expect(screen.getByText("Arabian Standard Time (GMT+3)")).toBeTruthy();
    const join = screen.getByRole("link", { name: "Join the meeting on Zoom (opens in a new window)" });
    expect(join.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("labels every category and access mode in both languages", () => {
    for (const messages of [ar, en]) {
      for (const category of DOCUMENT_CATEGORIES) expect(messages.document.categories[category]).toBeTruthy();
      for (const mode of DOCUMENT_ACCESS_MODES) expect(messages.document.accessModes[mode]).toBeTruthy();
    }
    expect(ar.document.accessModes).toEqual({ view: "عرض فقط", view_download: "عرض وتحميل" });
  });

  it("shows the document's category, access mode, status and actions", () => {
    wrap(
      <DocumentCard
        title="Certificate"
        category="course_certificate"
        accessMode="view"
        status="granted"
        actions={<button type="button">View</button>}
      />,
      "ar",
    );
    const card = screen.getByRole("article");
    expect(within(card).getByText("شهادة دورة")).toBeTruthy();
    expect(within(card).getByText("عرض فقط")).toBeTruthy();
    expect(within(card).getByText("متاحة")).toBeTruthy();
    expect(within(card).getByRole("button", { name: "View" })).toBeTruthy();
  });
});

describe("attachment helpers", () => {
  it("refuses before upload: too many, wrong type, too large", () => {
    const pdf = { name: "a.pdf", size: 100, type: "application/pdf" };
    expect(attachmentRefusal(pdf, 0)).toBeNull();
    expect(attachmentRefusal(pdf, MAX_ATTACHMENTS_PER_MESSAGE)).toBe("tooMany");
    expect(attachmentRefusal({ ...pdf, type: "application/zip", name: "a.zip" }, 0)).toBe("wrongType");
    expect(attachmentRefusal({ ...pdf, name: "a.exe" }, 0)).toBe("wrongType");
    expect(attachmentRefusal({ ...pdf, size: MAX_ATTACHMENT_BYTES + 1 }, 0)).toBe("tooLarge");
    expect(attachmentRefusal({ ...pdf, size: MAX_ATTACHMENT_BYTES }, 0)).toBeNull();
  });

  it("groups files by type, and anything unknown, including inherited keys, is other", () => {
    expect(fileKind("application/pdf")).toBe("pdf");
    expect(fileKind("image/jpeg")).toBe("image");
    expect(fileKind("application/zip")).toBe("other");
    expect(fileKind("toString")).toBe("other");
    expect(fileKind("__proto__")).toBe("other");
    expect(fileKind("constructor")).toBe("other");
  });

  it("names the allowed types and formats sizes", () => {
    expect(allowedTypeNames()).toEqual(["PDF", "DOCX", "XLSX", "JPG", "PNG"]);
    expect(formatBytes(MAX_ATTACHMENT_BYTES, "en")).toBe("10 MB");
    expect(formatBytes(240 * 1024, "en")).toBe("240 kB");
  });
});
