import {
  EMAIL_EVENTS,
  EMAIL_PAYLOADS,
  EMAIL_PLACEHOLDERS,
  LOCALES,
  SITE_NAME,
  templatePlaceholders,
} from "@repo/shared";
import { describe, expect, it } from "vitest";
import {
  EMAIL_ACTIONS,
  EMAIL_DEFAULTS,
  EMAIL_FOOTER,
  GENERIC_TEMPLATE,
} from "./defaults";

/** The Arabic subject tags, exactly as §6.21 writes them. */
const ARABIC_TAGS = {
  consultation_new: "[طلب استشارة جديد]",
  consultation_received: "[تم استلام طلبك]",
  consultation_assigned: "[استشارة مسندة إليك]",
  consultation_reply: "[رد جديد]",
  meeting: "[موعد اجتماع]",
  meeting_reminder: "[تذكير]",
  document_request: "[طلب وثيقة]",
  document_recommendation: "[توصية وثيقة]",
  document_granted: "[وثيقة متاحة]",
  course_registration: "[تسجيل دورة]",
  custom_training_request: "[طلب تدريب مخصص]",
  contact_message: "[رسالة تواصل]",
  account_new: "[حساب جديد]",
} as const;

const every = EMAIL_EVENTS.flatMap((event) =>
  LOCALES.map((locale) => ({ event, locale, ...EMAIL_DEFAULTS[event][locale] })),
);

describe("EMAIL_DEFAULTS", () => {
  it("has a subject and a body in Arabic and English for every event, and no other event", () => {
    expect(Object.keys(EMAIL_DEFAULTS).sort()).toEqual([...EMAIL_EVENTS].sort());
    for (const { subject, body } of every) {
      expect(subject.trim()).not.toBe("");
      expect(body.trim()).not.toBe("");
    }
  });

  it.each(EMAIL_EVENTS)("%s uses only placeholders of its payload", (event) => {
    const allowed = EMAIL_PLACEHOLDERS[event];
    expect(allowed).toEqual(Object.keys(EMAIL_PAYLOADS[event].shape));
    for (const locale of LOCALES) {
      const { subject, body } = EMAIL_DEFAULTS[event][locale];
      const used = templatePlaceholders(`${subject}\n${body}`);
      expect(used.filter((name) => !allowed.includes(name))).toEqual([]);
      // Nothing that looks like a placeholder but isn't one, such as `{{ a b }}`.
      expect(`${subject}${body}`.replace(/\{\{\s*[A-Za-z][A-Za-z0-9]*\s*\}\}/g, "")).not.toMatch(/[{}]/);
    }
  });

  it("uses the same placeholders in both languages", () => {
    for (const event of EMAIL_EVENTS) {
      const used = (locale: "ar" | "en") =>
        templatePlaceholders(
          `${EMAIL_DEFAULTS[event][locale].subject}\n${EMAIL_DEFAULTS[event][locale].body}`,
        ).sort();
      expect(used("ar")).toEqual(used("en"));
    }
  });

  it.each(EMAIL_EVENTS)("the Arabic subject of %s starts with its §6.21 tag", (event) => {
    expect(EMAIL_DEFAULTS[event].ar.subject.startsWith(`${ARABIC_TAGS[event]} `)).toBe(true);
  });

  it("the reminder's Arabic subject is §6.21's, word for word", () => {
    expect(EMAIL_DEFAULTS.meeting_reminder.ar.subject).toBe("[تذكير] موعد غداً");
  });

  it("every English subject starts with a tag of its own, in Latin letters", () => {
    const tags = EMAIL_EVENTS.map(
      (event) => /^\[[A-Za-z ]+\] /.exec(EMAIL_DEFAULTS[event].en.subject)?.[0],
    );
    expect(tags.every(Boolean)).toBe(true);
    expect(new Set(tags).size).toBe(EMAIL_EVENTS.length);
  });

  it("writes each language in its own script", () => {
    const strip = (value: string) => value.replace(/\{\{[^}]*\}\}/g, "");
    for (const { locale, subject, body } of every) {
      const words = strip(`${subject} ${body}`);
      if (locale === "ar") expect(words).not.toMatch(/[A-Za-z]/);
      else expect(words).not.toMatch(/[؀-ۿ]/);
    }
  });

  it("keeps subjects on one line", () => {
    for (const { subject } of every) expect(subject).not.toMatch(/[\r\n]/);
  });

  it("promises no response time (§6.14)", () => {
    const promise =
      /within|hours?|business days?|working days?|shortly|as soon as|soon|خلال|ساعة|ساعات|أيام عمل|قريب|أقرب وقت|في أسرع/i;
    for (const { event, subject, body } of every) {
      // The reminder's subject is fixed by §6.21 and is about the meeting.
      const words = event === "meeting_reminder" ? body : `${subject} ${body}`;
      expect(words).not.toMatch(promise);
    }
  });

  it("never writes the site name by hand", () => {
    for (const { subject, body } of every) {
      expect(`${subject} ${body}`).not.toContain(SITE_NAME);
    }
  });
});

describe("the other copy", () => {
  it("the generic template fits any payload: it has no placeholder", () => {
    for (const locale of LOCALES) {
      const { subject, body } = GENERIC_TEMPLATE[locale];
      expect(templatePlaceholders(`${subject}${body}`)).toEqual([]);
    }
  });

  it("every button has a label in both languages, and site paths stay inside the site", () => {
    expect(Object.keys(EMAIL_ACTIONS).sort()).toEqual([...EMAIL_EVENTS].sort());
    for (const action of Object.values(EMAIL_ACTIONS)) {
      if (!action) continue;
      for (const locale of LOCALES) expect(action.label[locale].trim()).not.toBe("");
      if (action.kind === "path") {
        expect(action.path).toMatch(/^\/(account|dashboard)(\/[a-z-]+)*$/);
      }
    }
    expect(EMAIL_ACTIONS.contact_message).toMatchObject({ path: "/dashboard/messages" });
    // Sent to a client and to the team: no single page fits both.
    expect(EMAIL_ACTIONS.consultation_reply).toBeNull();
    expect(EMAIL_ACTIONS.course_registration).toBeNull();
  });

  it("has a footer line in both languages", () => {
    for (const locale of LOCALES) expect(EMAIL_FOOTER[locale].trim()).not.toBe("");
  });
});
