import "server-only";
import { contentCacheTag, orgTypeSchema, type Locale } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { isPublicIn, publicLocales, publicMediaUrl, rowsOrThrow, text } from "./rows";
import type { Project, ProjectDetail, ProjectImage } from "./types";

// `org_name_*` is read so a visible name can be shown, and it never leaves this
// module for a project with `hide_org_name` (§6.6).
const COLUMNS =
  "id, slug, expertise_id, org_type, title_ar, title_en, org_name_ar, org_name_en, org_label_ar, org_label_en, hide_org_name, goal_ar, goal_en, role_ar, role_en, duration_ar, duration_en, activities_ar, activities_en, results_ar, results_en, key_result_ar, key_result_en, is_featured, status, created_at, project_images (path, alt_ar, alt_en, position), project_services (service_id)";

type ImageRow = { path: string; alt_ar: string | null; alt_en: string | null; position: number };

type ProjectRow = Record<string, unknown> & {
  id: string;
  slug: string;
  expertise_id: string | null;
  org_type: string | null;
  hide_org_name: boolean;
  is_featured: boolean;
  status: string;
  created_at: string;
  project_images: ImageRow[] | null;
  project_services: { service_id: string }[] | null;
};

/** The organization to show: the general label when the name is hidden. */
function projectOrganization(row: ProjectRow, locale: Locale): string | null {
  return row.hide_org_name ? text(row, "org_label", locale) : text(row, "org_name", locale);
}

function images(row: ProjectRow, locale: Locale): ProjectImage[] {
  return [...(row.project_images ?? [])]
    .sort((a, b) => a.position - b.position)
    .flatMap((image) => {
      const url = publicMediaUrl(image.path);
      return url ? [{ url, alt: text(image, "alt", locale) }] : [];
    });
}

/** The one rule for "public in this language", shared by every read below. */
function isListed(row: Record<string, unknown>, locale: Locale) {
  return isPublicIn("projects", row, locale);
}

function toProject(row: ProjectRow, locale: Locale): Project | null {
  const title = text(row, "title", locale);
  const goal = text(row, "goal", locale);
  if (!isListed(row, locale) || !title || !goal) return null;
  const orgType = orgTypeSchema.safeParse(row.org_type);
  return {
    id: row.id,
    slug: row.slug,
    expertiseId: row.expertise_id,
    orgType: orgType.success ? orgType.data : null,
    title,
    organization: projectOrganization(row, locale),
    goal,
    keyResult: text(row, "key_result", locale),
    isFeatured: row.is_featured,
    coverUrl: images(row, locale)[0]?.url ?? null,
  };
}

async function readProjects(filter?: { slug: string }) {
  let query = createServiceClient().from("projects").select(COLUMNS).eq("status", "published");
  if (filter) query = query.eq("slug", filter.slug);
  return rowsOrThrow<ProjectRow>(
    await query.order("created_at", { ascending: false }),
    "projects",
  );
}

/** Projects in this language, newest first (§6.6). */
export async function getProjects(locale: Locale): Promise<Project[]> {
  "use cache";
  cacheTag(contentCacheTag("projects"));
  cacheLife("hours");

  return (await readProjects()).flatMap((row) => toProject(row, locale) ?? []);
}

/** One project by slug, or null when it isn't published in this language. */
export async function getProject(slug: string, locale: Locale): Promise<ProjectDetail | null> {
  "use cache";
  cacheTag(contentCacheTag("projects"));
  cacheLife("hours");

  const row = (await readProjects({ slug })).find((item) => item.slug === slug);
  if (!row) return null;
  const project = toProject(row, locale);
  if (!project) return null;
  return {
    ...project,
    role: text(row, "role", locale),
    duration: text(row, "duration", locale),
    activities: text(row, "activities", locale),
    results: text(row, "results", locale),
    images: images(row, locale),
    serviceIds: (row.project_services ?? []).map((link) => link.service_id),
    availableIn: publicLocales("projects", row),
  };
}

/**
 * True when `getProject` would return this slug in this language. Not cached,
 * so the proxy can call it: a `"use cache"` function throws there. It reads
 * one row and only the columns the rule needs: no images, no organization name.
 */
export async function hasProject(slug: string, locale: Locale): Promise<boolean> {
  const rows = rowsOrThrow<Record<string, unknown>>(
    await createServiceClient()
      .from("projects")
      .select(`slug, status, title_${locale}, goal_${locale}, hide_org_name, org_label_${locale}`)
      .eq("slug", slug)
      .eq("status", "published")
      .limit(1),
    "projects",
  );
  return rows.some((row) => row.slug === slug && isListed(row, locale));
}
