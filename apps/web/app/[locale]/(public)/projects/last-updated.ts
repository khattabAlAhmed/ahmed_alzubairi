import type { Locale } from "@repo/shared";
import { dateLocale } from "@/components/public/home/format";

/**
 * The newest edit among the projects, as month and year in the page's
 * language ("March 2026" / "مارس ٢٠٢٦"). Shown in UTC: the page is cached, so
 * the visitor's time zone isn't known, and a month barely shifts. Null when
 * there are no projects.
 */
export function lastUpdated(projects: readonly { updatedAt: string }[], locale: Locale): string | null {
  const times = projects.map((project) => Date.parse(project.updatedAt)).filter((time) => Number.isFinite(time));
  if (times.length === 0) return null;
  return new Intl.DateTimeFormat(dateLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Math.max(...times)),
  );
}
