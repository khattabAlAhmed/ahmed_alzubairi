import type { EmailEvent, Locale } from "@repo/shared";

/**
 * The default copy of every email in §6.21, in Arabic and English. This file
 * is the only place for email copy. The dashboard can save its own version of
 * a template in `email_templates`; until it does, these are sent.
 *
 * Subjects and bodies are plain text. `{{name}}` is a placeholder: each
 * event may use the keys of its payload in `EMAIL_PAYLOADS` (packages/shared)
 * and nothing else. A blank line starts a new paragraph.
 *
 * Arabic subjects start with the tag exactly as §6.21 writes it. No text
 * here promises a response time (§6.14). The site name is not written here:
 * the layout shows `SITE_NAME` above and below every email.
 */

export type TemplateText = { subject: string; body: string };

/** Joins paragraphs with a blank line. */
const text = (...paragraphs: string[]) => paragraphs.join("\n\n");

export const EMAIL_DEFAULTS = {
  consultation_new: {
    ar: {
      subject: "[طلب استشارة جديد] {{title}}",
      body: text(
        "وصل طلب استشارة جديد من {{clientName}}.",
        "العنوان: {{title}}",
        "افتح لوحة التحكم لقراءة الطلب.",
      ),
    },
    en: {
      subject: "[New consultation request] {{title}}",
      body: text(
        "{{clientName}} sent a new consultation request.",
        "Title: {{title}}",
        "Open the dashboard to read it.",
      ),
    },
  },
  consultation_received: {
    ar: {
      subject: "[تم استلام طلبك] {{title}}",
      body: text(
        "السلام عليكم ورحمة الله،",
        "تم استلام طلب الاستشارة «{{title}}».",
        "يمكنك متابعة الطلب والردود عليه من حسابك.",
      ),
    },
    en: {
      subject: "[Request received] {{title}}",
      body: text(
        "Hello,",
        "Your consultation request “{{title}}” has been received.",
        "You can follow the request and its replies from your account.",
      ),
    },
  },
  consultation_assigned: {
    ar: {
      subject: "[استشارة مسندة إليك] {{title}}",
      body: text(
        "أُسندت إليك الاستشارة «{{title}}».",
        "افتح لوحة التحكم لقراءة تفاصيلها.",
      ),
    },
    en: {
      subject: "[Consultation assigned to you] {{title}}",
      body: text(
        "The consultation “{{title}}” has been assigned to you.",
        "Open the dashboard to read its details.",
      ),
    },
  },
  consultation_reply: {
    ar: {
      subject: "[رد جديد] {{title}}",
      body: text(
        "يوجد رد جديد على الاستشارة «{{title}}».",
        "سجّل الدخول لقراءة الرد.",
      ),
    },
    en: {
      subject: "[New reply] {{title}}",
      body: text(
        "There is a new reply on the consultation “{{title}}”.",
        "Sign in to read it.",
      ),
    },
  },
  meeting: {
    ar: {
      subject: "[موعد اجتماع] {{startsAt}}",
      body: text(
        "السلام عليكم ورحمة الله،",
        "حُدّد موعد اجتماع للاستشارة «{{title}}».",
        "الموعد: {{startsAt}}\nالمنصة: {{platform}}\nالرابط: {{url}}",
      ),
    },
    en: {
      subject: "[Meeting] {{startsAt}}",
      body: text(
        "Hello,",
        "A meeting has been set for the consultation “{{title}}”.",
        "Time: {{startsAt}}\nPlatform: {{platform}}\nLink: {{url}}",
      ),
    },
  },
  meeting_reminder: {
    ar: {
      subject: "[تذكير] موعد غداً",
      body: text(
        "تذكير باجتماع الاستشارة «{{title}}».",
        "الموعد: {{startsAt}}\nالمنصة: {{platform}}\nالرابط: {{url}}",
      ),
    },
    en: {
      subject: "[Reminder] Meeting tomorrow",
      body: text(
        "A reminder of the meeting for the consultation “{{title}}”.",
        "Time: {{startsAt}}\nPlatform: {{platform}}\nLink: {{url}}",
      ),
    },
  },
  document_request: {
    ar: {
      subject: "[طلب وثيقة] {{documentTitle}}",
      body: text(
        "طلب {{clientName}} الاطلاع على الوثيقة «{{documentTitle}}».",
        "افتح لوحة التحكم لمراجعة الطلب.",
      ),
    },
    en: {
      subject: "[Document request] {{documentTitle}}",
      body: text(
        "{{clientName}} asked to view the document “{{documentTitle}}”.",
        "Open the dashboard to review the request.",
      ),
    },
  },
  document_recommendation: {
    ar: {
      subject: "[توصية وثيقة] {{documentTitle}}",
      body: text(
        "أضاف {{memberName}} توصية على طلب الوثيقة «{{documentTitle}}».",
        "افتح لوحة التحكم لقراءة التوصية واتخاذ القرار.",
      ),
    },
    en: {
      subject: "[Document recommendation] {{documentTitle}}",
      body: text(
        "{{memberName}} added a recommendation on the request for the document “{{documentTitle}}”.",
        "Open the dashboard to read it and decide.",
      ),
    },
  },
  document_granted: {
    ar: {
      subject: "[وثيقة متاحة] {{documentTitle}}",
      body: text(
        "السلام عليكم ورحمة الله،",
        "الوثيقة «{{documentTitle}}» متاحة لك الآن.",
        "يمكنك فتحها من صفحة الوثائق في حسابك.",
      ),
    },
    en: {
      subject: "[Document available] {{documentTitle}}",
      body: text(
        "Hello,",
        "The document “{{documentTitle}}” is now available to you.",
        "You can open it from the documents page in your account.",
      ),
    },
  },
  course_registration: {
    ar: {
      subject: "[تسجيل دورة] {{courseTitle}}",
      body: text(
        "تم تسجيل {{traineeName}} في الدورة «{{courseTitle}}».",
        "تفاصيل التسجيل متاحة بعد تسجيل الدخول.",
      ),
    },
    en: {
      subject: "[Course registration] {{courseTitle}}",
      body: text(
        "{{traineeName}} is registered for the course “{{courseTitle}}”.",
        "The registration details are available after signing in.",
      ),
    },
  },
  custom_training_request: {
    ar: {
      subject: "[طلب تدريب مخصص] {{orgName}}",
      body: text(
        "وصل طلب تدريب مخصص من {{orgName}}.",
        "الموضوع: {{topic}}",
        "افتح لوحة التحكم لقراءة الطلب.",
      ),
    },
    en: {
      subject: "[Custom training request] {{orgName}}",
      body: text(
        "{{orgName}} sent a custom training request.",
        "Topic: {{topic}}",
        "Open the dashboard to read it.",
      ),
    },
  },
  contact_message: {
    ar: {
      subject: "[رسالة تواصل] {{subject}}",
      body: text(
        "وصلت رسالة جديدة من {{name}} عبر نموذج التواصل.",
        "الموضوع: {{subject}}",
        "افتح صفحة الرسائل في لوحة التحكم لقراءتها.",
      ),
    },
    en: {
      subject: "[Contact message] {{subject}}",
      body: text(
        "{{name}} sent a new message through the contact form.",
        "Subject: {{subject}}",
        "Open the messages page in the dashboard to read it.",
      ),
    },
  },
  account_new: {
    ar: {
      subject: "[حساب جديد] {{clientName}}",
      body: text(
        "أنشأ {{clientName}} حساباً جديداً في الموقع.",
        "يمكنك عرض الحساب من لوحة التحكم.",
      ),
    },
    en: {
      subject: "[New account] {{clientName}}",
      body: text(
        "{{clientName}} created a new account on the site.",
        "You can see the account from the dashboard.",
      ),
    },
  },
} as const satisfies Record<EmailEvent, Record<Locale, TemplateText>>;

