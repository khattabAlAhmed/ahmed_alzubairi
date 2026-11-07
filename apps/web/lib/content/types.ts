import type {
  FaqCategory,
  HomeSectionContent,
  HomeSectionKey,
  Locale,
  MediaCategory,
  OrgType,
  PageKey,
  ResourceAccess,
  ResourceKind,
  SettingValue,
  SocialLink,
  TimelineKind,
  TiptapDoc,
} from "@repo/shared";

/**
 * What `lib/content` returns: plain objects in one language, ready for page
 * components as props. No draft row, no storage key, no `letter_path`, and no
 * hidden organization name ever appears here.
 */

/** A detail page's other languages, for the language switch (§6.1). */
export type Availability = { availableIn: Locale[] };

type HeroContent = Omit<HomeSectionContent<"hero">, "photoKey"> & {
  photoUrl: string | null;
};

type PublicSectionContent<Key extends HomeSectionKey> = Key extends "hero"
  ? HeroContent
  : HomeSectionContent<Key>;

export type HomeSection = {
  [Key in HomeSectionKey]: {
    key: Key;
    position: number;
    content: PublicSectionContent<Key>;
  };
}[HomeSectionKey];

export type HomeStat = { id: string; label: string; value: string };

export type Page = Availability & {
  key: PageKey;
  title: string;
  body: TiptapDoc;
};

export type TimelineItem = {
  id: string;
  kind: TimelineKind;
  title: string;
  description: string | null;
  period: string | null;
};

export type ExpertiseArea = {
  id: string;
  slug: string;
  title: string;
  summary: string;
};

export type ExpertiseAreaDetail = ExpertiseArea &
  Availability & { body: TiptapDoc | null };

export type Service = {
  id: string;
  slug: string;
  expertiseId: string | null;
  title: string;
  summary: string;
  isFeatured: boolean;
};

export type ServiceDetail = Service &
  Availability & {
    audience: string | null;
    deliverables: string | null;
    stages: string | null;
  };

export type ProjectImage = { url: string; alt: string | null };

export type Project = {
  id: string;
  slug: string;
  expertiseId: string | null;
  orgType: OrgType | null;
  title: string;
  /** The general label when the name is hidden (§6.6). */
  organization: string | null;
  goal: string;
  keyResult: string | null;
  isFeatured: boolean;
  coverUrl: string | null;
};

export type ProjectDetail = Project &
  Availability & {
    role: string | null;
    duration: string | null;
    activities: string | null;
    results: string | null;
    images: ProjectImage[];
    serviceIds: string[];
  };

export type Faq = {
  id: string;
  category: FaqCategory;
  serviceId: string | null;
  question: string;
  answer: string;
};

export type Partner = { id: string; name: string; logoUrl: string | null };

export type Testimonial = {
  id: string;
  quote: string;
  author: string;
  /** Only a public partner's name; null otherwise. */
  organization: string | null;
};

export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  readingMinutes: number | null;
  publishedAt: string | null;
};

export type Resource = {
  id: string;
  kind: ResourceKind;
  title: string;
  description: string | null;
  access: ResourceAccess;
};

export type MediaItem = {
  id: string;
  category: MediaCategory;
  title: string;
  outlet: string | null;
  date: string | null;
  imageUrl: string | null;
  url: string | null;
  videoUrl: string | null;
};

/** §6.12: titles and categories only. */
export type PublicDocument = { id: string; category: string; title: string };

/** Site settings for public pages. The CV is a URL, and only when it's visible. */
export type PublicSiteSettings = {
  contactEmail: SettingValue<"contact_email"> | null;
  whatsappNumber: SettingValue<"whatsapp_number"> | null;
  linkedinUrl: SettingValue<"linkedin_url"> | null;
  socialLinks: SocialLink[];
  cvUrl: string | null;
};
