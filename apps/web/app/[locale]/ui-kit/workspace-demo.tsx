"use client";

import { CONSULTATION_STATUSES } from "@repo/shared";
import { useLocale } from "next-intl";
import { useState, type ReactNode } from "react";
import { Button, Card, SectionHeading } from "@/components/ui";
import {
  attachmentRefusal,
  ChatMessage,
  Composer,
  ConfirmTwice,
  DOCUMENT_REQUEST_STATUSES,
  DocumentCard,
  FileChip,
  MeetingCard,
  StatusPill,
  type FileChipData,
} from "@/components/workspace";

// Sample copy for the dev-only kit page, like content.ts. Made up: no client data.
const SAMPLE = {
  ar: {
    title: "مكوّنات مساحة العمل",
    intro: "قطع مشتركة للاستشارات والوثائق: الحالة، والمحادثة، والملفات، والاجتماع، والوثيقة، وتأكيد الحذف.",
    statuses: "الحالات",
    statusesIntro: "حالات الاستشارة ثم حالات طلب الوثيقة، بالترتيب.",
    chat: "المحادثة",
    chatIntro: "رسالة الطرف الآخر في جهة البداية، ورسالتك في جهة النهاية. النص يظهر كنص فقط.",
    files: "الملفات",
    composer: "كتابة رسالة",
    composerIntro: "الخطأ يظهر فوق زر الإرسال ولا يمسح النص المكتوب.",
    meeting: "الاجتماع",
    documents: "الوثائق",
    confirm: "تأكيد الحذف",
    confirmIntro: "خطوتان: سؤال، ثم كلمة تُكتب.",
    openConfirm: "حذف المحادثة",
    confirmTitle: "حذف المحادثة نهائيًا",
    confirmQuestion: "ستُحذف هذه المحادثة وملفاتها الأربعة من السجلين، ولا يمكن التراجع عن ذلك.",
    confirmWord: "حذف",
    confirmLabel: "حذف نهائيًا",
    team: "د. سارة الحكيمي",
    client: "عبد الرحمن بن محمد آل الزبيري",
    first:
      "السلام عليكم،\nنرغب في مراجعة دليل الحوكمة لمنظمتنا قبل اجتماع مجلس الأمناء القادم.\nأرفقت النسخة الحالية من الدليل والهيكل التنظيمي.",
    reply: "وعليكم السلام. اطلعت على الملفين، وسأرسل ملاحظاتي الأولية خلال يومين. هل يناسبكم اجتماع مرئي يوم الخميس؟",
    long: "رابط المرجع: https://example.org/governance/manuals/2026/very-long-reference-path-without-any-spaces-at-all-to-test-wrapping",
    unsafe: "اختبار عرض النص: <b>x</b> و <script>alert(1)</script>",
    typed: "شكرًا لكم، الخميس مناسب. أرفقت محضر الاجتماع السابق.",
    sendError: "تعذّر إرسال الرسالة. النص والملفات ما زالت هنا، حاول مرة أخرى.",
    docs: [
      "شهادة إتمام برنامج القيادة الاستراتيجية في المنظمات الإنسانية",
      "خطاب شكر من وزارة التخطيط والتعاون الدولي",
      "صور ورشة التخطيط الاستراتيجي في عدن",
    ],
    expiry: "متاحة حتى 31 ديسمبر 2026",
    view: "عرض",
    download: "تحميل",
    request: "طلب الاطلاع",
    edit: "تعديل الموعد",
    deletedNote: "حُذفت المحادثة (عيّنة: لم يُحذف شيء فعلًا).",
  },
  en: {
    title: "Workspace components",
    intro: "Shared pieces for consultations and documents: status, chat, files, meeting, document and delete confirmation.",
    statuses: "Statuses",
    statusesIntro: "Consultation statuses, then document request statuses, in order.",
    chat: "Chat",
    chatIntro: "The other side's messages sit on the start side, yours on the end side. Text shows as text only.",
    files: "Files",
    composer: "Composer",
    composerIntro: "The error shows above Send and never clears what was typed.",
    meeting: "Meeting",
    documents: "Documents",
    confirm: "Delete confirmation",
    confirmIntro: "Two steps: a question, then a word to type.",
    openConfirm: "Delete chat",
    confirmTitle: "Delete this chat for good",
    confirmQuestion: "This chat and its 4 files will be deleted from both histories. This can't be undone.",
    confirmWord: "DELETE",
    confirmLabel: "Delete for good",
    team: "Dr. Sarah Al-Hakimi",
    client: "Abdulrahman bin Mohammed Al-Zubairi",
    first:
      "Hello,\nWe'd like a review of our governance manual before the next board of trustees meeting.\nI've attached the current manual and the organization chart.",
    reply: "Hello. I've read both files and will send first notes within two days. Would a video meeting on Thursday suit you?",
    long: "Reference: https://example.org/governance/manuals/2026/very-long-reference-path-without-any-spaces-at-all-to-test-wrapping",
    unsafe: "Text rendering test: <b>x</b> and <script>alert(1)</script>",
    typed: "Thank you, Thursday works. I've attached the minutes of the last meeting.",
    sendError: "The message wasn't sent. Your text and files are still here; please try again.",
    docs: [
      "Certificate of completion: Strategic Leadership in Humanitarian Organizations",
      "Thank-you letter from the Ministry of Planning and International Cooperation",
      "Photos from the strategic planning workshop in Aden",
    ],
    expiry: "Available until December 31, 2026",
    view: "View",
    download: "Download",
    request: "Request to view",
    edit: "Edit meeting",
    deletedNote: "The chat was deleted (sample: nothing was really deleted).",
  },
} as const;

