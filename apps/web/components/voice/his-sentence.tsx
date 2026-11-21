import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";

/**
 * The HisSentence board: one sentence of his, in two forms.
 *
 * - `between`: large, between two sections, at most once on a page. The
 *   sentence spans the middle eight columns; under it his name after a short
 *   accent rule, the only accent here.
 * - `inline`: a line inside a record, after the «بصوتي» label in the label
 *   column.
 *
 * The sentence is passed as he wrote it (with his own quotation marks, if
 * any): no decorative quotes, no italics, no colored word.
 */
export function HisSentence({
  sentence,
  variant = "between",
  className,
}: {
  sentence: string;
  variant?: "between" | "inline";
  className?: string;
}) {
  const t = useTranslations("Voice");

  if (variant === "inline") {
    return (
      <div className={cx("grid grid-cols-[var(--label-col)_minmax(0,1fr)] gap-6 border-y border-line py-4", className)}>
        <p className="text-ink-2 type-small">{t("inMyWords")}</p>
        <p className="text-balance type-h3 [&]:font-medium">{sentence}</p>
      </div>
    );
  }

  return (
    <figure className={cx("grid gap-x-8 gap-y-4 py-12 md:grid-cols-12", className)}>
      <blockquote
        className={cx(
          "text-balance md:col-span-8 md:col-start-3",
          "text-[24px] leading-[1.7] font-medium md:text-[34px]",
          "[&:lang(en)]:leading-[1.35] md:[&:lang(en)]:text-[30px]",
        )}
      >
        <p>{sentence}</p>
      </blockquote>
      <figcaption className="flex items-center gap-3 text-sm text-ink-2 md:col-span-8 md:col-start-3">
        <span aria-hidden="true" className="w-8 border-t-2 border-accent" />
        {t("author")}
      </figcaption>
    </figure>
  );
}
