// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MediaItem } from "@/lib/content/types";
import ar from "@/messages/ar/Media.json";
import en from "@/messages/en/Media.json";

vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
  useLocale: () => "en",
  useFormatter: () => ({ number: (value: number) => String(value) }),
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock("next/image", () => ({
  // A plain <img> stands in for next/image in tests.
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("@/i18n/navigation", () => ({
  // Serializes an object href the way next-intl's Link builds it.
  Link: ({
    href,
    children,
    "aria-current": current,
  }: {
    href: string | { pathname: string; query?: Record<string, string> };
    children: ReactNode;
    "aria-current"?: "true" | "page";
  }) => {
    const query = typeof href === "string" ? "" : new URLSearchParams(href.query).toString();
    const path = typeof href === "string" ? href : `${href.pathname}${query ? `?${query}` : ""}`;
    return (
      <a href={path} aria-current={current}>
        {children}
      </a>
    );
  },
}));

const { MediaList } = await import("./media-list");
const { embedUrl, listingQuery, mediaPage, parseMediaQuery, webUrl } = await import("./query");

afterEach(cleanup);

function item(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: "m1",
    category: "media",
    title: "An interview",
    outlet: "Example TV",
    date: "2026-03-01",
    imageUrl: null,
    url: null,
    videoUrl: null,
    ...overrides,
  };
}

const YT = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";

describe("messages", () => {
  it("has the same keys in both languages", () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });
});

describe("parseMediaQuery", () => {
  it("reads a known category and drops anything else", () => {
    expect(parseMediaQuery({ category: "events" })).toEqual({ category: "events", page: 1 });
    expect(parseMediaQuery({ category: ["conferences", "media"] })).toEqual({ category: "conferences", page: 1 });
    expect(parseMediaQuery({ category: "podcasts" })).toEqual({ category: null, page: 1 });
    expect(parseMediaQuery({})).toEqual({ category: null, page: 1 });
  });

  it("reads a whole page number from 2, otherwise page 1", () => {
    expect(parseMediaQuery({ page: "3" })).toEqual({ category: null, page: 3 });
    for (const page of ["0", "-1", "2.5", "x", ""]) expect(parseMediaQuery({ page }).page).toBe(1);
  });

  it("gives the tabs the set category only, never the page", () => {
    expect(listingQuery({ category: "events", page: 2 })).toEqual({ category: "events" });
    expect(listingQuery({ category: null, page: 1 })).toEqual({});
  });
});

describe("embedUrl", () => {
  it("frames YouTube through youtube-nocookie.com, from the id alone", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1&t=10s",
      "https://youtube.com/watch?v=dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?si=abc",
      "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    ]) {
      expect(embedUrl(url), url).toBe(YT);
    }
  });

  it("frames the Vimeo player", () => {
    expect(embedUrl("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789?dnt=1");
    expect(embedUrl("https://player.vimeo.com/video/123456789")).toBe(
      "https://player.vimeo.com/video/123456789?dnt=1",
    );
  });

  it("keeps an unlisted Vimeo video, which needs its hash, as a link", () => {
    expect(embedUrl("https://player.vimeo.com/video/123456789?h=abc")).toBeNull();
    expect(embedUrl("https://vimeo.com/123456789?h=abc")).toBeNull();
    expect(embedUrl("https://vimeo.com/123456789/abcdef1234")).toBeNull();
  });

  it("frames nothing else", () => {
    for (const url of [
      null,
      "",
      "not a url",
      "https://example.com/video.mp4",
      "https://www.dailymotion.com/video/x1",
      "https://www.facebook.com/watch/?v=1",
      // A look-alike host, a host in the path, and a host in the user part.
      "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
      "https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com@evil.example/watch?v=dQw4w9WgXcQ",
      // Not an id.
      "https://www.youtube.com/watch?v=short",
      'https://www.youtube.com/watch?v=dQw4w9WgXc"><script>',
      "https://www.youtube.com/channel/dQw4w9WgXcQ",
      "https://vimeo.com/channels/staff",
      "https://vimeo.com/123abc",
      // Not https.
      "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "javascript:alert(1)//youtube.com/watch?v=dQw4w9WgXcQ",
    ]) {
      expect(embedUrl(url), String(url)).toBeNull();
    }
  });
});

describe("webUrl", () => {
  it("keeps web links and refuses every other scheme", () => {
    expect(webUrl(" https://example.com/a ")).toBe("https://example.com/a");
    expect(webUrl("http://example.com")).toBe("http://example.com/");
    for (const url of [null, "", "example.com", "javascript:alert(1)", "data:text/html,x", "mailto:a@example.com"]) {
      expect(webUrl(url), String(url)).toBeNull();
    }
  });
});

