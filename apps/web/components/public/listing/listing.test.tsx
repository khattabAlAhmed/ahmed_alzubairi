// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArticleCard } from "./article-card";
import { CopyLinkButton } from "./copy-link-button";
import { CourseCard, SeatsMeter } from "./course-card";
import { FilterChips } from "./filter-chips";
import { pageItems, seatsLeftRatio, SHARE_NETWORKS, shareHref, withParam } from "./links";
import { MediaCard, VideoEmbed } from "./media-card";
import { Pagination } from "./pagination";
import { ResourceCard } from "./resource-card";
import { SearchField } from "./search-field";
import { ShareButtons } from "./share-buttons";

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
    scroll: _scroll,
    ...rest
  }: {
    href: string | { pathname: string; query: Record<string, string> };
    children: ReactNode;
    scroll?: boolean;
  }) => {
    const query = typeof href === "string" ? "" : new URLSearchParams(href.query).toString();
    const path = typeof href === "string" ? href : `${href.pathname}${query ? `?${query}` : ""}`;
    return (
      <a href={path} {...rest}>
        {children}
      </a>
    );
  },
}));

afterEach(cleanup);

describe("withParam", () => {
  it("sets a param, keeps the others and drops the named ones", () => {
    expect(withParam({ q: "risk", page: "3", kind: "guide" }, "kind", "template", ["page"])).toEqual({
      q: "risk",
      kind: "template",
    });
  });

  it("removes the param on null and skips empty values", () => {
    expect(withParam({ q: "", kind: "guide", area: undefined }, "kind", null)).toEqual({});
  });
});