/**
 * Sent for an event this build doesn't know, such as a row queued by a newer
 * version. It uses no placeholder, so it fits any payload.
 */
export const GENERIC_TEMPLATE: Record<Locale, TemplateText> = {
  ar: {
    subject: "إشعار جديد",
    body: "لديك إشعار جديد. سجّل الدخول لعرض التفاصيل.",
  },
  en: {
    subject: "New notification",
    body: "You have a new notification. Sign in to see the details.",
  },
};

/**
 * Where an email's button leads. `account` and `dashboard` paths are joined
 * to `NEXT_PUBLIC_APP_URL` and the recipient's language by the sender;
 * `meeting` uses the payload's own `url`. An event that goes to both a client
 * and the team (`consultation_reply`, `course_registration`) has no button:
 * one link can't be right for both.
 */
export type EmailAction =
  | { kind: "path"; path: string; label: Record<Locale, string> }
  | { kind: "meeting"; label: Record<Locale, string> };

const OPEN_DASHBOARD = { ar: "فتح لوحة التحكم", en: "Open the dashboard" };
const JOIN_MEETING = { ar: "رابط الاجتماع", en: "Meeting link" };

export const EMAIL_ACTIONS: Record<EmailEvent, EmailAction | null> = {
  consultation_new: { kind: "path", path: "/dashboard", label: OPEN_DASHBOARD },
  consultation_received: {
    kind: "path",
    path: "/account/consultations",
    label: { ar: "عرض استشاراتي", en: "View my consultations" },
  },
  consultation_assigned: { kind: "path", path: "/dashboard", label: OPEN_DASHBOARD },
  consultation_reply: null,
  meeting: { kind: "meeting", label: JOIN_MEETING },
  meeting_reminder: { kind: "meeting", label: JOIN_MEETING },
  document_request: { kind: "path", path: "/dashboard", label: OPEN_DASHBOARD },
  document_recommendation: { kind: "path", path: "/dashboard", label: OPEN_DASHBOARD },
  document_granted: {
    kind: "path",
    path: "/account/documents",
    label: { ar: "عرض وثائقي", en: "View my documents" },
  },
  course_registration: null,
  custom_training_request: { kind: "path", path: "/dashboard", label: OPEN_DASHBOARD },
  contact_message: {
    kind: "path",
    path: "/dashboard/messages",
    label: { ar: "عرض الرسائل", en: "View messages" },
  },
  account_new: { kind: "path", path: "/dashboard", label: OPEN_DASHBOARD },
};

/** The line under every email. */
export const EMAIL_FOOTER: Record<Locale, string> = {
  ar: "هذه رسالة آلية، يرجى عدم الرد عليها.",
  en: "This is an automated message. Please don't reply to it.",
};
