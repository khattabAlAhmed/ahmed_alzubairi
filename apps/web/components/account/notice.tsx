import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

export type Notice = { ok: boolean; text: string };

export type NoticeTone = "success" | "info" | "warning" | "danger";

/*
 * The Notice board. Each tone has its own glyph shape (a check, an "i" in a
 * circle, a clock, a cross), so the tone never rests on color alone, and the
 * title says it in words. The text stays ink; only the glyph and the opening
 * rule take the tone's color.
 */
const GLYPHS: Record<NoticeTone, ReactNode> = {
  success: <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth="2.2" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  warning: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  danger: <path d="M6 6l12 12M18 6L6 18" strokeWidth="2.2" />,
};

const COLOR: Record<NoticeTone, string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  danger: "text-danger",
};

export function NoticeGlyph({ tone, className }: { tone: NoticeTone; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      className={cx("shrink-0", COLOR[tone], className)}
    >
      {GLYPHS[tone]}
    </svg>
  );
}

/**
 * An inline notice: a hairline box opened by a 2px rule in the tone's color,
 * the glyph, a title (the words that carry the tone) and a line of help, and
 * an optional action at the end (a retry, or a close button with an
 * `aria-label`). Danger is read out at once; the others politely.
 */
export function InlineNotice({
  tone,
  title,
  text,
  action,
  className,
}: {
  tone: NoticeTone;
  title: string;
  /** What to do next, or what it means. */
  text?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      data-tone={tone}
      className={cx(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border border-line border-t-2 bg-bg px-4 py-3.5",
        COLOR[tone],
        "border-t-current",
        className,
      )}
    >
      <NoticeGlyph tone={tone} className="mt-1.5" />
      <div className="text-ink">
        <p className="font-medium type-small">{title}</p>
        {text && <p className="text-[13px] leading-[1.7] text-ink-2">{text}</p>}
      </div>
      {action ? <div className="-my-1.5 text-ink">{action}</div> : <span />}
    </div>
  );
}

/**
 * A status line under a form: a glyph and the words, read out politely on
 * success and at once on failure.
 */
export function NoticeLine({ notice, className }: { notice: Notice | null; className?: string }) {
  if (!notice) return null;
  const tone = notice.ok ? "success" : "danger";
  return (
    <p role={notice.ok ? "status" : "alert"} className={cx("flex items-start gap-2 text-sm text-ink", className)}>
      <NoticeGlyph tone={tone} className="mt-0.5 size-4" />
      <span>{notice.text}</span>
    </p>
  );
}
