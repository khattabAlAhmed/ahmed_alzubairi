import type { HomeSection } from "@/lib/content";

type Section<Key extends HomeSection["key"]> = Extract<HomeSection, { key: Key }>;

/**
 * One block of the home page, in the dashboard's order (§6.2). Most blocks
 * are one section. Two pairs read together, as in the approved mockup:
 *
 * - The quick stats are the ledger inside the hero (the dossier, plan.md
 *   Phase 8). They stand as a band of their own only when the hero is hidden.
 * - The latest media item is the featured video of «أتحدث وأكتب» (`latest`).
 *   It stands on its own only when `latest` is hidden.
 *
 * Hiding either partner in the dashboard still hides its part, and a hidden
 * section never leaves a gap: it simply isn't in the list.
 */
export type HomeBlock =
  | { key: "hero"; section: Section<"hero">; withStats: boolean }
  | { key: "letter"; section: Section<"letter"> }
  | { key: "stats"; section: Section<"stats"> }
  | { key: "reading"; section: Section<"latest">; withMedia: boolean }
  | { key: "media"; section: Section<"media"> }
  | PlainBlock;

/** A section that is its own block, as it is. */
type Plain = Exclude<HomeSection["key"], "hero" | "letter" | "stats" | "latest" | "media">;
type PlainBlock = { [Key in Plain]: { key: Key; section: Section<Key> } }[Plain];

/** The home page's blocks, from its visible, published sections in order. */
export function composeHome(sections: readonly HomeSection[]): HomeBlock[] {
  const has = (key: HomeSection["key"]) => sections.some((section) => section.key === key);
  const hero = has("hero");
  const latest = has("latest");

  return sections.flatMap((section): HomeBlock[] => {
    switch (section.key) {
      case "hero":
        return [{ key: "hero", section, withStats: has("stats") }];
      case "letter":
        return [{ key: "letter", section }];
      case "stats":
        return hero ? [] : [{ key: "stats", section }];
      case "latest":
        return [{ key: "reading", section, withMedia: has("media") }];
      case "media":
        return latest ? [] : [{ key: "media", section }];
      default:
        return [{ key: section.key, section } as PlainBlock];
    }
  });
}
