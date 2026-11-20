import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";

/**
 * The WhyITookIt board: a margin note on a project page, beside "what I
 * did". The only raised ground on the page (`surface`), opened by the heavy
 * rule: a caption naming it, his reason in a sentence or two, and his name.
 * The caller places it in the side column.
 */
export function WhyITookIt({ text, className }: { text: string; className?: string }) {
  const t = useTranslations("Voice");
  return (
    <aside
      aria-label={t("whyLabel")}
      className={cx("flex flex-col gap-2.5 border-t-2 border-rule bg-surface px-5 py-4.5", className)}
    >
      <p className="text-ink-2 type-caption">{t("whyLabel")}</p>
      <p className="text-base leading-[1.85] whitespace-pre-line text-pretty [&:lang(en)]:leading-[1.6]">{text}</p>
      <p className="text-ink-2 type-caption">{t("signedBy")}</p>
    </aside>
  );
}
