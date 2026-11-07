import type { HomeStat } from "@/lib/content";
import { HomeSectionShell } from "./section";
import { StatNumber } from "./stat-number";

/** §6.2 #2. Values come from `home_stats`, never from code. */
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
    <HomeSectionShell sectionKey="stats" heading={heading} intro={intro} band="navy">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.id} className="flex flex-col-reverse gap-2 border-s-2 border-accent ps-4">
            <dt className="text-on-primary/80">{stat.label}</dt>
            <dd className="font-heading text-4xl font-bold text-accent md:text-5xl">
              <StatNumber value={stat.value} />
            </dd>
          </div>
        ))}
      </dl>
    </HomeSectionShell>
  );
}
