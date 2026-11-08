// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import content from "@/messages/en/DashboardContent.json";
import editorMessages from "@/messages/en/DashboardEditor.json";
import trust from "@/messages/en/DashboardTrust.json";
import arTrust from "@/messages/ar/DashboardTrust.json";
import { TrustBoard, type TrustBoardProps } from "./trust-board";

const refresh = vi.fn();
const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh, replace }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia;

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: true })));
  refresh.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const PARTNER = "11111111-1111-4111-8111-111111111111";
const QUOTE = "22222222-2222-4222-8222-222222222222";

const base: Omit<TrustBoardProps, "canEdit" | "canApprove"> = {
  testimonials: [
    {
      row: {
        id: QUOTE,
        authorEn: "Programme Director",
        quoteEn: "Careful, clear work.",
        partnerId: PARTNER,
        consentConfirmed: true,
        adminApproved: false,
        status: "draft",
      },
      hasLetter: true,
    },
  ],
  partners: [
    {
      row: { id: PARTNER, nameEn: "Example Relief", consentConfirmed: false, adminApproved: false, status: "draft" },
      hasLetter: false,
    },
  ],
  partnerOptions: [{ id: PARTNER, title: "Example Relief" }],
  mediaBase: "https://x.test/m/",
};

function renderBoard(rights: { canEdit: boolean; canApprove: boolean }) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ DashboardContent: content, DashboardEditor: editorMessages, DashboardTrust: trust }}
    >
      <TrustBoard {...base} {...rights} />
    </NextIntlClientProvider>,
  );
}

const testimonialCard = () =>
  within(screen.getByRole("list", { name: trust.testimonials.listHeading })).getAllByRole("listitem")[0];

describe("TrustBoard", () => {
  it("shows an editor no approve button, and why it can't be published", () => {
    renderBoard({ canEdit: true, canApprove: false });
    const card = testimonialCard();
    expect(within(card).queryByRole("button", { name: /Approve/ })).toBeNull();
    expect(within(card).getByText(trust.approval.onlyAdmin)).toBeTruthy();
    expect(within(card).getByText(content.editor.cantPublish)).toBeTruthy();
    expect(within(card).getByText(content.editor.problems.not_approved)).toBeTruthy();
    expect(within(card).queryByText(content.editor.problems.no_consent)).toBeNull();
    expect(within(card).getByText("Example Relief")).toBeTruthy();
  });

  it("opens the letter through the signed-URL route, never by its path", () => {
    renderBoard({ canEdit: true, canApprove: false });
    const link = within(testimonialCard()).getByRole("link", { name: trust.letter.open });
    expect(link.getAttribute("href")).toBe(`/en/dashboard/testimonials/letter?id=${QUOTE}`);
    expect(document.body.innerHTML).not.toContain("letters/");
  });

  it("lets the admin approve, through the approve route", async () => {
    renderBoard({ canEdit: true, canApprove: true });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Approve Programme Director" }));
    });
    expect(fetchMock).toHaveBeenCalledWith(`/api/admin/testimonials/${QUOTE}/approve`, expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ approved: true }),
    }));
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByText("Programme Director is approved. An editor can publish it now.")).toBeTruthy();
  });

  it("offers a withdrawal on an approved row, and says it drafts the row", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ DashboardContent: content, DashboardEditor: editorMessages, DashboardTrust: trust }}>
        <TrustBoard
          {...base}
          partners={[{ row: { ...base.partners[0].row, adminApproved: true, consentConfirmed: true }, hasLetter: false }]}
          canEdit={false}
          canApprove
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(trust.approval.withdrawNote)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Withdraw approval for Example Relief" }));
    });
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/admin/partners/${PARTNER}/approve`);
    expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify({ approved: false }));
  });

  it("shows the server's refusal when an approval fails", async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ error: { code: "forbidden", message: "Not allowed." } }), { status: 403 }),
    );
    renderBoard({ canEdit: false, canApprove: true });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Approve Programme Director" }));
    });
    expect(screen.getByRole("alert").textContent).toBe("Not allowed.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("hides edit and add from an approver without content.manage", () => {
    renderBoard({ canEdit: false, canApprove: true });
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
    expect(screen.queryByRole("link", { name: trust.testimonials.addTestimonial })).toBeNull();
  });

  it("edits inline, with the consent checkbox and the shared publish panel", async () => {
    renderBoard({ canEdit: true, canApprove: false });
    fireEvent.click(screen.getByRole("button", { name: "Edit Programme Director" }));
    const consent = screen.getByLabelText(trust.consent.label) as HTMLInputElement;
    expect(consent.checked).toBe(true);
    fireEvent.change(screen.getByLabelText(content.editor.statusLabel), { target: { value: "published" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: content.editor.save }));
    });
    // Not approved: the form refuses before sending anything.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getAllByText(content.editor.problems.not_approved).length).toBeGreaterThan(1);
  });
});

describe("DashboardTrust messages", () => {
  const keys = (value: unknown, prefix = ""): string[] =>
    value && typeof value === "object"
      ? Object.entries(value).flatMap(([key, child]) => keys(child, `${prefix}${key}.`))
      : [prefix.slice(0, -1)];

  it("has the same keys in Arabic and English", () => {
    expect(keys(arTrust).sort()).toEqual(keys(trust).sort());
  });

  it("uses the exact consent label in both languages", () => {
    expect(trust.consent.label).toBe("تمت الموافقة على النشر");
    expect(arTrust.consent.label).toBe("تمت الموافقة على النشر");
  });
});
