import type { ResourceKind } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Tag } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { metaSeparator } from "../home/format";
import { Heading, LIST_ROW } from "./parts";

export type ResourceFileType = "pdf" | "word" | "excel";

/** What the glyph prints: the file's extension, Latin data in both languages. */
const EXTENSION: Record<ResourceFileType, string> = { pdf: "PDF", word: "DOCX", excel: "XLSX" };

/**
 * The file-type glyph (ResourceItem board): a sheet with a folded corner and
 * the extension at its foot, in mono. The format is said in words for screen
 * readers.
 */
export function FileTypeBadge({ type, className }: { type: ResourceFileType | null; className?: string }) {
  const t = useTranslations("PublicListing");
  return (
    <span
      // Without a known format the sheet is only a picture.
      aria-hidden={type ? undefined : "true"}
      className={cx(
        "relative flex h-14 w-11 shrink-0 items-end justify-center border-[1.5px] border-ink pb-1.5 font-mono text-[11px] font-medium",
        // The folded corner: a square of page colour with two edges drawn.
        "before:absolute before:-end-[1.5px] before:-top-[1.5px] before:size-3 before:border-b-[1.5px] before:border-s-[1.5px] before:border-ink before:bg-bg",
        className,
      )}
    >
      {type && (
        <>
          <span className="sr-only">{t("fileTypeLabel", { type: t(`fileType.${type}`) })}</span>
          <span aria-hidden="true" dir="ltr">
            {EXTENSION[type]}
          </span>
        </>
      )}
    </span>
  );
}

/** Where a resource row's action and what opens under it sit (`ResourceDownload` uses these). */
export const RESOURCE_ACTION = "col-start-2 justify-self-start md:col-start-3 md:row-start-1 md:justify-self-end";
export const RESOURCE_BELOW = "col-start-2 md:col-end-4";

/**
 * A free resource as a row (ResourceItem board, §6.9): the file glyph, the
 * title, one line, its tags, then the action at the end. `action` is the
 * page's download button or email gate: this row doesn't know how the file is
 * reached. An action may span the row below (the email form) with
 * `RESOURCE_BELOW`.
 */
export function ResourceCard({
  kind,
  fileType,
  title,
  description,
  action,
  tags = [],
  size,
  headingLevel = 2,
  className,
}: {
  kind: ResourceKind;
  fileType: ResourceFileType | null;
  title: string;
  description: string | null;
  action: ReactNode;
  /** More tags after the kind, such as the area. */
  tags?: string[];
  /** The file size, as Latin data ("1.1 MB"). */
  size?: string | null;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("PublicListing");

  return (
    <article
      className={cx(
        LIST_ROW,
        "grid grid-cols-[44px_minmax(0,1fr)] items-start gap-x-4 gap-y-3 py-4.5 md:grid-cols-[56px_minmax(0,1fr)_auto] md:gap-x-5",
        className,
      )}
    >
      <div className="row-span-2 md:row-span-1">
        <FileTypeBadge type={fileType} />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <Heading level={headingLevel} className="type-h3">
          {title}
        </Heading>
        {description && <p className="line-clamp-3 text-pretty text-ink-2 type-small">{description}</p>}
        <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
          <Tag>{t(`resourceKind.${kind}`)}</Tag>
          {tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
          {size && (
            <>
              <span aria-hidden="true">{metaSeparator(locale).trim()}</span>
              <span dir="ltr" className="font-mono text-xs">
                {size}
              </span>
            </>
          )}
        </p>
      </div>
      {action}
    </article>
  );
}

/** Resource rows under the 2px rule. */
export function ResourceList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("border-t-2 border-rule", className)}>{children}</div>;
}
