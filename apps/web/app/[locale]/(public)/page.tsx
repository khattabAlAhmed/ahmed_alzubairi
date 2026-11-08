import { SITE_NAME, type HomeSectionKey, type Locale } from "@repo/shared";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Fragment, type ReactNode } from "react";
import {
  AudiencesSection,
  ContactSection,
  ExpertiseSection,
  HeroSection,
  HOME_LATEST_COUNT,
  LatestSection,
  MediaSection,
  PartnersSection,
  ProjectsSection,
  ServicesSection,
  StatsSection,
  TestimonialsSection,
  type SectionBand,
} from "@/components/public/home";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import {
  getExpertiseAreas,
  getHomeSections,
  getHomeStats,
  getLatestMediaItems,
  getLatestPosts,
  getLatestResources,
  getPartners,
  getProjects,
  getServices,
  getSiteSettings,
  getTestimonials,
  type HomeSection,
} from "@/lib/content";

/**
 * Sections waiting for their Phase 5 pages (docs/plan.md, Phase 5). The home
 * page neither reads nor renders them, whatever their visibility or content,
 * so it never links to a page that 404s. Phase 5 deletes each line as the
 * page ships; the section components stay ready for it.
 */
const WAITING_FOR_PAGES: readonly HomeSectionKey[] = [
  "newsletter", // §6.15 newsletter signup
  "media", // §6.10: links to /media
  "latest", // §6.8–6.9: links to /blog and /resources
];

const none = Promise.resolve([]);

/** Reads only what the visible sections need, in parallel. */
async function loadSectionData(locale: Locale, keys: ReadonlySet<HomeSectionKey>) {
  const when = <T,>(key: HomeSectionKey, read: () => Promise<T[]>): Promise<T[]> =>
    keys.has(key) ? read() : none;

  const [stats, areas, services, projects, partners, testimonials, media, posts, resources, settings] =
    await Promise.all([
      when("stats", () => getHomeStats(locale)),
      when("expertise", () => getExpertiseAreas(locale)),
      when("services", () => getServices(locale)),
      when("projects", () => getProjects(locale)),
      when("partners", () => getPartners(locale)),
      when("testimonials", () => getTestimonials(locale)),
      when("media", () => getLatestMediaItems(locale, 1)),
      when("latest", () => getLatestPosts(locale, HOME_LATEST_COUNT)),
      when("latest", () => getLatestResources(locale, HOME_LATEST_COUNT)),
      keys.has("contact") ? getSiteSettings() : null,
    ]);

  return {
    stats,
    areas,
    services: services.filter((service) => service.isFeatured),
    projects,
    partners,
    testimonials,
    media,
    posts,
    resources,
    settings,
  };
}

type SectionData = Awaited<ReturnType<typeof loadSectionData>>;

/** A section ready to render, or null when it has nothing to show. */
type Planned = { key: HomeSectionKey; navy: boolean; render: (band: SectionBand) => ReactNode };

/**
 * Pick the renderer for one section. Navy sections keep their band; the others
 * alternate later. Returns null when the section has no data to show.
 */
function plan(section: HomeSection, data: SectionData, locale: Locale): Planned | null {
  const fixed = (render: () => ReactNode): Planned => ({ key: section.key, navy: true, render });
  const banded = (render: (band: SectionBand) => ReactNode): Planned => ({
    key: section.key,
    navy: false,
    render,
  });

  switch (section.key) {
    case "hero":
      return fixed(() => <HeroSection content={section.content} />);
    case "stats":
      if (data.stats.length === 0) return null;
      return fixed(() => <StatsSection {...section.content} stats={data.stats} />);
    case "expertise":
      if (data.areas.length === 0) return null;
      return banded((band) => <ExpertiseSection {...section.content} band={band} areas={data.areas} />);
    case "audiences":
      return banded((band) => <AudiencesSection content={section.content} band={band} />);
    case "services":
      if (data.services.length === 0) return null;
      return banded((band) => <ServicesSection {...section.content} band={band} services={data.services} />);
    case "projects":
      if (data.projects.length === 0) return null;
      return banded((band) => <ProjectsSection {...section.content} band={band} projects={data.projects} />);
    case "partners":
      if (data.partners.length === 0) return null;
      return banded((band) => <PartnersSection {...section.content} band={band} partners={data.partners} />);
    case "testimonials":
      if (data.testimonials.length === 0) return null;
      return banded((band) => (
        <TestimonialsSection {...section.content} band={band} testimonials={data.testimonials} />
      ));
    case "media": {
      const [item] = data.media;
      if (!item) return null;
      return banded((band) => <MediaSection {...section.content} band={band} item={item} locale={locale} />);
    }
    case "latest":
      if (data.posts.length === 0 && data.resources.length === 0) return null;
      return banded((band) => (
        <LatestSection
          {...section.content}
          band={band}
          posts={data.posts}
          resources={data.resources}
          locale={locale}
        />
      ));
    case "newsletter":
      return null;
    case "contact": {
      const { settings } = data;
      if (!settings) return null;
      return fixed(() => <ContactSection {...section.content} settings={settings} />);
    }
  }
}

/**
 * Renders on request, never at build: Vercel doesn't give Sensitive variables
 * to an outside build, so the build can't read Supabase. The lib/content reads
 * stay cached and are revalidated by tag (§9). Nothing here reads the session.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await connection();

  const sections = (await getHomeSections(locale)).filter(
    (section) => !WAITING_FOR_PAGES.includes(section.key),
  );
  const data = await loadSectionData(locale, new Set(sections.map((section) => section.key)));
  const planned = sections.flatMap((section) => plan(section, data, locale) ?? []);

  // Light bands alternate over the sections actually shown.
  let light = 0;
  const rendered = planned.map((section) => {
    const band: SectionBand = section.navy ? "navy" : light++ % 2 === 0 ? "plain" : "raised";
    return <Fragment key={section.key}>{section.render(band)}</Fragment>;
  });

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      {!planned.some((section) => section.key === "hero") && <h1 className="sr-only">{SITE_NAME}</h1>}
      {rendered}
    </main>
  );
}
