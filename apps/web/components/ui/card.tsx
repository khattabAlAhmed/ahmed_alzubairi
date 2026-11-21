import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type CardProps = HTMLAttributes<HTMLElement> & {
  /** `section` or `article` when the card has its own heading. */
  as?: "div" | "section" | "article" | "li";
  /** Less padding, for lists and dense dashboard screens. */
  compact?: boolean;
};

export function Card({ as: Tag = "div", compact = false, className, ...props }: CardProps) {
  return (
    <Tag
      className={cx(
        // Square, a hairline edge, on the page ground (DESIGN.md "Shape").
        "border border-line bg-bg text-ink",
        compact ? "p-4" : "p-6",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A title plus an optional intro, for a section inside a page (the
 * SectionShell board's head, for dashboard and account screens): type and
 * space make the hierarchy, not a bar over it.
 */
export function SectionHeading({
  title,
  intro,
  level = 2,
  id,
  actions,
  className,
}: {
  title: string;
  intro?: ReactNode;
  level?: 2 | 3;
  /** Lets a section point at its heading with `aria-labelledby`. */
  id?: string;
  /** Buttons or links on the end side. They wrap under the title on phones. */
  actions?: ReactNode;
  className?: string;
}) {
  const Heading = level === 2 ? "h2" : "h3";

  return (
    <div className={cx("flex flex-wrap items-end gap-x-6 gap-y-3", className)}>
      <div className="min-w-0 flex-1 basis-64">
        <Heading id={id} className={cx("text-ink", level === 2 ? "type-h2" : "type-h3")}>
          {title}
        </Heading>
        {intro && <p className="type-small mt-1.5 max-w-measure text-pretty text-ink-2">{intro}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * The top of a page (the PageHeader board, as the dashboard and account
 * screens use it): the 2px rule, where you are, the one h1, a sentence, and
 * actions on the end side. Never centred.
 */
export function PageHeader({
  title,
  intro,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  intro?: ReactNode;
  /** Where the page sits, such as a section name, in small ink-2 text. */
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("flex flex-wrap items-end gap-x-6 gap-y-4 border-t-2 border-rule pt-5 pb-6", className)}>
      <div className="min-w-0 flex-1 basis-72">
        {eyebrow && <p className="type-small mb-1.5 text-ink-2">{eyebrow}</p>}
        <h1 className="type-h1 text-ink">{title}</h1>
        {intro && <p className="type-body mt-2 max-w-measure text-pretty text-ink-2">{intro}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
