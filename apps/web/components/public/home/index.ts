/**
 * The home page sections (§6.2). Each takes its data as props, so the
 * dashboard's preview can render them with unsaved content.
 */
export { AudiencesSection } from "./audiences";
export { ContactSection } from "./contact";
export { ExpertiseSection, HOME_EXPERTISE_COUNT } from "./expertise";
export { HeroSection } from "./hero";
export { HOME_LATEST_COUNT, LatestSection } from "./latest";
export { MediaSection } from "./media";
export { PartnersSection } from "./partners";
export { HOME_PROJECT_COUNT, ProjectsSection, selectHomeProjects } from "./projects";
export type { SectionBand } from "./section";
export { ServicesSection } from "./services";
export { StatsSection } from "./stats";
export { TestimonialsSection } from "./testimonials";
