import type { Locale } from "@repo/shared";
import { EmailButton } from "./email-button";
import { EmailDetails } from "./email-details";
import { EmailHeading } from "./email-heading";
import { EmailLayout } from "./email-layout";
import { EmailNote } from "./email-note";
import { EmailText } from "./email-text";

/**
 * Made-up content in both languages, long enough to show wrapping. A sample
 * only: real emails take their words from templates, never from this file.
 */
const SAMPLE = {
  ar: {
    preview: "وصلك رد جديد على استشارتك حول حوكمة مجلس الإدارة",
    heading: "رد جديد على استشارتك",
    greeting: "السلام عليكم ورحمة الله،",
    body: "أضاف المستشار رداً على استشارتك. يتناول الرد توزيع الصلاحيات بين مجلس الإدارة والإدارة التنفيذية، ويقترح جدولاً زمنياً لمراجعة اللوائح الداخلية خلال الأشهر الثلاثة القادمة، مع ملاحظات على سياسة تعارض المصالح.",
    details: [
      {
        label: "الموضوع",
        value: "مراجعة لائحة الحوكمة وتوزيع الصلاحيات في مؤسسة تنموية غير ربحية",
      },
      { label: "المرسل", value: "مستشار تجريبي" },
      { label: "التاريخ", value: "١١ نوفمبر ٢٠٢٦، ٤:٣٠ م" },
      { label: "المنصة", value: "Google Meet" },
    ],
    button: "عرض الرد",
    note: "وصلتك هذه الرسالة لأن لديك استشارة مفتوحة. يمكنك إيقاف الإشعارات غير الأساسية من ملفك الشخصي.",
    footer: "هذه رسالة آلية، يرجى عدم الرد عليها.",
  },
  en: {
    preview: "You have a new reply on your board governance consultation",
    heading: "A new reply on your consultation",
    greeting: "Hello,",
    body: "The consultant has replied to your consultation. The reply covers how authority is split between the board and executive management, proposes a timeline for reviewing the internal bylaws over the next three months, and adds notes on the conflict of interest policy.",
    details: [
      {
        label: "Subject",
        value:
          "Reviewing the governance charter and delegation of authority at a non-profit development organization",
      },
      { label: "From", value: "Sample Consultant" },
      { label: "Date", value: "11 November 2026, 4:30 PM" },
      { label: "Platform", value: "Google Meet" },
    ],
    button: "View the reply",
    note: "You got this email because you have an open consultation. You can turn off non-essential notifications from your profile.",
    footer: "This is an automated message. Please do not reply.",
  },
} as const satisfies Record<Locale, unknown>;

/** One email that uses every block, for the React Email preview and the render test. */
export function SampleEmail({ locale }: { locale: Locale }) {
  const copy = SAMPLE[locale];

  return (
    <EmailLayout locale={locale} preview={copy.preview} footer={copy.footer}>
      <EmailHeading>{copy.heading}</EmailHeading>
      <EmailText>{copy.greeting}</EmailText>
      <EmailText>{copy.body}</EmailText>
      <EmailDetails items={copy.details} />
      <EmailButton href="https://example.com/account/consultations">
        {copy.button}
      </EmailButton>
      <EmailNote>{copy.note}</EmailNote>
    </EmailLayout>
  );
}

SampleEmail.PreviewProps = { locale: "ar" } satisfies { locale: Locale };

export default SampleEmail;
