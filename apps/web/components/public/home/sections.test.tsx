// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Post, Project, Resource } from "@/lib/content";
import { ContactSection } from "./contact";
import { formatDate, whatsappHref } from "./format";
import { LatestSection } from "./latest";
import { ProjectsSection, selectHomeProjects } from "./projects";
import { StatNumber } from "./stat-number";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
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
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("never animates: the final value from the first render, with no observer, frame or timer", () => {
    const observer = vi.fn();
    vi.stubGlobal("IntersectionObserver", observer);
    const frame = vi.spyOn(window, "requestAnimationFrame");
    const timeout = vi.spyOn(window, "setTimeout");

    render(<StatNumber value="1,200" />);
    act(() => {});

    expect(screen.getByText("1,200")).toBeTruthy();
    expect(observer).not.toHaveBeenCalled();
    expect(frame).not.toHaveBeenCalled();
    expect(timeout).not.toHaveBeenCalled();
  });

  it("is one text, read once by screen readers, isolated left to right", () => {
    const { container } = render(<StatNumber value="15+" />);
    const value = screen.getByText("15+");
    expect(value.getAttribute("dir")).toBe("ltr");
    expect(container.querySelector(".sr-only, [aria-hidden]")).toBeNull();
  });

  it("shows a value with no single number as written", () => {
    render(<StatNumber value="2010–2024" />);
    expect(screen.getByText("2010–2024")).toBeTruthy();
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
  it("shows three projects: the first as a full record, then two story rows", () => {
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
    const featured = screen.getByRole("article");
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(featured).getByText("An international organization")).toBeTruthy();
    expect(within(featured).getByText("30% faster")).toBeTruthy();
    expect(within(featured).getByText("whatChanged")).toBeTruthy();
    expect(within(rows[0]).queryByText("whatChangedLead")).toBeNull();
    expect(within(featured).getByRole("link", { name: "Project 1" }).getAttribute("href")).toBe("/projects/project-1");
    expect(screen.queryByText("Project 4")).toBeNull();
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
    // Day, month, year (the Numbers board), and Arabic-Indic digits in Arabic.
    expect(formatDate("2026-09-20", "en")).toBe("20 September 2026");
    expect(formatDate("2026-09-20", "ar")).toBe("٢٠ سبتمبر ٢٠٢٦");
    expect(formatDate("2026-09-20", "ar")).toContain("سبتمبر");
  });
});
