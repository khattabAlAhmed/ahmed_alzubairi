import { AudienceRows } from "@/components/public/pages/identity";
import type { HomeSection } from "@/lib/content";
import { HomeSectionShell } from "./section";

type AudiencesContent = Extract<HomeSection, { key: "audiences" }>["content"];

/** §6.2 #4, "لمن أعمل": government, humanitarian, private, as rows (the Audience board). */
export function AudiencesSection({ content }: { content: AudiencesContent }) {
  return (
    <HomeSectionShell sectionKey="audiences" heading={content.heading} intro={content.intro}>
      <AudienceRows items={content.items} />
    </HomeSectionShell>
  );
}
