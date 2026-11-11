import type { Tables as DbTables } from "@repo/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import { fakeService, outboxRow, type Row, type Tables } from "./fake-db";
import { FALLBACK_TEMPLATE } from "./fallback";
import { renderOutboxRow, TemplateReadError } from "./render";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

let tables: Tables;

const row = (rest: Row = {}) => outboxRow(rest) as DbTables<"email_outbox">;

function useTemplate(event: string, text: Partial<Record<string, string>>) {
  tables.email_templates?.push({
    event,
    subject_ar: "",
    subject_en: "",
    body_ar: "",
    body_en: "",
    ...text,
  });
}

beforeEach(() => {
  tables = { email_templates: [] };
  vi.mocked(createServiceClient).mockImplementation(
    () => fakeService(tables) as unknown as ReturnType<typeof createServiceClient>,
  );
});

afterEach(() => {
  vi.mocked(createServiceClient).mockReset();
});

describe("renderOutboxRow", () => {
  it.each(["ar", "en"] as const)("uses the built-in copy in %s when no template is saved", async (locale) => {
    const email = await renderOutboxRow(row({ locale }));
    expect(email.subject).toBe(FALLBACK_TEMPLATE[locale].subject);
    expect(email.text).toBe(FALLBACK_TEMPLATE[locale].body);
    expect(email.html).toContain(`lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"`);
  });

  it("uses the saved template of the row's event, not another event's", async () => {
    useTemplate("account_new", { subject_en: "Other", body_en: "Other" });
    useTemplate("contact_message", {
      subject_en: "[Contact message] {{subject}}",
      body_en: "From {{ name }}.",
    });
    const email = await renderOutboxRow(row());
    expect(email.subject).toBe("[Contact message] A question");
    expect(email.text).toBe("From Sender Name.");
  });

  it("picks a two-language value in the recipient's language", async () => {
    useTemplate("document_granted", {
      subject_ar: "[وثيقة متاحة] {{documentTitle}}",
      subject_en: "[Document available] {{documentTitle}}",
    });
    const payload = { documentTitle: { ar: "تقرير", en: "Report" } };
    const ar = await renderOutboxRow(row({ event: "document_granted", locale: "ar", payload }));
    const en = await renderOutboxRow(row({ event: "document_granted", locale: "en", payload }));
    expect(ar.subject).toBe("[وثيقة متاحة] تقرير");
    expect(en.subject).toBe("[Document available] Report");
  });

  it("shows a meeting time in the recipient's language and time zone", async () => {
    useTemplate("meeting", { body_ar: "{{startsAt}}", body_en: "{{startsAt}}" });
    const payload = {
      consultationId: "123e4567-e89b-42d3-a456-426614174000",
      title: "T",
      platform: "Zoom",
      url: "https://example.com/meet",
      startsAt: "2026-11-12T22:30:00.000Z",
      timezone: "Asia/Riyadh",
    };
    const en = await renderOutboxRow(row({ event: "meeting", locale: "en", payload }));
    // 22:30 UTC is 01:30 the next day in Riyadh.
    expect(en.text).toContain("Friday, November 13, 2026");
    expect(en.text).toContain("1:30");
    const ar = await renderOutboxRow(row({ event: "meeting", locale: "ar", payload }));
    expect(ar.text).toBe(
      new Intl.DateTimeFormat("ar", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Asia/Riyadh",
      }).format(new Date(payload.startsAt)),
    );
    expect(ar.text).not.toBe(en.text);
  });

  it("falls back to UTC when the payload's time zone isn't one", async () => {
    useTemplate("meeting", { body_en: "{{startsAt}}" });
    const email = await renderOutboxRow(
      row({
        event: "meeting",
        payload: { startsAt: "2026-11-12T22:30:00.000Z", timezone: "Nowhere/Land" },
      }),
    );
    expect(email.text).toContain("Thursday, November 12, 2026");
  });

  it("writes payload values as text, never as HTML", async () => {
    useTemplate("contact_message", {
      subject_en: "{{subject}}",
      body_en: "From {{name}} & co.",
    });
    const email = await renderOutboxRow(
      row({
        payload: {
          name: `<img src=x onerror="alert(1)">`,
          subject: "<b>Hi</b>",
        },
      }),
    );
    expect(email.text).toBe(`From <img src=x onerror="alert(1)"> & co.`);
    expect(email.html).toContain(
      "From &lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; co.",
    );
    expect(email.html).not.toContain("<img");
    expect(email.subject).toBe("<b>Hi</b>");
  });

  it("doesn't read a value as a template", async () => {
    useTemplate("contact_message", { body_en: "{{name}}" });
    const email = await renderOutboxRow(
      row({ payload: { name: "{{subject}}", subject: "secret" } }),
    );
    expect(email.text).toBe("{{subject}}");
  });

  it("keeps the subject on one line", async () => {
    useTemplate("contact_message", { subject_en: "[Contact] {{subject}}" });
    const email = await renderOutboxRow(
      row({ payload: { name: "N", subject: "Hello\r\nBcc: other@example.invalid" } }),
    );
    expect(email.subject).toBe("[Contact] Hello Bcc: other@example.invalid");
  });

  it("makes a paragraph of each block and a line break of each line", async () => {
    useTemplate("contact_message", { body_en: "One\ntwo\n\n\nThree" });
    const email = await renderOutboxRow(row());
    expect(email.text).toBe("One\ntwo\n\n\nThree");
    expect(email.html.match(/<p /g)).toHaveLength(2);
    expect(email.html).toContain("One<br>two</p>");
  });

  it("leaves an unknown placeholder empty", async () => {
    useTemplate("contact_message", { body_en: "Hi {{nobody}}!" });
    expect((await renderOutboxRow(row())).text).toBe("Hi !");
  });

  it("uses the built-in copy for an event it doesn't know, without a read", async () => {
    const email = await renderOutboxRow(row({ event: "not_an_event" }));
    expect(email.subject).toBe(FALLBACK_TEMPLATE.en.subject);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("throws a coded error when the template can't be read", async () => {
    vi.mocked(createServiceClient).mockImplementation(
      () =>
        fakeService(tables, {
          email_templates: { code: "57014", message: "timeout" },
        }) as unknown as ReturnType<typeof createServiceClient>,
    );
    const failure = await renderOutboxRow(row()).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(TemplateReadError);
    expect((failure as TemplateReadError).code).toBe("57014");
  });
});
