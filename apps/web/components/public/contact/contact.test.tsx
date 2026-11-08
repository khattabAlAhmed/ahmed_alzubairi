// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/Contact.json";
import en from "@/messages/en/Contact.json";

vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

const { ContactForm } = await import("./contact-form");
const { ContactChannels, contactChannels } = await import("./channels");

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fill(values: Partial<Record<"name" | "email" | "orgType" | "subject" | "message", string>>) {
  for (const [name, value] of Object.entries(values)) {
    const field = document.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
    fireEvent.change(field, { target: { value } });
  }
}

const VALID = {
  name: "Example Visitor",
  email: "visitor@example.com",
  orgType: "company",
  subject: "A question",
  message: "<script>alert(1)</script>",
};

const submit = () => fireEvent.click(screen.getByRole("button", { name: "send" }));

describe("ContactForm", () => {
  it("checks each field before sending, and sends nothing while one is invalid", () => {
    render(<ContactForm />);
    fill({ ...VALID, email: "nope", subject: "  " });
    submit();
    expect(screen.getByText("emailInvalid")).toBeTruthy();
    expect(screen.getByText("required")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("moves focus to the first invalid field, from this attempt's errors", () => {
    render(<ContactForm />);
    fill({ ...VALID, email: "nope", subject: "" });
    submit();
    expect(document.activeElement?.getAttribute("name")).toBe("email");
    fill({ email: VALID.email });
    submit();
    expect(document.activeElement?.getAttribute("name")).toBe("subject");
  });

  it("asks for an organization type", () => {
    render(<ContactForm />);
    fill({ ...VALID, orgType: "" });
    submit();
    expect(screen.getByText("orgTypeRequired")).toBeTruthy();
  });

  it("posts the trimmed message and shows the confirmation", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }));
    render(<ContactForm />);
    fill({ ...VALID, name: "  Example Visitor  " });
    submit();
    await screen.findByRole("heading", { name: "sentTitle" });
    expect(screen.getByRole("status").textContent).toContain("sentText");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/contact");
    expect(JSON.parse(init.body)).toEqual(VALID);
  });

  it("shows the server's message and keeps what the visitor typed", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "rate_limited", message: "Slow down." } }), { status: 429 }),
    );
    render(<ContactForm />);
    fill(VALID);
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe("Slow down.");
    for (const [name, value] of Object.entries(VALID)) {
      expect(document.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value).toBe(value);
    }
  });

  it("keeps the typed values on a network error too", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    render(<ContactForm />);
    fill(VALID);
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe("networkError");
    expect(document.querySelector<HTMLTextAreaElement>('[name="message"]')!.value).toBe(VALID.message);
  });

  it("starts an empty form after 'send another'", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }));
    render(<ContactForm />);
    fill(VALID);
    submit();
    fireEvent.click(await screen.findByRole("button", { name: "sendAnother" }));
    await waitFor(() => expect(document.querySelector<HTMLInputElement>('[name="name"]')!.value).toBe(""));
  });
});

describe("contact channels", () => {
  const settings = {
    contactEmail: "contact@example.com",
    whatsappNumber: "+967700000000",
    linkedinUrl: "https://www.linkedin.com/in/example",
    socialLinks: [{ platform: "X", url: "https://x.com/example" }],
  };

  it("lists each channel set in site settings, with its link", () => {
    expect(contactChannels(settings, (key) => key).map(({ label, href }) => [label, href])).toEqual([
      ["email", "mailto:contact@example.com"],
      ["whatsapp", "https://wa.me/967700000000"],
      ["linkedin", "https://www.linkedin.com/in/example"],
      ["X", "https://x.com/example"],
    ]);
  });

  it("leaves out unset channels, and the whole list when none is set", () => {
    const none = { contactEmail: null, whatsappNumber: null, linkedinUrl: null, socialLinks: [] };
    expect(contactChannels({ ...none, contactEmail: "a@example.com" }, (key) => key)).toHaveLength(1);
    const { container } = render(<ContactChannels settings={none} />);
    expect(container.innerHTML).toBe("");
  });

  it("opens external channels in a new tab, and says so", () => {
    render(<ContactChannels settings={settings} />);
    const linkedin = screen.getByRole("link", { name: /linkedin/ });
    expect(linkedin.getAttribute("target")).toBe("_blank");
    expect(linkedin.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("link", { name: /contact@example.com/ }).getAttribute("target")).toBeNull();
  });
});

describe("Contact messages", () => {
  it("never promise a response time (§6.14)", () => {
    const text = JSON.stringify([ar, en]);
    expect(text).not.toMatch(/\d|hour|day|week|within|soon|respond|reply|ساع|يوم|أيام|أسبوع|خلال|قريب|سأرد|الرد/i);
  });
});
