import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import { formatDate } from "../home/format";
import { Heading, LIST_ROW, LIST_RULE, MetaLine, TITLE_LINK, type ListingImage } from "./parts";

/** The date and reading time under an article's title, on a card or the article page. */
export function ArticleMeta({
  publishedAt,
  readingMinutes,
  className,
}: {
  publishedAt: string | null;
  readingMinutes: number | null;
  className?: string;
}) {
  const t = useTranslations("PublicListing");
  const locale = useLocale();

  return (
    <MetaLine
      className={className}
      items={[
        publishedAt && <time dateTime={publishedAt}>{formatDate(publishedAt, locale)}</time>,
        readingMinutes ? t("readingTime", { minutes: readingMinutes }) : null,
      ]}
    />
  );
}

export type ArticleCardProps = {
  href: string;
  title: string;
  excerpt: string | null;
  /** The expertise area's name, already in the page's language. */
  category: string | null;
  cover: ListingImage | null;
  publishedAt: string | null;
  readingMinutes: number | null;
  /** h2 on a list page, h3 under a section heading (related articles). */
  headingLevel?: 2 | 3;
  /** The article's language, when it differs from the page's (a one-language article). */
  lang?: string;
  className?: string;
};

/**
 * A blog article as a journal row (ArticleItem board, §6.8): the date in a
 * fixed column like a record, an optional square image, the title and one
 * line, then reading time and area at the end. The whole row opens the
 * article. Rows go inside `ArticleList`.
 */
export function ArticleCard({
  href,
  title,
  excerpt,
  category,
  cover,
  publishedAt,
  readingMinutes,
  headingLevel = 2,
  lang,
  className,
}: ArticleCardProps) {
  const t = useTranslations("PublicListing");
  const locale = useLocale();
  const end = [readingMinutes ? t("readingTime", { minutes: readingMinutes }) : null, category].filter(Boolean);

  return (
    <article
      className={cx(
        LIST_ROW,
        "grid gap-x-8 gap-y-2 py-4.5 md:items-baseline",
        cover ? "grid-cols-[96px_minmax(0,1fr)] md:grid-cols-[120px_120px_minmax(0,1fr)_minmax(140px,auto)] md:items-start" : "md:grid-cols-[120px_minmax(0,1fr)_minmax(140px,auto)]",
        className,
      )}
    >
      <p className={cx("text-[13px] text-ink-2 tabular-nums", cover && "col-span-2 md:col-span-1")}>
        {publishedAt && <time dateTime={publishedAt}>{formatDate(publishedAt, locale)}</time>}
      </p>
      {cover && (
        <div className="relative aspect-square bg-surface">
          <Image src={cover.src} alt={cover.alt} fill sizes="120px" className="object-cover" />
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1.5">
        <Heading level={headingLevel} className={cover ? "type-h2" : "type-h3"}>
          <Link href={href} lang={lang} className={TITLE_LINK}>
            {title}
          </Link>
        </Heading>
        {excerpt && <p className="line-clamp-2 text-pretty text-ink-2 type-small">{excerpt}</p>}
      </div>
      <p className={cx("flex flex-wrap gap-x-1.5 text-[13px] text-ink-2 md:flex-nowrap md:justify-end md:whitespace-nowrap", cover && "col-span-2 md:col-span-1")}>
        {end.map((item, index) => (
          <span key={index} className="inline-flex gap-1.5">
            {index > 0 && <span aria-hidden="true">·</span>}
            {item}
          </span>
        ))}
      </p>
    </article>
  );
}

/** Article rows under the 2px rule. */
export function ArticleList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(LIST_RULE, className)}>{children}</div>;
}
