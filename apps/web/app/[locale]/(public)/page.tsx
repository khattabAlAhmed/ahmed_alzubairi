import { SITE_NAME, type HomeSectionKey, type Locale } from "@repo/shared";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
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

/** Waits for Phase 5's newsletter signup; until then the section never shows. */
const NOT_YET_BUILT: readonly HomeSectionKey[] = ["newsletter"];

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

// Static: lib/content reads are cached by tag, and nothing here reads the session.
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const sections = (await getHomeSections(locale)).filter(
    (section) => !NOT_YET_BUILT.includes(section.key),
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
