// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Post, Project, Resource } from "@/lib/content";
import { ContactSection } from "./contact";
import { formatDate, whatsappHref } from "./format";
import { LatestSection } from "./latest";
import { ProjectsSection, selectHomeProjects } from "./projects";
import { COUNT_DURATION_MS, StatNumber } from "./stat-number";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    slug: `project-${id}`,
    expertiseId: null,
    orgType: null,
    title: `Project ${id}`,
    organization: null,
    goal: "Goal",
    keyResult: null,
    isFeatured: false,
    coverUrl: null,
    ...overrides,
  };
}

afterEach(cleanup);

describe("StatNumber", () => {
  let observed: IntersectionObserverCallback | null;
  let frames: FrameRequestCallback[];

  function setReducedMotion(reduce: boolean) {
    window.matchMedia = ((query: string) => ({
      matches: reduce && query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  }

  beforeEach(() => {
    observed = null;
    frames = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          observed = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.spyOn(performance, "now").mockReturnValue(0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const shown = () => screen.getByTestId("stat-count").textContent;

  it("shows the final value at once with reduced motion", () => {
    setReducedMotion(true);
    render(<StatNumber value="1,200" />);
    expect(shown()).toBe("1,200");
    expect(observed).toBeNull();
  });

  it("counts up from zero once it comes into view", () => {
    setReducedMotion(false);
    render(<StatNumber value="1,200" />);
    expect(shown()).toBe("0");

    act(() => observed!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    act(() => frames.shift()!(COUNT_DURATION_MS / 2));
    const halfway = Number(shown()!.replace(/,/g, ""));
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(1200);

    act(() => frames.shift()!(COUNT_DURATION_MS));
    expect(shown()).toBe("1,200");
    expect(frames).toHaveLength(0);
  });

  it("gives screen readers the final value only", () => {
    setReducedMotion(false);
    const { container } = render(<StatNumber value="15+" />);
    expect(container.querySelector(".sr-only")?.textContent).toBe("15+");
    expect(screen.getByTestId("stat-count").getAttribute("aria-hidden")).toBe("true");
  });

  it("shows a value with no single number as written", () => {
    setReducedMotion(false);
    render(<StatNumber value="2010–2024" />);
    expect(shown()).toBe("2010–2024");
    expect(observed).toBeNull();
  });
});

describe("selectHomeProjects", () => {
  it("takes featured projects first, then fills up to three", () => {
    const projects = [project("1"), project("2", { isFeatured: true }), project("3"), project("4", { isFeatured: true })];
    expect(selectHomeProjects(projects).map((item) => item.id)).toEqual(["2", "4", "1"]);
  });

  it("returns fewer when there are fewer", () => {
    expect(selectHomeProjects([project("1")])).toHaveLength(1);
  });
});

describe("ProjectsSection", () => {
  it("shows three projects, each with its organization label and key result", () => {
    render(
      <ProjectsSection
        heading="Selected projects"
        band="plain"
        projects={[
          project("1", { isFeatured: true, organization: "An international organization", keyResult: "30% faster" }),
          project("2", { isFeatured: true }),
          project("3", { isFeatured: true }),
          project("4", { isFeatured: true }),
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText("An international organization")).toBeTruthy();
    expect(within(items[0]).getByText("30% faster")).toBeTruthy();
    expect(within(items[0]).getByText("keyResult")).toBeTruthy();
    expect(within(items[1]).queryByText("keyResult")).toBeNull();
    expect(within(items[0]).getByRole("link", { name: "Project 1" }).getAttribute("href")).toBe("/projects/project-1");
  });
});

describe("ContactSection", () => {
  it("links every channel set in site settings", () => {
    render(
      <ContactSection
        heading="Quick contact"
        settings={{
          contactEmail: "contact@example.com",
          whatsappNumber: "+967700000000",
          linkedinUrl: "https://www.linkedin.com/in/example",
        }}
      />,
    );
    const email = screen.getByRole("link", { name: /email/ });
    expect(email.getAttribute("href")).toBe("mailto:contact@example.com");
    expect(email.getAttribute("target")).toBeNull();

    const whatsapp = screen.getByRole("link", { name: /whatsapp/ });
    expect(whatsapp.getAttribute("href")).toBe("https://wa.me/967700000000");
    expect(whatsapp.getAttribute("target")).toBe("_blank");
    expect(whatsapp.getAttribute("rel")).toBe("noopener noreferrer");

    expect(screen.getByRole("link", { name: /linkedin/ }).textContent).toContain("linkedin.com/in/example");
    expect(screen.getByRole("link", { name: "sendMessage" }).getAttribute("href")).toBe("/contact");
    expect(screen.getByText("contactIntro")).toBeTruthy();
  });

  it("leaves out channels that aren't set, and keeps the contact page link", () => {
    render(
      <ContactSection
        heading="Quick contact"
        intro="Own intro"
        settings={{ contactEmail: null, whatsappNumber: "+967700000000", linkedinUrl: null }}
      />,
    );
    expect(screen.queryByRole("link", { name: /email/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /linkedin/ })).toBeNull();
    expect(screen.getByRole("link", { name: /whatsapp/ })).toBeTruthy();
    expect(screen.getByText("Own intro")).toBeTruthy();
  });
});

describe("LatestSection", () => {
  const post: Post = {
    id: "p1",
    slug: "example-article",
    title: "Example article",
    excerpt: null,
    coverUrl: null,
    readingMinutes: 4,
    publishedAt: "2026-10-01T09:00:00Z",
  };
  const resource: Resource = { id: "r1", kind: "guide", title: "Example guide", description: null, access: "direct" };

  it("shows only the column that has items", () => {
    render(<LatestSection heading="Latest" band="plain" posts={[post]} resources={[]} locale="en" />);
    expect(screen.getByRole("link", { name: "Example article" }).getAttribute("href")).toBe("/blog/example-article");
    expect(screen.getByText('readingTime {"minutes":4}')).toBeTruthy();
    expect(screen.queryByText("resources")).toBeNull();
  });

  it("never shows a bare 0 for a zero reading time", () => {
    const { container, rerender } = render(
      <LatestSection heading="Latest" band="plain" posts={[{ ...post, readingMinutes: 0 }]} resources={[]} locale="en" />,
    );
    expect(container.querySelector("li")?.textContent).not.toMatch(/0$/);
    expect(screen.queryByText(/readingTime/)).toBeNull();
    rerender(
      <LatestSection
        heading="Latest"
        band="plain"
        posts={[{ ...post, readingMinutes: 0, publishedAt: null }]}
        resources={[]}
        locale="en"
      />,
    );
    expect(container.querySelector("li")?.textContent).toBe("Example article");
  });

  it("lists resources by kind", () => {
    render(<LatestSection heading="Latest" band="plain" posts={[]} resources={[resource]} locale="en" />);
    expect(screen.getByText("resourceKind.guide")).toBeTruthy();
    expect(screen.queryByText("articles")).toBeNull();
  });
});

describe("format helpers", () => {
  it("builds a wa.me link without the plus", () => {
    expect(whatsappHref("+967712345678")).toBe("https://wa.me/967712345678");
  });

  it("shows a date-only value on its own day, in the page's language", () => {
    expect(formatDate("2026-09-20", "en")).toBe("September 20, 2026");
    expect(formatDate("2026-09-20", "ar")).toContain("سبتمبر");
  });
});
