"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { dateLocale, formatCount, formatDateTime, formatTimeRange } from "@/lib/time/format";
import { zoneName } from "./format";
import { useInBrowser } from "./use-in-browser";
import { metaSeparator } from "@/components/public/home/format";

export type MeetingCardProps = {
  platform: string;
  /** The external meeting link (https). */
  url: string;
  /** UTC, ISO 8601. */
  startsAt: string;
  durationMinutes: number;
  /** A fixed zone. Without it, the viewer's browser zone (§6.17: the client's local time, zone named). */
  timeZone?: string;
  /** Extra buttons on the team side, such as "Edit". */
  actions?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
};

/**
 * A video meeting (§6.17, the MeetingCard board): a day block in ink (the
 * weekday, the date large, the month) beside the title, the start to end
 * time with the zone named, the duration, the platform and its address, and
 * the join button. Times show in the viewer's browser zone unless a zone is
 * given, so they render on the client.
 */
export function MeetingCard({
  platform,
  url,
  startsAt,
  durationMinutes,
  timeZone,
  actions,
  headingLevel = 3,
  className,
}: MeetingCardProps) {
  const t = useTranslations("Workspace.meeting");
  const locale = useLocale();
  const inBrowser = useInBrowser();
  const show = inBrowser || timeZone !== undefined;
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const Heading = headingLevel === 2 ? "h2" : "h3";

  const date = formatDateTime(start, locale, { date: "full", time: false, timeZone });
  const time = formatTimeRange(start, end, locale, timeZone);
  const zone = `${zoneName(start, locale, "longGeneric", timeZone)} (${zoneName(start, locale, "short", timeZone)})`;
  const duration = formatCount(durationMinutes, locale, { style: "unit", unit: "minute", unitDisplay: "long" });
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(dateLocale(locale), { ...options, timeZone }).format(start);

  return (
    <section
      className={cx("grid grid-cols-[88px_minmax(0,1fr)] border-t-2 border-b border-rule border-b-line sm:grid-cols-[96px_minmax(0,1fr)]", className)}
    >
      {/* The day at a glance; the full date is read out below. */}
      <div aria-hidden="true" className="flex flex-col items-center justify-center bg-ink px-1 py-3.5 text-bg">
        {show && (
          <>
            <span className="text-[13px]">{part({ weekday: "long" })}</span>
            <span className="text-[34px] leading-[1.1] font-medium tabular-nums">{part({ day: "numeric" })}</span>
            <span className="text-[13px]">{part({ month: "long" })}</span>
            <span className="text-xs tabular-nums">{part({ year: "numeric" })}</span>
          </>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2 px-4 py-3.5 sm:px-5">
        <Heading className="type-h3">{t("title")}</Heading>
        <p className={show ? "sr-only" : "hidden"}>{date}</p>
        <p className="flex flex-wrap gap-x-2 type-small">
          <span className="tabular-nums">{show && time}</span>
          <span aria-hidden="true">{metaSeparator(locale).trim()}</span>
          <span className="text-ink-2">{show && zone}</span>
          <span aria-hidden="true">{metaSeparator(locale).trim()}</span>
          <span>{duration}</span>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-[13px] leading-[1.7] text-ink-2">
            <bdi>{platform}</bdi>
            {metaSeparator(locale)}
            {/* The address itself, so it can be checked or copied. */}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={-1}
              dir="ltr"
              className="font-mono text-xs wrap-anywhere underline-offset-2 hover:underline"
            >
              {url}
            </a>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("joinLabel", { platform })}
              className={buttonClasses({ size: "sm" })}
            >
              {t("join")}
            </a>
            {actions}
          </div>
        </div>
      </div>
    </section>
  );
}
