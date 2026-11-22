import type { Locale } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import {
  getExpertiseAreas,
  getHomeStats,
  getLatestMediaItems,
  getLatestPosts,
  getLatestResources,
  getPartners,
  getProjects,
  getServices,
  getSiteSettings,
  getTestimonials,
} from "@/lib/content";
import { AudiencesSection } from "./audiences";
import type { HomeBlock } from "./compose";
import { ContactSection } from "./contact";
import { ExpertiseSection } from "./expertise";
import { MediaSection } from "./media";
import { NewsletterSection } from "./newsletter";
import { PartnersSection } from "./partners";
import { ProjectsSection } from "./projects";
import { HOME_READING, ReadingSection } from "./reading";
import { SectionBoundary } from "./section-boundary";
import { SectionSkeleton, type SectionSkeletonKind } from "./section-skeleton";
import { ServicesSection } from "./services";
import { StatsSection } from "./stats";
import { TestimonialsSection } from "./testimonials";

type DataBlock = Exclude<HomeBlock, { key: "hero" | "letter" | "audiences" | "newsletter" }>;

const SKELETON: Record<DataBlock["key"], SectionSkeletonKind> = {
  stats: "rows",
  expertise: "chapters",
  services: "rows",
  projects: "projects",
  partners: "register",
  testimonials: "quotes",
  reading: "reading",
  media: "media",
  contact: "rows",
};

/**
 * A home section that reads rows of its own: it streams behind a skeleton
 * shaped like it, and a failed read shows the section's error with a retry
 * while the rest of the page renders. An empty result renders nothing.
 */
async function Frame({ block, locale, children }: { block: DataBlock; locale: Locale; children: ReactNode }) {
  const [t, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);
  const { heading, intro } = block.section.content;

  return (
    <SectionBoundary
      labels={{ heading, title: t("sectionError.title"), text: t("sectionError.text"), retry: t("sectionError.retry") }}
    >
      <Suspense
        fallback={
          <SectionSkeleton
            sectionKey={block.section.key}
            heading={heading}
            intro={intro}
            kind={SKELETON[block.key]}
            label={tCommon("loading")}
          />
        }
      >
        {children}
      </Suspense>
    </SectionBoundary>
  );
}

async function Stats({ block, locale }: { block: Extract<HomeBlock, { key: "stats" }>; locale: Locale }) {
  const stats = await getHomeStats(locale);
  return stats.length > 0 ? <StatsSection {...block.section.content} stats={stats} /> : null;
}

async function Expertise({ block, locale }: { block: Extract<HomeBlock, { key: "expertise" }>; locale: Locale }) {
  const areas = await getExpertiseAreas(locale);
  return areas.length > 0 ? <ExpertiseSection {...block.section.content} band="plain" areas={areas} /> : null;
}

async function Services({ block, locale }: { block: Extract<HomeBlock, { key: "services" }>; locale: Locale }) {
  const services = (await getServices(locale)).filter((service) => service.isFeatured);
  return services.length > 0 ? <ServicesSection {...block.section.content} band="plain" services={services} /> : null;
}

async function Projects({ block, locale }: { block: Extract<HomeBlock, { key: "projects" }>; locale: Locale }) {
  const projects = await getProjects(locale);
  return projects.length > 0 ? <ProjectsSection {...block.section.content} band="plain" projects={projects} /> : null;
}

async function Partners({ block, locale }: { block: Extract<HomeBlock, { key: "partners" }>; locale: Locale }) {
  const partners = await getPartners(locale);
  return partners.length > 0 ? <PartnersSection {...block.section.content} band="plain" partners={partners} /> : null;
}

async function Testimonials({ block, locale }: { block: Extract<HomeBlock, { key: "testimonials" }>; locale: Locale }) {
  const testimonials = await getTestimonials(locale);
  return testimonials.length > 0 ? (
    <TestimonialsSection {...block.section.content} band="plain" testimonials={testimonials} />
  ) : null;
}

async function Reading({ block, locale }: { block: Extract<HomeBlock, { key: "reading" }>; locale: Locale }) {
  const [posts, resources, media] = await Promise.all([
    getLatestPosts(locale, HOME_READING.posts),
    getLatestResources(locale, HOME_READING.resources),
    block.withMedia ? getLatestMediaItems(locale, 1) : Promise.resolve([]),
  ]);
  const item = media[0] ?? null;
  if (posts.length === 0 && resources.length === 0 && !item) return null;
  return <ReadingSection {...block.section.content} posts={posts} resources={resources} media={item} />;
}

async function Media({ block, locale }: { block: Extract<HomeBlock, { key: "media" }>; locale: Locale }) {
  const [item] = await getLatestMediaItems(locale, 1);
  return item ? <MediaSection {...block.section.content} item={item} /> : null;
}

async function Contact({ block, locale }: { block: Extract<HomeBlock, { key: "contact" }>; locale: Locale }) {
  const settings = await getSiteSettings();
  return <ContactSection {...block.section.content} settings={settings} locale={locale} />;
}

/** One block of the home page after the hero and the letter (see `composeHome`). */
export function HomeBlockView({ block, locale }: { block: Exclude<HomeBlock, { key: "hero" | "letter" }>; locale: Locale }) {
  switch (block.key) {
    case "audiences":
      return <AudiencesSection content={block.section.content} band="plain" />;
    case "newsletter":
      return <NewsletterSection {...block.section.content} />;
    default:
      return (
        <Frame block={block} locale={locale}>
          {dataBlock(block, locale)}
        </Frame>
      );
  }
}

function dataBlock(block: DataBlock, locale: Locale): ReactNode {
  switch (block.key) {
    case "stats":
      return <Stats block={block} locale={locale} />;
    case "expertise":
      return <Expertise block={block} locale={locale} />;
    case "services":
      return <Services block={block} locale={locale} />;
    case "projects":
      return <Projects block={block} locale={locale} />;
    case "partners":
      return <Partners block={block} locale={locale} />;
    case "testimonials":
      return <Testimonials block={block} locale={locale} />;
    case "reading":
      return <Reading block={block} locale={locale} />;
    case "media":
      return <Media block={block} locale={locale} />;
    case "contact":
      return <Contact block={block} locale={locale} />;
  }
}
