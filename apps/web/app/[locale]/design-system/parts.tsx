import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/*
 * The frame every group on the design-system page uses. Later Foundation
 * tasks fill their own section file with these and nothing else page-level.
 */

/** One group of components.md: the 2px rule that opens it, its title, an intro. */
export function DsSection({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 border-t-2 border-rule pt-5">
      <h2 id={`${id}-title`} className="type-h2">
        {title}
      </h2>
      {intro && <p className="mt-2 max-w-measure text-pretty text-ink-2">{intro}</p>}
      {children && <div className="mt-8 flex flex-col gap-12">{children}</div>}
    </section>
  );
}

/** One component or foundation inside a group, opened by a hairline. */
export function DsBlock({
  title,
  intro,
  children,
  className,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("border-t border-line pt-4", className)}>
      <h3 className="type-h3">{title}</h3>
      {intro && <p className="mt-1 max-w-measure text-pretty text-ink-2 type-small">{intro}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

/** A short note under a sample: what it is, what not to do. */
export function DsNote({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("max-w-measure text-pretty text-ink-2 type-caption", className)}>{children}</p>;
}

/** A state or token name: Latin, mono, read left to right in both pages. */
export function DsCode({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span dir="ltr" translate="no" className={cx("mono-meta text-ink-2", className)}>
      {children}
    </span>
  );
}

/**
 * The same sample in both themes, side by side from 1024, stacked on phones.
 * `[data-theme]` re-colors everything inside, whatever the page's theme.
 */
export function DsThemes({
  labels,
  children,
}: {
  labels: { light: string; dark: string };
  children: (theme: "light" | "dark") => ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {(["light", "dark"] as const).map((theme) => (
        <div key={theme} data-theme={theme} className="border border-line bg-bg p-5 text-ink">
          <p className="mb-4 text-ink-2 type-caption">{labels[theme]}</p>
          {children(theme)}
        </div>
      ))}
    </div>
  );
}

/** A stub for a group a later task builds. */
export function DsPending({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <DsSection id={id} title={title}>
      <p className="text-ink-2 type-small">{note}</p>
    </DsSection>
  );
}
