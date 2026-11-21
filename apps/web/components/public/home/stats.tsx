import { StatBand } from "@/components/public/pages/identity";
import type { HomeStat } from "@/lib/content";
import { HomeSectionShell } from "./section";

/**
 * §6.2 #2, the quick stats as a band (the QuietStat board). Static: nothing
 * counts up (Ahmed's decision). Values come from `home_stats`, never from code.
 */
export function StatsSection({
  heading,
  intro,
  stats,
}: {
  heading: string;
  intro?: string;
  stats: HomeStat[];
}) {
  return (
    <HomeSectionShell sectionKey="stats" heading={heading} intro={intro} band="plain">
      <StatBand stats={stats} />
    </HomeSectionShell>
  );
}
