import { render } from "@react-email/render";
import { EMAIL_EVENTS, EMAIL_PLACEHOLDERS } from "@repo/shared";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { NotificationEmail } from "@/emails/notification";
import { defaultTemplate } from "@/lib/admin/email-templates/templates";
import arMessages from "@/messages/ar/DashboardEmailTemplates.json";
import enMessages from "@/messages/en/DashboardEmailTemplates.json";
import {
  isChanged,
  resetTemplate,
  saveTemplate,
  toValues,
  validateTemplate,
} from "./form";
import { previewEmail, sampleValues } from "./preview";

const SAMPLES = { ar: arMessages.samples, en: enMessages.samples };
const contact = defaultTemplate("contact_message");

describe("validateTemplate", () => {
  it("accepts the default copy of every event", () => {
    for (const event of EMAIL_EVENTS) {
      expect(validateTemplate(event, toValues(defaultTemplate(event)))).toEqual({});
    }
  });

  it("names the field and the reason", () => {
    expect(
      validateTemplate("contact_message", {
        subjectAr: "  ",
        subjectEn: "s".repeat(201),
        bodyAr: "{{name}} {{title}} {{url}}",
        bodyEn: "Fine {{subject}}",
      }),
    ).toEqual({
      subjectAr: { code: "required" },
      subjectEn: { code: "tooLong", max: 200 },
      bodyAr: { code: "unknownPlaceholder", names: ["title", "url"] },
    });
  });
});

describe("isChanged", () => {
  it("ignores outer spaces and sees a real change", () => {
    const values = toValues(contact);
    expect(isChanged({ ...values, bodyEn: ` ${values.bodyEn}\n` }, contact)).toBe(false);
    expect(isChanged({ ...values, bodyEn: `${values.bodyEn}!` }, contact)).toBe(true);
  });
});

describe("saveTemplate and resetTemplate", () => {
  const answer = (status: number, body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("PATCHes the template", async () => {
    const fetchImpl = answer(200, { ok: true });
    expect(await saveTemplate(contact, fetchImpl)).toEqual({ ok: true });
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] ?? [];
    expect(url).toBe("/api/admin/email-templates");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual(contact);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("DELETEs with the event only", async () => {
    const fetchImpl = answer(200, { ok: true });
    expect(await resetTemplate("meeting", fetchImpl)).toEqual({ ok: true });
    const [, init] = vi.mocked(fetchImpl).mock.calls[0] ?? [];
    expect(init?.method).toBe("DELETE");
    expect(JSON.parse(String(init?.body))).toEqual({ event: "meeting" });
  });

  it("passes the server's message on a refusal", async () => {
    const fetchImpl = answer(400, {
      error: { code: "validation_failed", message: "No value for {{title}}" },
    });
    expect(await saveTemplate(contact, fetchImpl)).toEqual({
      ok: false,
      message: "No value for {{title}}",
    });
  });

  it("a network failure or a timeout is a failure with no message", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    }) as unknown as typeof fetch;
    expect(await resetTemplate("meeting", fetchImpl)).toEqual({ ok: false, message: null });
  });
});

describe("the preview", () => {
  it.each(["ar", "en"] as const)("has a sample value for every placeholder in %s", (locale) => {
    for (const event of EMAIL_EVENTS) {
      const values = sampleValues(event, locale, SAMPLES[locale]);
      expect(Object.keys(values)).toEqual([...EMAIL_PLACEHOLDERS[event]]);
      for (const value of Object.values(values)) expect(value).not.toBe("");
      const template = defaultTemplate(event);
      const email = previewEmail(
        event,
        locale,
        locale === "ar"
          ? { subject: template.subjectAr, body: template.bodyAr }
          : { subject: template.subjectEn, body: template.bodyEn },
        SAMPLES[locale],
      );
      expect(`${email.subject}${email.body}`).not.toContain("{{");
    }
  });

  it("fills the placeholders and keeps the subject on one line", () => {
    const email = previewEmail(
      "contact_message",
      "en",
      { subject: "[Contact]\n{{subject}}", body: "From {{name}}.\r\n\r\nBye." },
      SAMPLES.en,
    );
    expect(email.subject).toBe(`[Contact] ${enMessages.samples.subject}`);
    expect(email.body).toBe(`From ${enMessages.samples.name}.\n\nBye.`);
    expect(email.action).toEqual({
      href: "https://example.com/en/dashboard/messages",
      label: "View messages",
    });
  });

  it("an event without a button has none", () => {
    const email = previewEmail("consultation_reply", "ar", { subject: "ع", body: "ن" }, SAMPLES.ar);
    expect(email.action).toBeUndefined();
  });

  it("draws markup typed in a template as text", async () => {
    const props = previewEmail(
      "contact_message",
      "en",
      { subject: "<i>Hi</i>", body: "<b>bold</b> <script>alert(1)</script>" },
      SAMPLES.en,
    );
    const html = await render(createElement(NotificationEmail, props));
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<b>bold</b>");
    expect(html).not.toContain("<script>alert(1)");
  });
});
