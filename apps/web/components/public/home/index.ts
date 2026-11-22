/**
 * The home page (§6.2). Each section takes its data as props, so the
 * dashboard's preview can render them with unsaved content; `HomeBlockView`
 * reads a section's rows for the public page.
 */
export { AudiencesSection } from "./audiences";
export { HomeBlockView } from "./blocks";
export { composeHome, type HomeBlock } from "./compose";
export { ContactSection } from "./contact";
export { ExpertiseSection, HOME_EXPERTISE_COUNT } from "./expertise";
export { HeroSection } from "./hero";
export { LetterSection } from "./letter";
export { FeaturedMedia, MediaSection } from "./media";
export { NewsletterSection } from "./newsletter";
export { PartnersSection } from "./partners";
export { HOME_PROJECT_COUNT, ProjectsSection, selectHomeProjects } from "./projects";
export { HOME_LATEST_COUNT, HOME_READING, ReadingSection } from "./reading";
export type { SectionBand } from "./section";
export { ServicesSection } from "./services";
export { StatsSection } from "./stats";
export { TestimonialsSection } from "./testimonials";
