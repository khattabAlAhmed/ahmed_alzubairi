import type { Locale } from "@repo/shared";
import { useTranslations } from "next-intl";
import { CONTAINER } from "@/components/public/parts";
import { cx } from "@/components/ui/cx";
import { Letter, type LetterContent } from "@/components/voice/letter";
import { formatMonth } from "./format";

/** The letter's photo until Ahmed's own is uploaded: hands and notes, no face (images/README). */
export const LETTER_PHOTO = "/images/hands-notes.webp";

/**
 * §6.2, Ahmed's letter (the Letter board), right under the hero. The label
 * column says when it was written («كُتبت · مارس ٢٠٢٦», the month of its last
 * edit). While it's the placeholder text, the column shows the
 * «نص وتوقيع مؤقتان» tag instead of a date, and the placeholder signature
 * stands in until his scans are uploaded. The photo is decorative.
 */
export function LetterSection({
  content,
  writtenAt,
  locale,
}: {
  content: LetterContent;
  writtenAt: string | null;
  locale: Locale;
}) {
  const t = useTranslations("Home");
  const meta =
    !content.isPlaceholder && writtenAt ? [{ term: t("letterWritten"), value: formatMonth(writtenAt, locale) }] : undefined;

  return (
    <div data-section="letter" className={cx(CONTAINER, "mt-section")}>
      <Letter content={content} meta={meta} photo={{ src: LETTER_PHOTO, alt: "" }} />
    </div>
  );
}
