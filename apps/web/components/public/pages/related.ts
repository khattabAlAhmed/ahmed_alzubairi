import type { Project } from "@/lib/content";

/** The organizations a set of projects served, once each, in project order. */
export function servedOrganizations(projects: readonly Project[]): string[] {
  return [...new Set(projects.flatMap((project) => project.organization ?? []))];
}

/** An area's counts for its ledger: its projects and the organizations they served. */
export function areaFacts(projects: readonly Project[]): { projects: number; organizations: number } {
  return { projects: projects.length, organizations: servedOrganizations(projects).length };
}

/** The years in a period, Western or Arabic-Indic digits: "2016 – 2020" → [2016, 2020]. */
function periodYears(period: string | null): number[] {
  if (!period) return [];
  const western = period.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
  return (western.match(/\d{4}/g) ?? []).map(Number);
}

/**
 * Career entries newest first, so the page's «الأحدث أولاً» holds whatever
 * order editors saved: a running role first, then by end year, then by start
 * year. Entries without a year keep their saved order, after the rest.
 */
export function newestFirst<T extends { period: string | null }>(
  items: readonly T[],
  isOngoing: (period: string | null) => boolean,
): T[] {
  const key = (item: T): [number, number] => {
    const years = periodYears(item.period);
    if (years.length === 0) return [-Infinity, -Infinity];
    const start = years[0]!;
    const end = isOngoing(item.period) ? Infinity : (years[years.length - 1] ?? start);
    return [end, start];
  };
  return [...items].sort((a, b) => {
    const [endA, startA] = key(a);
    const [endB, startB] = key(b);
    if (endA !== endB) return endB > endA ? 1 : -1;
    if (startA !== startB) return startB > startA ? 1 : -1;
    return 0;
  });
}
