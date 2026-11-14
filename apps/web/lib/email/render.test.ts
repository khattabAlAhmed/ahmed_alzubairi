import type { Tables as DbTables } from "@repo/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_NAME } from "@repo/shared";
import { EMAIL_DEFAULTS, EMAIL_FOOTER, GENERIC_TEMPLATE } from "@/emails/defaults";
import { createServiceClient } from "@/lib/supabase/service";
import { fakeService, outboxRow, type Row, type Tables } from "./fake-db";
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

/** The plain-text part around a body: the site's name, then the footer. */
const framed = (body: string, locale: "ar" | "en" = "en") =>
  `${SITE_NAME}\n\n${body}\n\n${EMAIL_FOOTER[locale]}`;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  tables = { email_templates: [] };
  vi.mocked(createServiceClient).mockImplementation(
    () => fakeService(tables) as unknown as ReturnType<typeof createServiceClient>,
  );
});

afterEach(() => {
  vi.mocked(createServiceClient).mockReset();
  vi.unstubAllEnvs();
});

describe("renderOutboxRow", () => {
  it.each(["ar", "en"] as const)("uses the default copy in %s when no template is saved", async (locale) => {
    const email = await renderOutboxRow(row({ locale }));
    const tag = locale === "ar" ? "[رسالة تواصل]" : "[Contact message]";
    expect(email.subject).toBe(`${tag} A question`);
    expect(email.text).toContain("Sender Name");
    expect(email.text).not.toContain("{{");
    expect(email.html).toMatch(new RegExp(`<html[^>]*\\slang="${locale}"`));
    expect(email.html).toMatch(
      new RegExp(`<html[^>]*\\sdir="${locale === "ar" ? "rtl" : "ltr"}"`),
    );
    // The title inside the email is the subject without its tag.
    expect(email.html.match(/<h1[\s\S]*?<\/h1>/)?.[0]).toContain("A question");
    expect(email.html.match(/<h1[\s\S]*?<\/h1>/)?.[0]).not.toContain(tag);
  });

  it.each(Object.keys(EMAIL_DEFAULTS))("renders the default copy of %s in both languages", async (event) => {
    for (const locale of ["ar", "en"] as const) {
      const email = await renderOutboxRow(
        row({
          event,
          locale,
          payload: {
            consultationId: "123e4567-e89b-42d3-a456-426614174000",
            title: "T",
            clientName: "C",
            memberName: "M",
            traineeName: "R",
            orgName: "O",
            topic: "P",
            name: "N",
            subject: "S",
            platform: "Meet",
            url: "https://meet.example/abc",
            startsAt: "2026-11-12T22:30:00.000Z",
            timezone: "Asia/Riyadh",
            documentTitle: { ar: "وثيقة", en: "Document" },
            courseTitle: { ar: "دورة", en: "Course" },
          },
        }),
      );
      expect(email.subject.startsWith("[")).toBe(true);
      expect(`${email.subject}${email.text}`).not.toContain("{{");
      expect(email.html).toContain(`dir="${locale === "ar" ? "rtl" : "ltr"}"`);
    }
  });

  it("links to the site in the recipient's language, in the HTML and the text part", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://site.example/");
    const arabic = await renderOutboxRow(row({ locale: "ar" }));
    expect(arabic.html).toContain('href="https://site.example/ar/dashboard/messages"');
    expect(
      arabic.text.endsWith(
        `\n\nعرض الرسائل: https://site.example/ar/dashboard/messages\n\n${EMAIL_FOOTER.ar}`,
      ),
    ).toBe(true);
    const english = await renderOutboxRow(row({ locale: "en" }));
    expect(english.html).toContain('href="https://site.example/en/dashboard/messages"');
    expect(
      english.text.endsWith(
        `\n\nView messages: https://site.example/en/dashboard/messages\n\n${EMAIL_FOOTER.en}`,
      ),
    ).toBe(true);
  });

  it("the plain-text part starts with the site's name and ends with the footer", async () => {
    for (const locale of ["ar", "en"] as const) {
      const { text } = await renderOutboxRow(row({ locale }));
      expect(text.startsWith(`${SITE_NAME}\n\n`)).toBe(true);
      expect(text.endsWith(`\n\n${EMAIL_FOOTER[locale]}`)).toBe(true);
    }
  });

  it("drops a query, a fragment and trailing slashes from the site's address", async () => {
    for (const value of [
      "https://site.example/?ref=x",
      "https://site.example#top",
      "https://site.example//?a=1#b",
    ]) {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", value);
      const email = await renderOutboxRow(row({ locale: "en" }));
      expect(email.html).toContain('href="https://site.example/en/dashboard/messages"');
      expect(email.text).toContain("View messages: https://site.example/en/dashboard/messages\n");
    }
    // A site under a path keeps the path.
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://site.example/app/?ref=x");
    const email = await renderOutboxRow(row({ locale: "en" }));
    expect(email.html).toContain('href="https://site.example/app/en/dashboard/messages"');
  });

  it("sends without a button when the site's address is missing or isn't a web link", async () => {
    for (const value of ["", "not a url", "javascript:alert(1)"]) {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", value);
      const email = await renderOutboxRow(row());
      expect(email.html).not.toContain("<a ");
      expect(email.text).not.toContain("View messages");
    }
  });

  it("doesn't repeat a meeting link the body already shows", async () => {
    const email = await renderOutboxRow(
      row({
        event: "meeting",
        payload: {
          title: "T",
          platform: "Meet",
          url: "https://meet.example/abc",
          startsAt: "2026-11-12T22:30:00.000Z",
          timezone: "Asia/Riyadh",
        },
      }),
    );
    expect(email.text.split("https://meet.example/abc")).toHaveLength(2);
  });

  it("an event for both sides has no button", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://site.example");
    const email = await renderOutboxRow(
      row({
        event: "consultation_reply",
        payload: { consultationId: "123e4567-e89b-42d3-a456-426614174000", title: "T" },
      }),
    );
    expect(email.html).not.toContain("<a ");
  });

  it("a meeting's button is its own https link, and nothing else", async () => {
    const meeting = (url: string) =>
      renderOutboxRow(
        row({
          event: "meeting",
          payload: {
            title: "T",
            platform: "Meet",
            url,
            startsAt: "2026-11-12T22:30:00.000Z",
            timezone: "Asia/Riyadh",
          },
        }),
      );
    expect((await meeting("https://meet.example/abc")).html).toContain(
      'href="https://meet.example/abc"',
    );
    for (const url of ["javascript:alert(1)", "http://meet.example/abc", "nope"]) {
      const email = await meeting(url);
      expect(email.html).not.toContain("<a ");
      // The refused link isn't spelled out either, in the body or the text.
      expect(email.html).not.toContain(url);
      expect(email.text).not.toContain(url);
      expect(email.text).toContain("Platform: Meet");
    }
  });

  it("uses the saved template of the row's event, not another event's", async () => {
    useTemplate("account_new", { subject_en: "Other", body_en: "Other" });
    useTemplate("contact_message", {
      subject_en: "[Contact message] {{subject}}",
      body_en: "From {{ name }}.",
    });
    const email = await renderOutboxRow(row());
    expect(email.subject).toBe("[Contact message] A question");
    expect(email.text).toBe(framed("From Sender Name."));
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
    // The date is the body's first line, after the site's name; the meeting
    // link follows it.
    expect(ar.text.split("\n")[2]).toBe(
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
    expect(email.text).toBe(framed(`From <img src=x onerror="alert(1)"> & co.`));
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
    expect(email.text).toBe(framed("{{subject}}"));
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
    expect(email.text).toBe(framed("One\ntwo\n\n\nThree"));
    expect(email.html.match(/<p [^>]*class="em-text"/g)).toHaveLength(2);
    expect(email.html).toMatch(/One<br\s*\/?>two<\/p>/);
  });

  it("leaves an unknown placeholder empty", async () => {
    useTemplate("contact_message", { body_en: "Hi {{nobody}}!" });
    expect((await renderOutboxRow(row())).text).toBe(framed("Hi !"));
  });

  it("uses the built-in copy for an event it doesn't know, without a read", async () => {
    const email = await renderOutboxRow(row({ event: "not_an_event" }));
    expect(email.subject).toBe(GENERIC_TEMPLATE.en.subject);
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
