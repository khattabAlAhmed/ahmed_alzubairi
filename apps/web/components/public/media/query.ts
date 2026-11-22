import { mediaCategorySchema, type MediaCategory } from "@repo/shared";
import type { ListingQuery } from "../listing";

/** The media list's filter (§6.10), kept in the URL. */
export const MEDIA_PATH = "/media";
export const CATEGORY_PARAM = "category";

export const PAGE_PARAM = "page";

/** Records on one page: the featured video and five rows (the Media mockup). */
export const MEDIA_PER_PAGE = 6;

export type MediaListQuery = { category: MediaCategory | null; page: number };

type SearchParams = Record<string, string | string[] | undefined>;

/** Reads the filter and the page. A category that doesn't exist means all categories; a bad page, page 1. */
export function parseMediaQuery(params: SearchParams): MediaListQuery {
  const value = params[CATEGORY_PARAM];
  const category = mediaCategorySchema.safeParse((Array.isArray(value) ? value[0] : value)?.trim());
  const rawPage = params[PAGE_PARAM];
  const page = Number((Array.isArray(rawPage) ? rawPage[0] : rawPage)?.trim());
  return { category: category.success ? category.data : null, page: Number.isSafeInteger(page) && page > 1 ? page : 1 };
}

/** The query as the listing components take it: the category, never the page. */
export function listingQuery(query: MediaListQuery): ListingQuery {
  return query.category ? { [CATEGORY_PARAM]: query.category } : {};
}

/** A stored URL as a web link, or null: only `http` and `https` are ever linked. */
export function webUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"];
const YOUTUBE_ID = /^[\w-]{11}$/;
const VIMEO_ID = /^\d{1,12}$/;

function youtubeId(url: URL): string | null {
  const [head, id] = url.pathname.split("/").filter(Boolean);
  if (url.hostname === "youtu.be") return head ?? null;
  if (!YOUTUBE_HOSTS.includes(url.hostname)) return null;
  if (head === "watch") return url.searchParams.get("v");
  return head === "embed" || head === "shorts" || head === "live" ? (id ?? null) : null;
}

function vimeoId(url: URL): string | null {
  // An unlisted video plays only with its privacy hash (`?h=`, or a second path
  // part on vimeo.com). The frame is rebuilt from the id alone, so such a video
  // stays a link rather than a frame that can't play it.
  if (url.searchParams.has("h")) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.hostname === "player.vimeo.com") return parts[0] === "video" ? (parts[1] ?? null) : null;
  return (url.hostname === "vimeo.com" || url.hostname === "www.vimeo.com") && parts.length === 1
    ? (parts[0] ?? null)
    : null;
}

/**
 * The embed address for a video, or null when its host isn't allowed (§6.10).
 * Only YouTube (through youtube-nocookie.com) and the Vimeo player are ever
 * framed. The address is rebuilt from the video's id alone, so nothing else
 * from the stored URL reaches the frame. Anything else, including an unlisted
 * Vimeo video that needs its hash, shows as a link.
 */
export function embedUrl(value: string | null): string | null {
  const href = webUrl(value);
  if (!href) return null;
  const url = new URL(href);
  if (url.protocol !== "https:") return null;
  const youtube = youtubeId(url);
  if (youtube && YOUTUBE_ID.test(youtube)) return `https://www.youtube-nocookie.com/embed/${youtube}`;
  const vimeo = vimeoId(url);
  if (vimeo && VIMEO_ID.test(vimeo)) return `https://player.vimeo.com/video/${vimeo}?dnt=1`;
  return null;
}

/**
 * The press log in page order. With no category, the first item with a video
 * that can play here and a still to show before it plays leads page 1 as the
 * featured record (a video without a still stays a row with its link); the
 * rest stay in date order. Pages hold `MEDIA_PER_PAGE` items, and the page is clamped to the
 * pages there are.
 */
export function mediaPage<T extends { videoUrl: string | null; imageUrl: string | null }>(
  items: T[],
  query: MediaListQuery,
): { featured: T | null; rows: T[]; page: number; totalPages: number } {
  const lead = query.category === null ? (items.find((item) => item.imageUrl !== null && embedUrl(item.videoUrl) !== null) ?? null) : null;
  const ordered = lead ? [lead, ...items.filter((item) => item !== lead)] : items;
  const totalPages = Math.max(1, Math.ceil(ordered.length / MEDIA_PER_PAGE));
  const page = Math.min(Math.max(1, query.page), totalPages);
  const shown = ordered.slice((page - 1) * MEDIA_PER_PAGE, page * MEDIA_PER_PAGE);
  const featured = page === 1 ? lead : null;
  return { featured, rows: shown.filter((item) => item !== featured), page, totalPages };
}