describe("pageItems", () => {
  const show = (current: number, total: number) =>
    pageItems(current, total).map((item) => (item.kind === "page" ? item.page : "…"));

  it("lists every page of a short list", () => {
    expect(show(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("puts gaps around the current page", () => {
    expect(show(5, 9)).toEqual([1, "…", 4, 5, 6, "…", 9]);
  });

  it("shows a single skipped page instead of a gap", () => {
    expect(show(3, 9)).toEqual([1, 2, 3, 4, "…", 9]);
    expect(show(7, 9)).toEqual([1, "…", 6, 7, 8, 9]);
  });

  it("clamps the current page and returns nothing for no pages", () => {
    expect(show(99, 3)).toEqual([1, 2, 3]);
    expect(show(1, 0)).toEqual([]);
  });
});

describe("shareHref", () => {
  const url = "https://example.org/blog/a?x=1&y=2";
  const title = "حوكمة & more";

  it("builds an https or mailto link for every network, with the URL encoded", () => {
    for (const network of SHARE_NETWORKS) {
      const href = shareHref(network, url, title);
      expect(href, network).toMatch(/^(https:\/\/|mailto:\?)/);
      expect(href, network).toContain(encodeURIComponent(url));
      expect(href, network).not.toContain("x=1&y=2");
    }
  });

  it("uses each network's share page", () => {
    expect(new URL(shareHref("whatsapp", url, title)).host).toBe("wa.me");
    expect(new URL(shareHref("x", url, title)).host).toBe("x.com");
    expect(new URL(shareHref("linkedin", url, title)).host).toBe("www.linkedin.com");
    expect(new URL(shareHref("facebook", url, title)).host).toBe("www.facebook.com");
  });
});

describe("seatsLeftRatio", () => {
  it("clamps to 0…1 and handles no seats", () => {
    expect(seatsLeftRatio(5, 20)).toBe(0.25);
    expect(seatsLeftRatio(-3, 20)).toBe(0);
    expect(seatsLeftRatio(30, 20)).toBe(1);
    expect(seatsLeftRatio(1, 0)).toBe(0);
  });
});

describe("SearchField", () => {
  it("is a GET form that submits q, keeps other params and drops page", () => {
    const { container } = render(
      <SearchField pathname="/blog" value="risk" query={{ category: "governance", page: "3", q: "old" }} />,
    );
    const form = screen.getByRole("search") as HTMLFormElement;
    expect(form.method).toBe("get");
    expect(form.getAttribute("action")).toBe("/en/blog");
    expect((screen.getByRole("searchbox", { name: "searchLabel" }) as HTMLInputElement).value).toBe("risk");
    const hidden = [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"]')];
    expect(hidden.map((input) => [input.name, input.value])).toEqual([["category", "governance"]]);
  });
});

describe("FilterChips", () => {
  const options = [
    { value: "guide", label: "Guides" },
    { value: "template", label: "Templates" },
  ];

  it("marks the active chip and resets the page", () => {
    render(
      <FilterChips label="Kind" pathname="/resources" param="kind" options={options} query={{ kind: "template", q: "risk", page: "2" }} />,
    );
    const nav = screen.getByRole("navigation", { name: "Kind" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/resources?q=risk",
      "/resources?q=risk&kind=guide",
      "/resources?q=risk&kind=template",
    ]);
    expect(links.map((link) => link.getAttribute("aria-current"))).toEqual([null, null, "true"]);
  });

  it("marks All when nothing, or an unknown value, is chosen", () => {
    render(<FilterChips label="Kind" pathname="/resources" param="kind" options={options} query={{ kind: "nope" }} />);
    expect(screen.getByRole("link", { name: "filterAll" }).getAttribute("aria-current")).toBe("true");
  });
});

describe("Pagination", () => {
  it("renders nothing for one page", () => {
    const { container } = render(<Pagination pathname="/blog" page={1} totalPages={1} />);
    expect(container.innerHTML).toBe("");
  });

  it("links prev, next and numbers, and leaves page out of page 1", () => {
    render(<Pagination pathname="/blog" page={2} totalPages={5} query={{ q: "risk" }} />);
    expect(screen.getByRole("link", { name: "previous" }).getAttribute("href")).toBe("/blog?q=risk");
    expect(screen.getByRole("link", { name: "next" }).getAttribute("href")).toBe("/blog?q=risk&page=3");
    expect(screen.getByRole("link", { name: 'page:{"page":"2"}' }).getAttribute("aria-current")).toBe("page");
  });

  it("has no previous link on the first page and no next on the last", () => {
    render(<Pagination pathname="/blog" page={1} totalPages={3} />);
    expect(screen.queryByRole("link", { name: "previous" })).toBeNull();
    cleanup();
    render(<Pagination pathname="/blog" page={3} totalPages={3} />);
    expect(screen.queryByRole("link", { name: "next" })).toBeNull();
  });
});

describe("ArticleCard", () => {
  it("shows the cover, category, title link, excerpt, date and reading time", () => {
    render(
      <ArticleCard
        href="/blog/a"
        title="Title"
        excerpt="Excerpt"
        category="Governance"
        cover={{ src: "/c.jpg", alt: "Cover" }}
        publishedAt="2026-10-21T09:00:00Z"
        readingMinutes={7}
      />,
    );
    expect(screen.getByRole("link", { name: "Title" }).getAttribute("href")).toBe("/blog/a");
    expect(screen.getByRole("img", { name: "Cover" })).toBeTruthy();
    expect(screen.getByText("Governance")).toBeTruthy();
    expect(screen.getByText("Excerpt")).toBeTruthy();
    expect(screen.getByText("21 October 2026").getAttribute("datetime")).toBe("2026-10-21T09:00:00Z");
    expect(screen.getByText('readingTime:{"minutes":7}')).toBeTruthy();
  });

  it("leaves out what the article doesn't have", () => {
    const { container } = render(
      <ArticleCard href="/blog/a" title="Title" excerpt={null} category={null} cover={null} publishedAt={null} readingMinutes={null} />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("time")).toBeNull();
    expect(screen.queryByText(/readingTime/)).toBeNull();
  });
});

describe("ShareButtons", () => {
  it("links to every network without loading a script", () => {
    const { container } = render(<ShareButtons url="https://example.org/a" title="T" />);
    const links = within(screen.getByRole("group", { name: "shareLabel" })).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      SHARE_NETWORKS.map((network) => shareHref(network, "https://example.org/a", "T")),
    );
    for (const link of links.filter((a) => a.getAttribute("target") === "_blank")) {
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
    expect(container.querySelector("script, iframe, img")).toBeNull();
    expect(screen.getByRole("button", { name: "copyLink" })).toBeTruthy();
  });

  it("has no third-party script, SDK or pixel in any listing source", () => {
    const sources = readdirSync(__dirname).filter((file) => /\.tsx?$/.test(file) && !file.includes(".test."));
    for (const file of sources) {
      const text = readFileSync(join(__dirname, file), "utf8");
      expect(text.match(/next\/script|<script|platform\.twitter|connect\.facebook|sdk\.js/)?.[0], file).toBeUndefined();
    }
  });
});

describe("CopyLinkButton", () => {
  const labels = { copy: "Copy", copied: "Copied", failed: "Failed" };

  it("copies the URL and announces it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CopyLinkButton url="https://example.org/a" labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Copied"));
    expect(writeText).toHaveBeenCalledWith("https://example.org/a");
  });

  it("says so when copying fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    render(<CopyLinkButton url="https://example.org/a" labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Failed https://example.org/a"));
  });
  it("keeps a failure when an earlier attempt succeeds late", async () => {
    let finishFirst: () => void = () => {};
    const writeText = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (finishFirst = resolve)))
      .mockRejectedValueOnce(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CopyLinkButton url="https://example.org/a" labels={labels} />);
    const button = screen.getByRole("button", { name: "Copy" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Failed"));
    finishFirst();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole("status").textContent).toContain("Failed");
  });
});

describe("ResourceCard", () => {
  it("shows the kind, file type, title, description and the action slot", () => {
    render(
      <ResourceCard kind="guide" fileType="pdf" title="Guide" description="About" action={<button type="button">Download</button>} />,
    );
    expect(screen.getByText("resourceKind.guide")).toBeTruthy();
    expect(screen.getByText('fileTypeLabel:{"type":"fileType.pdf"}')).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Guide" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();
  });

  it("leaves the file badge out when the type is unknown", () => {
    render(<ResourceCard kind="template" fileType={null} title="T" description={null} action={null} />);
    expect(screen.queryByText(/fileTypeLabel/)).toBeNull();
  });
});

describe("MediaCard and VideoEmbed", () => {
  it("shows the category, title, outlet, date, image and action", () => {
    render(
      <MediaCard
        category="events"
        title="Workshop"
        outlet="Forum"
        date="2026-05-11T00:00:00Z"
        image={{ src: "/m.jpg", alt: "Photo" }}
        action={<a href="https://example.org">Open</a>}
      />,
    );
    expect(screen.getByText("mediaCategory.events")).toBeTruthy();
    expect(screen.getByText("Forum")).toBeTruthy();
    expect(screen.getByText("11 May 2026")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Photo" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open" })).toBeTruthy();
  });

  it("puts the video frame in place of the image: lazy, titled and sandboxed", () => {
    render(
      <MediaCard
        category="media"
        title="Interview"
        outlet={null}
        date={null}
        image={{ src: "/m.jpg", alt: "Photo" }}
        media={<VideoEmbed src="https://video.example/embed/1" title="Interview video" />}
      />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    const frame = screen.getByTitle("Interview video");
    expect(frame.getAttribute("loading")).toBe("lazy");
    expect(frame.getAttribute("src")).toBe("https://video.example/embed/1");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-top-navigation");
  });
});

describe("CourseCard", () => {
  const base = {
    href: "/training/c",
    title: "Course",
    description: null,
    startsAt: "2027-01-12T12:00:00Z",
    place: "Riyadh",
    action: <button type="button">Register</button>,
  };

  it("shows the type, date, place, seats meter and register action", () => {
    render(<CourseCard {...base} type="in_person" seats={{ left: 14, total: 25 }} />);
    expect(screen.getByText("courseType.in_person")).toBeTruthy();
    // The card shows the date in the runner's zone, so expect what Intl gives
    // for the same instant there (Jan 13 in UTC+12..+14), not a fixed string.
    const local = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(base.startsAt));
    expect(screen.getByText(local)).toBeTruthy();
    expect(screen.getByText(local).closest("time")?.getAttribute("dateTime")).toBe(base.startsAt);
    expect(screen.getByText("Riyadh")).toBeTruthy();
    expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("14");
    expect(screen.getByRole("button", { name: "Register" })).toBeTruthy();
    expect(screen.queryByText("comingSoon")).toBeNull();
  });

  it("says online for a live online course", () => {
    render(<CourseCard {...base} type="online_live" place={null} seats={null} />);
    expect(screen.getByText("online")).toBeTruthy();
    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("replaces the register action when the course is full", () => {
    render(<CourseCard {...base} type="in_person" seats={{ left: 0, total: 20 }} />);
    expect(screen.getByText("courseFull")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Register" })).toBeNull();
  });

  it("shows only the coming-soon badge for a recorded course", () => {
    const { container } = render(<CourseCard {...base} type="recorded" seats={{ left: 5, total: 20 }} />);
    expect(screen.getByText("comingSoon")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("meter")).toBeNull();
    expect(container.querySelector("time")).toBeNull();
  });
});

describe("SeatsMeter", () => {
  it("clamps the bar and the count", () => {
    render(<SeatsMeter left={-2} total={10} />);
    const meter = screen.getByRole("meter");
    expect(meter.getAttribute("aria-valuenow")).toBe("0");
    expect((meter.firstElementChild as HTMLElement).style.width).toBe("0%");
  });
});

// CLAUDE.md and §13 rules, like components/ui/rules.test.ts.
describe("listing rules", () => {
  const sources = readdirSync(__dirname)
    .filter((file) => /\.tsx?$/.test(file) && !file.includes(".test."))
    .map((file) => ({ file, text: readFileSync(join(__dirname, file), "utf8") }));

  it("uses logical direction utilities only", () => {
    const physical = /(?<![\w-])(?:-?(?:ml|mr|pl|pr|left|right)-[\w./[\]-]+|text-(?:left|right)|rounded-[lr](?:-|\b)|border-[lr](?:-|\b))/;
    for (const { file, text } of sources) expect(text.match(physical)?.[0], file).toBeUndefined();
  });

  it("uses tokens, not raw colors", () => {
    const raw = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\b(?:bg|text|border)-(?:red|blue|green|gray|slate|amber|yellow|white|black)\b/i;
    for (const { file, text } of sources) expect(text.match(raw)?.[0], file).toBeUndefined();
  });

  it("has no hardcoded UI text", () => {
    for (const { file, text } of sources) {
      expect(text.match(/[؀-ۿ]/)?.[0], file).toBeUndefined();
      expect(text.match(/>\s*[A-Za-z][A-Za-z ]{2,}\s*</)?.[0], file).toBeUndefined();
    }
  });
});
