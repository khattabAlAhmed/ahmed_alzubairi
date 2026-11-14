"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { buttonClasses, Card } from "@/components/ui";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { zoneName } from "./format";
import { VideoIcon } from "./icons";
import { useInBrowser } from "./use-in-browser";

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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="mt-0.5 font-semibold wrap-anywhere">{children}</dd>
    </div>
  );
}

/** A video meeting (§6.17): platform, date, start to end time, duration, the zone named, and the link. */
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

  const date = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone }).format(start);
  const time = new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone }).formatRange(start, end);
  const zone = `${zoneName(start, locale, "longGeneric", timeZone)} (${zoneName(start, locale, "short", timeZone)})`;
  const duration = new Intl.NumberFormat(locale, { style: "unit", unit: "minute", unitDisplay: "long" }).format(
    durationMinutes,
  );

  return (
    <Card as="section" compact className={cx("space-y-4", className)}>
      <div className="flex items-center gap-2">
        {/* Gold as an icon (§13). */}
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <VideoIcon />
        </span>
        <Heading className="min-w-0 text-lg">{t("title")}</Heading>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Row label={t("platform")}>
          <bdi>{platform}</bdi>
        </Row>
        <Row label={t("date")}>{show && date}</Row>
        <Row label={t("time")}>{show && time}</Row>
        <Row label={t("duration")}>{duration}</Row>
        <div className="sm:col-span-2">
          <Row label={t("timeZone")}>{show && zone}</Row>
        </div>
      </dl>
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
      {/* The address itself, so it can be checked or copied. */}
      <p className="text-xs text-text-secondary">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={-1}
          dir="ltr"
          className={cx("rounded-sm wrap-anywhere underline-offset-2 hover:underline", FOCUS_RING)}
        >
          {url}
        </a>
      </p>
    </Card>
  );
}
