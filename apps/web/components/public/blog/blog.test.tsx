// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExpertiseArea } from "@/lib/content";
import type { PostDetail, PostListItem, PostPage } from "@/lib/content/posts";
import ar from "@/messages/ar/Blog.json";
import en from "@/messages/en/Blog.json";

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
  getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
  // Serializes an object href the way next-intl's Link builds it.
  Link: ({
    href,
    children,
    className,
    "aria-current": current,
    "aria-label": label,
  }: {
    href: string | { pathname: string; query?: Record<string, string> };
    children: ReactNode;
    className?: string;
    "aria-current"?: "true" | "page";
    "aria-label"?: string;
  }) => {
    const query = typeof href === "string" ? "" : new URLSearchParams(href.query).toString();
    const path = typeof href === "string" ? href : `${href.pathname}${query ? `?${query}` : ""}`;
    return (
      <a href={path} className={className} aria-current={current} aria-label={label}>
        {children}
      </a>
    );
  },
}));
vi.mock("@/components/consultation-button", () => ({
  ConsultationButton: () => <button type="button">consult</button>,
}));
vi.mock("../listing/copy-link-button", () => ({
  CopyLinkButton: ({ url }: { url: string }) => <button data-url={url}>copy</button>,
}));

const { ArticlePage } = await import("./article-page");
const { BlogList } = await import("./blog-list");
const { articlePath, canonicalUrl, listingQuery, MAX_SEARCH_LENGTH, parseBlogQuery } = await import("./query");

afterEach(cleanup);

const areas: ExpertiseArea[] = [
  { id: "a1", slug: "governance", title: "Governance", summary: "" },
  { id: "a2", slug: "relief", title: "Relief", summary: "" },
];

function post(overrides: Partial<PostListItem> = {}): PostListItem {
  return {
    id: "p1",
    slug: "first-post",
    title: "First post",
    excerpt: "An excerpt",
    coverUrl: null,
    readingMinutes: 4,
    publishedAt: "2026-03-01T00:00:00Z",
    expertiseId: "a1",
    expertise: { slug: "governance", title: "Governance" },
    ...overrides,
  };
}

function page(posts: PostListItem[], overrides: Partial<PostPage> = {}): PostPage {
  return { posts, total: posts.length, page: 1, pageSize: 9, pageCount: 1, ...overrides };
}

const NO_QUERY = { q: null, category: null, page: 1 };

describe("parseBlogQuery", () => {
  it("reads the search, the category and the page", () => {
    expect(parseBlogQuery({ q: " boards ", category: "governance", page: "3" })).toEqual({
      q: "boards",
      category: "governance",
      page: 3,
    });
  });

  it("treats blank values as none, and takes the first of a repeated param", () => {
    expect(parseBlogQuery({ q: "  ", category: "" })).toEqual(NO_QUERY);
    expect(parseBlogQuery({ q: ["one", "two"] }).q).toBe("one");
  });

  it("falls back to page 1 for anything that isn't a positive whole number", () => {
    for (const value of ["0", "-2", "1.5", "abc", "1e99", ""]) {
      expect(parseBlogQuery({ page: value }).page).toBe(1);
    }
  });

  it("cuts a very long search", () => {
    expect(parseBlogQuery({ q: "x".repeat(500) }).q).toHaveLength(MAX_SEARCH_LENGTH);
  });

  it("gives the listing components the query without the page", () => {
    expect(listingQuery({ q: "boards", category: null, page: 4 })).toEqual({ q: "boards" });
    expect(listingQuery(NO_QUERY)).toEqual({});
  });
});

describe("articlePath and canonicalUrl", () => {
  it("percent-encodes an Arabic slug", () => {
    expect(articlePath("first-post")).toBe("/blog/first-post");
    expect(articlePath("مقال")).toBe("/blog/%D9%85%D9%82%D8%A7%D9%84");
  });

  it("builds the full URL from the site address, ignoring its path", () => {
    expect(canonicalUrl("https://site.example/", "ar", "/blog/x")).toBe("https://site.example/ar/blog/x");
    expect(canonicalUrl("https://site.example/app?x=1", "en", "/blog/x")).toBe("https://site.example/en/blog/x");
  });

  it("returns null without a web address", () => {
    expect(canonicalUrl(undefined, "en", "/blog/x")).toBeNull();
    expect(canonicalUrl("not a url", "en", "/blog/x")).toBeNull();
    expect(canonicalUrl("javascript:alert(1)", "en", "/blog/x")).toBeNull();
  });
});