describe("MediaList", () => {
  it("features a YouTube item, and loads its player only on a click", () => {
    const { container } = render(
      <MediaList
        items={[item({ videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", imageUrl: "https://cdn.example/still.jpg" })]}
        query={{ category: null, page: 1 }}
      />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText("playerNote")).toBeTruthy();
    expect(within(screen.getByRole("article")).queryByRole("link")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: 'play:{"title":"An interview"}' }));
    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe(`${YT}?autoplay=1`);
    expect(frame?.getAttribute("title")).toBe('videoTitle:{"title":"An interview"}');
    expect(frame?.hasAttribute("sandbox")).toBe(true);
  });

  it("features only one video, on page 1 with no category; other videos are links", () => {
    const items = [
      item({ id: "a", title: "First", videoUrl: "https://youtu.be/dQw4w9WgXcQ", imageUrl: "https://cdn.example/a.jpg" }),
      item({ id: "b", title: "Second", videoUrl: "https://vimeo.com/123456789", imageUrl: "https://cdn.example/b.jpg" }),
    ];
    render(<MediaList items={items} query={{ category: null, page: 1 }} />);
    expect(screen.getAllByRole("button", { name: /^play:/ })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /^watchLabel:\{"title":"Second"\}/ }).getAttribute("href")).toBe(
      "https://vimeo.com/123456789",
    );
    cleanup();

    const { container: inCategory } = render(<MediaList items={items} query={{ category: "media", page: 1 }} />);
    expect(screen.queryByRole("button", { name: /^play:/ })).toBeNull();
    expect(inCategory.querySelector("iframe")).toBeNull();
  });

  it("shows a video from any other host as a link, never a frame", () => {
    const { container } = render(
      <MediaList items={[item({ videoUrl: "https://example.com/talk.mp4" })]} query={{ category: null, page: 1 }} />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    const link = screen.getByRole("link", { name: /^watchLabel/ });
    expect(link.getAttribute("href")).toBe("https://example.com/talk.mp4");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("links the item's page beside an embedded video, and shows the image without one", () => {
    render(
      <MediaList
        items={[
          item({ videoUrl: "https://vimeo.com/123456789", url: "https://outlet.example/story" }),
          item({ id: "m2", title: "A conference", category: "conferences", imageUrl: "https://cdn.example/i.jpg", url: "https://conf.example" }),
        ]}
        query={{ category: null, page: 1 }}
      />,
    );
    const [first, second] = screen.getAllByRole("article");
    expect(within(first as HTMLElement).getByRole("link", { name: /^openLabel/ }).getAttribute("href")).toBe(
      "https://outlet.example/story",
    );
    // A press-log row: no image, and no frame without a video.
    expect((second as HTMLElement).querySelector("img")).toBeNull();
    expect((second as HTMLElement).querySelector("iframe")).toBeNull();
  });

  it("never links a URL that isn't a web address", () => {
    const { container } = render(
      <MediaList
        items={[item({ url: "javascript:alert(1)", videoUrl: "javascript:alert(2)" })]}
        query={{ category: null, page: 1 }}
      />,
    );
    expect(within(screen.getByRole("article")).queryByRole("link")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("has a tab per used category with its count, All with the total, the open one marked", () => {
    render(
      <MediaList
        items={[item(), item({ id: "m2", category: "events" }), item({ id: "m3", category: "events" })]}
        query={{ category: "events", page: 1 }}
      />,
    );
    const tabs = within(screen.getByRole("navigation", { name: "categoriesLabel" }));
    expect(tabs.getAllByRole("link").map((link) => link.textContent)).toEqual(["filterAll 3", "mediaCategory.media 1", "mediaCategory.events 2"]);
    expect(tabs.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/media",
      "/media?category=media",
      "/media?category=events",
    ]);
    const events = tabs.getByText("mediaCategory.events").closest("a");
    expect(events?.getAttribute("aria-current")).toBe("page");
    expect(tabs.getByText("filterAll").closest("a")?.getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe('resultsCount:{"count":2}');
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("tells an empty section from an empty category", () => {
    const { rerender } = render(<MediaList items={[]} query={{ category: null, page: 1 }} />);
    expect(screen.getByRole("heading", { name: "emptyState.title" })).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();

    rerender(<MediaList items={[item()]} query={{ category: "events", page: 1 }} />);
    expect(screen.getByRole("heading", { name: "noResultsState.title" })).toBeTruthy();
    // The chosen, empty category keeps its tab and stays marked; "All" isn't.
    const tabs = within(screen.getByRole("navigation", { name: "categoriesLabel" }));
    expect(tabs.getByText("mediaCategory.events").closest("a")?.getAttribute("aria-current")).toBe("page");
    expect(tabs.getByText("filterAll").closest("a")?.getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "noResultsState.action" }).getAttribute("href")).toBe("/media");
  });

  it("pages the log six at a time", () => {
    const items = Array.from({ length: 8 }, (_, index) => item({ id: `i${index}`, title: `Item ${index}` }));
    render(<MediaList items={items} query={{ category: null, page: 2 }} />);
    expect(screen.getAllByRole("article").map((article) => within(article).getByRole("heading").textContent)).toEqual([
      "Item 6",
      "Item 7",
    ]);
    expect(screen.getByRole("navigation", { name: "paginationLabel" })).toBeTruthy();
  });
});

describe("mediaPage", () => {
  const video = (id: string) => ({ id, videoUrl: "https://youtu.be/dQw4w9WgXcQ", imageUrl: "https://cdn.example/s.jpg" });
  const plain = (id: string) => ({ id, videoUrl: null, imageUrl: null });

  it("features only a video with a still to show", () => {
    const noStill = { id: "n", videoUrl: "https://youtu.be/dQw4w9WgXcQ", imageUrl: null };
    expect(mediaPage([noStill, plain("a")], { category: null, page: 1 }).featured).toBeNull();
    expect(mediaPage([noStill, video("v")], { category: null, page: 1 }).featured?.id).toBe("v");
  });

  it("leads page 1 with the first playable video, then keeps the order", () => {
    const items = [plain("a"), video("b"), plain("c")];
    const result = mediaPage(items, { category: null, page: 1 });
    expect(result.featured?.id).toBe("b");
    expect(result.rows.map((row) => row.id)).toEqual(["a", "c"]);
  });

  it("features nothing in a category or past page 1, and clamps the page", () => {
    const items = Array.from({ length: 7 }, (_, index) => (index === 0 ? video("v") : plain(`p${index}`)));
    expect(mediaPage(items, { category: "media", page: 1 }).featured).toBeNull();
    const last = mediaPage(items, { category: null, page: 9 });
    expect(last).toMatchObject({ featured: null, page: 2, totalPages: 2 });
    expect(last.rows.map((row) => row.id)).toEqual(["p6"]);
  });
});
