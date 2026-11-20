import type { CourseType } from "@repo/shared";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button, Tag } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { LocalDateTime } from "@/components/training/local-date-time";
import { Link } from "@/i18n/navigation";
import { formatDate } from "../home/format";
import { DateBlock } from "./date-block";
import { seatsLeftRatio } from "./links";
import { ABOVE_LINK, Heading, LIST_ROW, LIST_RULE, TITLE_LINK } from "./parts";

/**
 * Seats left as a sentence and a 4px bar. The sentence carries the meaning;
 * the bar fills as seats are taken, so a full course reads as a full bar.
 */
export function SeatsMeter({ left, total, className }: { left: number; total: number; className?: string }) {
  const t = useTranslations("PublicListing");
  const format = useFormatter();
  const shown = Math.min(Math.max(left, 0), total);
  const text = shown === 0 ? t("courseFull") : t("seatsLeft", { left: shown, total: format.number(total) });

  return (
    <div className={cx("flex flex-col gap-1.5 text-[13px] text-ink-2", className)}>
      <p>{text}</p>
      <div
        role="meter"
        aria-label={t("seatsMeter")}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={shown}
        aria-valuetext={text}
        className="h-1 bg-line"
      >
        <div className="h-full bg-ink" style={{ width: `${(1 - seatsLeftRatio(shown, total)) * 100}%` }} />
      </div>
    </div>
  );
}

export type CourseCardProps = {
  href: string;
  type: CourseType;
  title: string;
  description: string | null;
  /** When the course starts, as stored. */
  startsAt: string | null;
  /** The place, for an in-person course. Online courses show "Online". */
  place: string | null;
  /** Seats left and the total. Null when the course has no seat limit. */
  seats: { left: number; total: number } | null;
  /** The page's register button. Replaced by "Fully booked" when no seats are left. */
  action?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
};

/** The date column of a row: the day block, or "soon" for a recorded course, or the custom mark. */
function DateColumn({ type, startsAt, soon }: { type: CourseType; startsAt: string | null; soon: string }) {
  if (type === "recorded") {
    return (
      <span className="flex w-[88px] items-center justify-center border border-dashed border-line-strong px-1 py-3.5 text-center text-sm leading-tight font-medium">
        {soon}
      </span>
    );
  }
  if (type === "custom") {
    return (
      <span aria-hidden="true" className="flex w-[88px] justify-center bg-surface py-3.5">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
          <path d="M4 20V8l8-4 8 4v12M9 20v-6h6v6" />
        </svg>
      </span>
    );
  }
  return startsAt ? <DateBlock value={startsAt} /> : <span className="w-[88px]" />;
}

/**
 * A course as a row of the schedule (CourseItem board, §6.7): the date block,
 * the title with its type and place, the seats left, then the action. A
 * recorded course shows only "Coming soon": no date, seats or registration
 * this release. A full course shows "Fully booked" in place of the action. Rows
 * go inside `CourseSchedule`.
 */
export function CourseCard({
  href,
  type,
  title,
  description,
  startsAt,
  place,
  seats,
  action,
  headingLevel = 2,
  className,
}: CourseCardProps) {
  const t = useTranslations("PublicListing");
  const locale = useLocale();
  const recorded = type === "recorded";
  const full = !recorded && seats !== null && seats.left <= 0;
  const online = type === "online_live";
  const where = recorded ? null : online ? t("online") : place;

  return (
    <article
      className={cx(
        LIST_ROW,
        "grid grid-cols-[88px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 py-4.5",
        "md:grid-cols-[88px_minmax(0,1fr)_200px_minmax(160px,auto)] md:gap-x-7",
        className,
      )}
    >
      <DateColumn type={type} startsAt={recorded ? null : startsAt} soon={t("comingSoon")} />
      <div className="flex min-w-0 flex-col gap-1">
        <Heading level={headingLevel} className="type-h3">
          <Link href={href} className={TITLE_LINK}>
            {title}
          </Link>
        </Heading>
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
          <Tag tone={recorded ? "soon" : "neutral"}>
            {recorded ? `${t(`courseType.${type}`)} · ${t("comingSoon")}` : t(`courseType.${type}`)}
          </Tag>
          {where && <span>{where}</span>}
          {!recorded && startsAt && (
            <>
              <span aria-hidden="true">·</span>
              {/* The visitor's zone, as on the course page. */}
              <LocalDateTime value={startsAt} fallback={formatDate(startsAt, locale)} dateOnly />
            </>
          )}
        </p>
        {description && type === "custom" && <p className="text-pretty text-ink-2 type-small">{description}</p>}
      </div>
      <div className="col-start-2 md:col-start-3">
        {!recorded && seats && seats.total > 0 && <SeatsMeter left={seats.left} total={seats.total} />}
      </div>
      {!recorded && (full || action) && (
        <div className={cx(ABOVE_LINK, "col-start-2 md:col-start-4 [&>*]:w-full")}>
          {full ? (
            <Button variant="secondary" size="sm" disabled>
              {t("courseFull")}
            </Button>
          ) : (
            action
          )}
        </div>
      )}
    </article>
  );
}

/** Schedule rows under the 2px rule. */
export function CourseSchedule({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(LIST_RULE, className)}>{children}</div>;
}