describe("BlogList", () => {
  it("shows a card per article, linking to its slug", () => {
    render(
      <BlogList
        result={page([post(), post({ id: "p2", slug: "مقال", title: "Second post", expertise: null })])}
        areas={areas}
        query={NO_QUERY}
      />,
    );
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByRole("link", { name: "First post" }).getAttribute("href")).toBe("/blog/first-post");
    expect(within(cards[0]!).getByText("Governance")).toBeTruthy();
    expect(within(cards[1]!).getByRole("link", { name: "Second post" }).getAttribute("href")).toBe(
      "/blog/%D9%85%D9%82%D8%A7%D9%84",
    );
    expect(screen.getByRole("status").textContent).toBe('resultsCount:{"count":2}');
  });

  it("offers a chip per expertise area that keeps the search and drops the page", () => {
    render(<BlogList result={page([post()])} areas={areas} query={{ q: "boards", category: "relief", page: 2 }} />);
    const chips = within(screen.getByRole("navigation", { name: "categoriesLabel" }));
    expect(chips.getByRole("link", { name: "Governance" }).getAttribute("href")).toBe(
      "/blog?q=boards&category=governance",
    );
    expect(chips.getByRole("link", { name: "Relief" }).getAttribute("aria-current")).toBe("true");
    expect(chips.getByRole("link", { name: "filterAll" }).getAttribute("href")).toBe("/blog?q=boards");
  });

  it("keeps the search in the field and the category as a hidden field", () => {
    const { container } = render(
      <BlogList result={page([post()])} areas={areas} query={{ q: "boards", category: "relief", page: 2 }} />,
    );
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("boards");
    expect(container.querySelector('input[type="hidden"][name="category"]')?.getAttribute("value")).toBe("relief");
    expect(container.querySelector('input[name="page"]')).toBeNull();
    expect(screen.getByRole("status").textContent).toBe('searchResults:{"count":1,"q":"boards"}');
  });

  it("paginates, keeping the search and the category", () => {
    render(
      <BlogList
        result={page([post()], { total: 20, page: 2, pageCount: 3 })}
        areas={areas}
        query={{ q: "boards", category: "relief", page: 2 }}
      />,
    );
    const pages = within(screen.getByRole("navigation", { name: "paginationLabel" }));
    expect(pages.getByRole("link", { name: 'page:{"page":"3"}' }).getAttribute("href")).toBe(
      "/blog?q=boards&category=relief&page=3",
    );
    expect(pages.getByRole("link", { name: 'page:{"page":"1"}' }).getAttribute("href")).toBe(
      "/blog?q=boards&category=relief",
    );
  });

  it("says so when nothing is published, with no link to clear", () => {
    render(<BlogList result={page([])} areas={[]} query={NO_QUERY} />);
    expect(screen.getByRole("heading", { name: "emptyState.title" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "noSearchResults.action" })).toBeNull();
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "categoriesLabel" })).toBeNull();
  });

  it("says it hasn't written about a search yet, with the way to all writing", () => {
    render(<BlogList result={page([])} areas={areas} query={{ q: "zzz", category: null, page: 1 }} />);
    expect(screen.getByRole("heading", { name: 'noSearchResults.title:{"q":"zzz"}' })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain('searchResults:{"count":0,"q":"zzz"}');
    expect(screen.getByRole("link", { name: "noSearchResults.action" }).getAttribute("href")).toBe("/blog");
  });

  it("tells an empty area apart from a search with no results", () => {
    render(<BlogList result={page([])} areas={areas} query={{ q: null, category: "governance", page: 1 }} />);
    expect(screen.getByRole("heading", { name: "noAreaResults.title" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "noAreaResults.action" }).getAttribute("href")).toBe("/blog");
  });
});

describe("ArticlePage", () => {
  const detail = (overrides: Partial<PostDetail> = {}): PostDetail => ({
    ...post(),
    body: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "<script>alert(1)</script> body text" }] }],
    },
    availableIn: ["en"],
    slugs: { en: "first-post" },
    ...overrides,
  });
  const SHARE = "https://site.example/en/blog/first-post";

  it("shows the title, date, reading time and the body as text", () => {
    const { container } = render(<ArticlePage post={detail()} related={[]} shareUrl={SHARE} />);
    expect(screen.getByRole("heading", { level: 1, name: "First post" })).toBeTruthy();
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe("2026-03-01T00:00:00Z");
    // Under the title and in the ledger.
    expect(screen.getAllByText('readingTime:{"minutes":4}').length).toBeGreaterThan(0);
    // Stored markup stays text (§9).
    expect(screen.getByText("<script>alert(1)</script> body text")).toBeTruthy();
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByRole("link", { name: "allArticles" }).getAttribute("href")).toBe("/blog");
    expect(screen.getByRole("button", { name: "consult" })).toBeTruthy();
  });

  it("shares the canonical URL, and hides sharing without one", () => {
    const { unmount } = render(<ArticlePage post={detail()} related={[]} shareUrl={SHARE} />);
    const share = within(screen.getByRole("complementary", { name: "shareLabel" }));
    expect(share.getByRole("button", { name: "copy" }).getAttribute("data-url")).toBe(SHARE);
    const links = share.getAllByRole("link").map((link) => link.getAttribute("href") ?? "");
    expect(links).toHaveLength(5);
    for (const href of links) expect(decodeURIComponent(href)).toContain(SHARE);
    unmount();

    render(<ArticlePage post={detail()} related={[]} shareUrl={null} />);
    expect(screen.queryByRole("group", { name: "shareLabel" })).toBeNull();
  });

  it("lists related articles under their own heading, as h3 cards", () => {
    render(
      <ArticlePage
        post={detail()}
        related={[post({ id: "r1", slug: "other", title: "Other post" })]}
        shareUrl={SHARE}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "related" })).toBeTruthy();
    const link = screen.getByRole("link", { name: "Other post" });
    expect(link.getAttribute("href")).toBe("/blog/other");
    expect(screen.getByRole("heading", { level: 3, name: "Other post" })).toBeTruthy();
  });

  it("has no related section when there are none, and shows the cover when there is one", () => {
    const { container } = render(
      <ArticlePage post={detail({ coverUrl: "https://cdn.example/c.jpg" })} related={[]} shareUrl={SHARE} />,
    );
    expect(screen.queryByRole("heading", { name: "related" })).toBeNull();
    expect(container.querySelector('img[src="https://cdn.example/c.jpg"]')?.getAttribute("alt")).toBe("");
  });
});

describe("Blog messages", () => {
  it("has the same keys in both languages", () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });
});
