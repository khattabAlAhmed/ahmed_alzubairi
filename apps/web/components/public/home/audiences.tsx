import type { HomeSection } from "@/lib/content";
import { CARD, HomeSectionShell, type SectionBand } from "./section";

type AudiencesContent = Extract<HomeSection, { key: "audiences" }>["content"];

/** §6.2 #4: government, humanitarian, private. */
export function AudiencesSection({ content, band }: { content: AudiencesContent; band: SectionBand }) {
  return (
    <HomeSectionShell sectionKey="audiences" heading={content.heading} intro={content.intro} band={band}>
      <ul className="grid gap-6 md:grid-cols-3">
        {content.items.map((item, index) => (
          <li key={index} className={CARD}>
            <span
              aria-hidden="true"
              className="mb-4 flex size-10 items-center justify-center rounded-full bg-primary font-heading text-lg font-bold text-on-primary"
            >
              {index + 1}
            </span>
            <h3 className="text-xl">{item.title}</h3>
            {item.description && <p className="mt-2 text-pretty text-text-secondary">{item.description}</p>}
          </li>
        ))}
      </ul>
    </HomeSectionShell>
  );
}
