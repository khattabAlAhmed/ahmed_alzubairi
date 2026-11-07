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
        "rounded-lg border border-text/10 bg-surface text-text shadow-sm",
        compact ? "p-4" : "p-6",
        className,
      )}
      {...props}
    />
  );
}

/** A title plus an optional intro, for a section inside a page. */
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
        <Heading
          id={id}
          className={cx("text-balance text-text", level === 2 ? "text-2xl md:text-3xl" : "text-xl")}
        >
          {title}
        </Heading>
        {intro && <p className="mt-2 max-w-prose text-pretty text-text-secondary">{intro}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** The top of a page: its one h1, an optional intro, and actions. */
export function PageHeader({
  title,
  intro,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  intro?: ReactNode;
  /** A short line above the title, such as a section name. */
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-text/10 pb-6", className)}>
      <div className="min-w-0 flex-1 basis-72">
        {eyebrow && (
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-secondary">
            {/* Gold as a divider, never as text (§13). */}
            <span aria-hidden="true" className="h-0.5 w-6 shrink-0 rounded-full bg-accent" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-balance text-3xl leading-tight text-text md:text-4xl">{title}</h1>
        {intro && <p className="mt-3 max-w-prose text-pretty text-lg text-text-secondary">{intro}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
