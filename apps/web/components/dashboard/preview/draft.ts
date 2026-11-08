import {
  isAvailableIn,
  LOCALES,
  orgTypeSchema,
  type ContentType,
  type Locale,
  type TiptapDoc,
} from "@repo/shared";
import type {
  ExpertiseArea,
  ExpertiseAreaDetail,
  Partner,
  ProjectDetail,
  ProjectImage,
  ServiceDetail,
  Testimonial,
} from "@/lib/content/types";
import type { RefOption } from "../content/field-text";
import type { Row } from "../content/form-values";
import { mediaUrl } from "../content/upload";

/**
 * Turns the editor's draft (the API shape: camelCase, `titleAr`/`titleEn`)
 * into the props the public components take, the way `lib/content` builds
 * them from published rows. Pure, and only in the browser: nothing is read
 * or written. The status is ignored, so a draft shows as it will once
 * published.
 */

/** What the preview can show for a draft in one language. */
export type PreviewModel =
  | { kind: "service"; service: ServiceDetail; area: ExpertiseArea | null }
  | { kind: "project"; project: ProjectDetail; area: ExpertiseArea | null }
  | { kind: "expertise"; area: ExpertiseAreaDetail }
  | { kind: "clients"; partners: Partner[]; testimonials: Testimonial[] }
  /** The draft isn't complete in this language, so the public site won't show it there. */
  | { kind: "incomplete" }
  /** No public component for this type yet. */
  | { kind: "unsupported" };

/** The types with a preview. */
export const PREVIEW_TYPES = [
  "services",
  "projects",
  "expertise_areas",
  "testimonials",
  "partners",
] as const satisfies readonly ContentType[];

export type PreviewType = (typeof PREVIEW_TYPES)[number];

export function hasPreview(type: ContentType): type is PreviewType {
  return (PREVIEW_TYPES as readonly string[]).includes(type);
}

export type PreviewContext = {
  refOptions: Partial<Record<ContentType, RefOption[]>>;
  mediaBase: string;
};

const SUFFIX: Record<Locale, string> = { ar: "Ar", en: "En" };

/** The locale's text, trimmed, or null when it's blank. */
export function draftText(draft: Row, field: string, locale: Locale): string | null {
  const value = draft[`${field}${SUFFIX[locale]}`];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function plain(draft: Row, name: string): string | null {
  const value = draft[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function richText(draft: Row, field: string, locale: Locale): TiptapDoc | null {
  const value = draft[`${field}${SUFFIX[locale]}`];
  return typeof value === "object" && value !== null && (value as { type?: unknown }).type === "doc"
    ? (value as TiptapDoc)
    : null;
}

/** The languages the draft would be public in once published. */
export function draftLocales(type: ContentType, draft: Row): Locale[] {
  return LOCALES.filter((locale) => isAvailableIn(type, draft, locale));
}

/**
 * The linked expertise area, named from the editor's options. Only its title
 * shows on the public pages; the slug is left empty since links are inert in
 * the preview.
 */
function linkedArea(draft: Row, ctx: PreviewContext): ExpertiseArea | null {
  const id = plain(draft, "expertiseId");
  const option = id ? ctx.refOptions.expertise_areas?.find((item) => item.id === id) : undefined;
  return option ? { id: option.id, slug: "", title: option.title, summary: "" } : null;
}

function draftImages(draft: Row, locale: Locale, base: string): ProjectImage[] {
  const images = Array.isArray(draft.images) ? (draft.images as Row[]) : [];
  return images.flatMap((image) =>
    typeof image.key === "string" && image.key !== ""
      ? [{ url: mediaUrl(base, image.key), alt: draftText(image, "alt", locale) }]
      : [],
  );
}

/** §6.11: what keeps a testimonial or logo off the public site, besides being a draft. */
export function consentBlockers(draft: Row): ("no_consent" | "not_approved")[] {
  const blockers: ("no_consent" | "not_approved")[] = [];
  if (draft.consentConfirmed !== true) blockers.push("no_consent");
  if (draft.adminApproved !== true) blockers.push("not_approved");
  return blockers;
}

export function previewModel(
  type: ContentType,
  draft: Row,
  locale: Locale,
  ctx: PreviewContext,
): PreviewModel {
  if (!hasPreview(type)) return { kind: "unsupported" };
  if (!isAvailableIn(type, draft, locale)) return { kind: "incomplete" };
  const id = String(draft.id ?? "preview");
  const availableIn = draftLocales(type, draft);

  switch (type) {
    case "services": {
      const title = draftText(draft, "title", locale);
      const summary = draftText(draft, "summary", locale);
      if (!title || !summary) return { kind: "incomplete" };
      return {
        kind: "service",
        area: linkedArea(draft, ctx),
        service: {
          id,
          slug: plain(draft, "slug") ?? "",
          expertiseId: plain(draft, "expertiseId"),
          title,
          summary,
          isFeatured: draft.isFeatured === true,
          audience: draftText(draft, "audience", locale),
          deliverables: draftText(draft, "deliverables", locale),
          stages: draftText(draft, "stages", locale),
          availableIn,
        },
      };
    }
    case "projects": {
      const title = draftText(draft, "title", locale);
      const goal = draftText(draft, "goal", locale);
      if (!title || !goal) return { kind: "incomplete" };
      const orgType = orgTypeSchema.safeParse(draft.orgType);
      const images = draftImages(draft, locale, ctx.mediaBase);
      return {
        kind: "project",
        area: linkedArea(draft, ctx),
        project: {
          id,
          slug: plain(draft, "slug") ?? "",
          expertiseId: plain(draft, "expertiseId"),
          orgType: orgType.success ? orgType.data : null,
          title,
          // §6.6: a hidden name shows the general label, never the name.
          organization:
            draft.hideOrgName === true
              ? draftText(draft, "orgLabel", locale)
              : draftText(draft, "orgName", locale),
          goal,
          keyResult: draftText(draft, "keyResult", locale),
          isFeatured: draft.isFeatured === true,
          coverUrl: images[0]?.url ?? null,
          role: draftText(draft, "role", locale),
          duration: draftText(draft, "duration", locale),
          activities: draftText(draft, "activities", locale),
          results: draftText(draft, "results", locale),
          images,
          serviceIds: Array.isArray(draft.serviceIds) ? (draft.serviceIds as string[]) : [],
          availableIn,
        },
      };
    }
    case "expertise_areas": {
      const title = draftText(draft, "title", locale);
      const summary = draftText(draft, "summary", locale);
      if (!title || !summary) return { kind: "incomplete" };
      return {
        kind: "expertise",
        area: {
          id,
          slug: plain(draft, "slug") ?? "",
          title,
          summary,
          body: richText(draft, "body", locale),
          availableIn,
        },
      };
    }
    case "testimonials": {
      const quote = draftText(draft, "quote", locale);
      const author = draftText(draft, "author", locale);
      if (!quote || !author) return { kind: "incomplete" };
      const partnerId = plain(draft, "partnerId");
      const partner = partnerId
        ? ctx.refOptions.partners?.find((item) => item.id === partnerId)
        : undefined;
      return {
        kind: "clients",
        partners: [],
        testimonials: [{ id, quote, author, organization: partner?.title ?? null }],
      };
    }
    case "partners": {
      const name = draftText(draft, "name", locale);
      if (!name) return { kind: "incomplete" };
      const logo = plain(draft, "logoKey");
      return {
        kind: "clients",
        partners: [{ id, name, logoUrl: logo ? mediaUrl(ctx.mediaBase, logo) : null }],
        testimonials: [],
      };
    }
  }
}
