import { AudienceRows } from "@/components/public/pages/identity";
import type { HomeSection } from "@/lib/content";
import { HomeSectionShell, type SectionBand } from "./section";

type AudiencesContent = Extract<HomeSection, { key: "audiences" }>["content"];

/** §6.2 #4, "لمن أعمل": government, humanitarian, private, as rows (the Audience board). */
export function AudiencesSection({ content, band }: { content: AudiencesContent; band: SectionBand }) {
  return (
    <HomeSectionShell sectionKey="audiences" heading={content.heading} intro={content.intro} band={band}>
      <AudienceRows items={content.items} />
    </HomeSectionShell>
  );
}
