import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { cx } from "@/components/ui/cx";
import type { HomeSection } from "@/lib/content";
import { Signature } from "./signature";

export type LetterContent = Extract<HomeSection, { key: "letter" }>["content"];

// A narrow measure and a taller line: the letter is read slowly (19 / 2.05
// in Arabic, 18 / 1.7 in English; 18 when narrow).
const BODY = cx(
  "max-w-[32em] text-[18px] leading-[2.05] @3xl:text-[19px]",
  "[&:lang(en)]:leading-[1.7] @3xl:[&:lang(en)]:text-[18px]",
);

/**
 * The Letter board: the site's most important moment of his voice. A record
 * opened by the heavy rule. The label column holds the heading, an optional
 * ledger ("Written · March 2026") and, while `isPlaceholder`, the dashed
 * «نص وتوقيع مؤقتان» tag. The body sits at a narrow reading measure with a
 * slightly taller line (19 / 2.05 in Arabic), then the signature and his name.
 * An optional photo at 4:5 closes the row on wide screens.
 *
 * Every paragraph is rendered as text, never HTML; a line break inside a
 * paragraph is kept.
 *
 * It lays out by the width it's given (a container query), not the screen:
 * the full row on the home page, one column in a narrow panel or on a phone.
 */
export function Letter({
  content,
  meta,
  photo,
  theme,
  className,
}: {
  content: LetterContent;
  /** Short facts under the heading, already formatted: [{ term: "كُتبت", value: "مارس ٢٠٢٦" }]. */
  meta?: { term: string; value: string }[];
  /** A photo of Ahmed at work, 4:5. Shown when the letter has the full row (768px and wider). */
  photo?: { src: string; alt: string; caption?: string };
  /** Forces the signature's theme, for a themed panel (the design-system page). */
  theme?: "light" | "dark";
  className?: string;
}) {
  const t = useTranslations("Voice");
  const headingId = useId();

  return (
    <div className={cx("@container", className)}>
      <article
        aria-labelledby={headingId}
        className="grid gap-x-8 gap-y-6 border-t-2 border-rule pt-7 pb-9 @3xl:grid-cols-12"
      >
        <div className="flex flex-col gap-3.5 @3xl:col-span-3">
          <h2 id={headingId} className="text-ink-2 type-small">
            {content.heading}
          </h2>
          {meta && meta.length > 0 && (
            <dl className="border-t border-line">
              {meta.map((item) => (
                <div key={item.term} className="flex items-baseline justify-between gap-3 border-b border-line py-3">
                  <dt className="text-sm text-ink-2">{item.term}</dt>
                  <dd className="font-medium">{item.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {content.isPlaceholder && (
            <Badge tone="draft" className="self-start">
              {t("placeholderTag")}
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-5.5 @3xl:col-span-6">
          <p className={cx(BODY, "text-ink-2")}>{content.salutation}</p>
          {content.paragraphs.map((paragraph, index) => (
            <p key={index} className={cx(BODY, "whitespace-pre-line text-pretty")}>
              {paragraph}
            </p>
          ))}
          <div className="flex flex-col gap-2">
            <Signature inkUrl={content.signatureUrl} lightUrl={content.signatureDarkUrl} theme={theme} />
            <p className="text-[15px]">{content.signOff}</p>
          </div>
        </div>

        {photo && (
          <figure className="hidden flex-col gap-2 @3xl:col-span-3 @3xl:flex">
            <div className="relative aspect-[4/5] bg-surface">
              <Image src={photo.src} alt={photo.alt} fill sizes="25vw" className="object-cover" />
            </div>
            {photo.caption && <figcaption className="text-ink-2 type-caption">{photo.caption}</figcaption>}
          </figure>
        )}
      </article>
    </div>
  );
}