const LONG_FILE =
  "Governance_Manual_Board_of_Trustees_Review_Final_Version_2026_with_annexes_and_organizational_chart.pdf";

const CHIPS: FileChipData[] = [
  { id: "c1", name: LONG_FILE, sizeBytes: 2_516_582, mime: "application/pdf", state: "ready", href: "#" },
  { id: "c2", name: "الهيكل التنظيمي.xlsx", sizeBytes: 245_760, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", state: "uploading", progress: 64 },
  { id: "c3", name: "محضر الاجتماع.docx", sizeBytes: 98_304, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", state: "ready" },
  { id: "c4", name: "workshop-photo.png", sizeBytes: 14_680_064, mime: "image/png", state: "refused", reason: "tooLarge" },
  { id: "c5", name: "budget.zip", sizeBytes: 512_000, mime: "application/zip", state: "refused", reason: "wrongType" },
];

function Block({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="space-y-5 border-t border-text/10 pt-8">
      <SectionHeading title={title} intro={intro} />
      {children}
    </section>
  );
}

/** The workspace components (P4C-T02) with sample data, for the dev-only kit page. */
export function WorkspaceDemo() {
  const s = SAMPLE[useLocale() === "ar" ? "ar" : "en"];
  const [text, setText] = useState<string>(s.typed);
  const [files, setFiles] = useState<FileChipData[]>([CHIPS[2], CHIPS[1], CHIPS[3]]);
  const [showError, setShowError] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);

  function attach(picked: File[]) {
    setFiles((current) => {
      let counted = current.filter((file) => file.state !== "refused").length;
      const added = picked.map((file, i): FileChipData => {
        const reason = attachmentRefusal(file, counted);
        if (!reason) counted += 1;
        return {
          id: `${Date.now()}-${i}`,
          name: file.name,
          sizeBytes: file.size,
          mime: file.type,
          state: reason ? "refused" : "ready",
          reason: reason ?? undefined,
        };
      });
      return [...current, ...added];
    });
  }

  return (
    <div className="space-y-10">
      <SectionHeading title={s.title} intro={s.intro} />

      <Block title={s.statuses} intro={s.statusesIntro}>
        <div className="flex flex-wrap gap-2">
          {CONSULTATION_STATUSES.map((status) => (
            <StatusPill key={status} kind="consultation" status={status} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {DOCUMENT_REQUEST_STATUSES.map((status) => (
            <StatusPill key={status} kind="documentRequest" status={status} />
          ))}
        </div>
      </Block>

      <Block title={s.chat} intro={s.chatIntro}>
        <Card compact className="space-y-4 bg-background">
          <ChatMessage senderName={s.client} mine={false} body={s.first} sentAt="2026-11-12T08:15:00Z" attachments={[CHIPS[0], { ...CHIPS[2], href: "#" }]} />
          <ChatMessage senderName={s.team} mine body={s.reply} sentAt="2026-11-12T10:40:00Z" />
          <ChatMessage senderName={s.client} mine={false} body={s.long} sentAt="2026-11-12T11:02:00Z" />
          <ChatMessage senderName={s.team} mine body={s.unsafe} sentAt="2026-11-12T11:30:00Z" />
        </Card>
      </Block>

      <Block title={s.files}>
        <ul className="grid gap-2 md:grid-cols-2">
          {CHIPS.map((file) => (
            <li key={file.id} className="min-w-0">
              <FileChip file={file} onRemove={() => {}} />
            </li>
          ))}
        </ul>
      </Block>

      <Block title={s.composer} intro={s.composerIntro}>
        <Composer
          value={text}
          onChange={setText}
          files={files}
          onAttach={attach}
          onRemoveFile={(id) => setFiles((current) => current.filter((file) => file.id !== id))}
          onSend={() => {
            setShowError(false);
            setSending(true);
            setTimeout(() => {
              setSending(false);
              setShowError(true);
            }, 1500);
          }}
          sending={sending}
          error={showError ? s.sendError : undefined}
        />
      </Block>

      <Block title={s.meeting}>
        <div className="max-w-2xl">
          <MeetingCard
            platform="Zoom"
            url="https://zoom.us/j/81234567890?pwd=SampleMeetingPasscode2026"
            startsAt="2026-11-19T11:00:00Z"
            durationMinutes={45}
            actions={
              <Button variant="secondary" size="sm">
                {s.edit}
              </Button>
            }
          />
        </div>
      </Block>

      <Block title={s.documents}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <DocumentCard
            title={s.docs[0]}
            category="course_certificate"
            accessMode="view"
            status="granted"
            note={s.expiry}
            actions={<Button size="sm">{s.view}</Button>}
          />
          <DocumentCard
            title={s.docs[1]}
            category="thank_you_letter"
            accessMode="view_download"
            status="pending_review"
          />
          <DocumentCard
            title={s.docs[2]}
            category="event_photo"
            accessMode="view_download"
            status="expired"
            actions={
              <Button size="sm" variant="secondary">
                {s.request}
              </Button>
            }
          />
        </div>
      </Block>

      <Block title={s.confirm} intro={s.confirmIntro}>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setConfirming(true)} disabled={deleted}>
            {s.openConfirm}
          </Button>
          {deleted && <p role="status" className="text-sm font-semibold">{s.deletedNote}</p>}
        </div>
        <ConfirmTwice
          open={confirming}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            setDeleted(true);
          }}
          title={s.confirmTitle}
          question={s.confirmQuestion}
          word={s.confirmWord}
          confirmLabel={s.confirmLabel}
        />
      </Block>
    </div>
  );
}
