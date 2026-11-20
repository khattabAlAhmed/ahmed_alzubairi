import type { ReactNode } from "react";
import { NoticeGlyph } from "@/components/account/notice";
import { cx } from "@/components/ui/cx";

/**
 * The ErrorState board, at three sizes. Errors say what went wrong and what
 * to do, never blame, and never apologise at length (DESIGN.md "Voice").
 *
 * - `field`: one line under a field (TextField's `error` does this for forms).
 * - `section`: a part of the page didn't load; the rest still works. A
 *   hairline box opened by the danger rule, with a retry.
 * - `page`: the whole page failed. The heavy rule, a title in his voice
 *   ("It's on our side"), the actions, and a reference code for support.
 *
 * Each shows the cross glyph with words, never color alone. Actions come from
 * the caller (a retry button needs a handler, so it's a client component).
 */
export function ErrorState({
  size,
  title,
  text,
  action,
  reference,
  level = 2,
  id,
  className,
}: {
  size: "field" | "section" | "page";
  /** The field error's whole text, or the section and page title. */
  title: string;
  /** What to do next. Not used at field size. */
  text?: ReactNode;
  /** A retry, a reload, a way home. */
  action?: ReactNode;
  /** A short code a person can quote when they write in (page size). */
  reference?: string;
  /** The page title's level: 1 when the error is the page. */
  level?: 1 | 2;
  /** At field size, the id the field points to with `aria-describedby`. */
  id?: string;
  className?: string;
}) {
  if (size === "field") {
    return (
      <p id={id} role="alert" className={cx("flex items-start gap-1.5 text-[13px] leading-[1.7] text-danger", className)}>
        <NoticeGlyph tone="danger" className="mt-1 size-3.5" />
        <span>{title}</span>
      </p>
    );
  }

  if (size === "section") {
    return (
      <div
        role="alert"
        className={cx("flex flex-col items-start gap-2.5 border border-line border-t-2 border-t-danger bg-bg p-5", className)}
      >
        <p className="flex items-center gap-2 text-sm text-ink">
          <NoticeGlyph tone="danger" className="size-3.5" />
          {title}
        </p>
        {text && <p className="type-small">{text}</p>}
        {action}
      </div>
    );
  }

  const Heading = `h${level}` as const;
  return (
    <div role="alert" className={cx("flex flex-col gap-2.5 border-t-2 border-rule py-5", className)}>
      <Heading className="flex items-center gap-2.5 type-h2">
        <NoticeGlyph tone="danger" className="size-5" />
        {title}
      </Heading>
      {text && <p className="max-w-measure text-ink-2 type-small">{text}</p>}
      {action && <div className="flex flex-wrap items-center gap-4">{action}</div>}
      {reference && (
        <p dir="ltr" className="text-start font-mono text-xs text-ink-2 [unicode-bidi:plaintext]">
          {reference}
        </p>
      )}
    </div>
  );
}
