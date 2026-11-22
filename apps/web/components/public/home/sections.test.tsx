// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MediaItem, Post, Project, Resource } from "@/lib/content";
import { ContactSection } from "./contact";
import { formatDate, formatMonth, metaSeparator, whatsappHref } from "./format";
import { SIGNATURE_PLACEHOLDER } from "@/components/voice/signature";
import { LetterSection } from "./letter";
import { ReadingSection } from "./reading";
import { SectionBoundary } from "./section-boundary";
import { ProjectsSection, selectHomeProjects } from "./projects";
import { StatNumber } from "./stat-number";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));
vi.mock("@/components/consultation-button", () => ({
  ConsultationButton: () => <button type="button">requestConsultation</button>,
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
    duration: null,
    updatedAt: "2026-03-01T00:00:00Z",
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
  it("closes with an invitation: the consultation, each channel set, and three steps", () => {
    render(
      <ContactSection
        heading="Tell me what you're facing."
        intro="Own intro"
        locale="en"
        settings={{ contactEmail: "contact@example.com", whatsappNumber: "+967700000000" }}
      />,
    );
    expect(screen.getByRole("complementary", { name: "Tell me what you're facing." })).toBeTruthy();
    expect(screen.getByText("Own intro")).toBeTruthy();
    expect(screen.getByRole("button", { name: "requestConsultation" })).toBeTruthy();

    const email = screen.getByRole("link", { name: "contact@example.com" });
    expect(email.getAttribute("href")).toBe("mailto:contact@example.com");
    expect(email.getAttribute("target")).toBeNull();
    expect(email.getAttribute("dir")).toBe("ltr");

    const whatsapp = screen.getByRole("link", { name: /\+967700000000/ });
    expect(whatsapp.getAttribute("href")).toBe("https://wa.me/967700000000");
    expect(whatsapp.getAttribute("target")).toBe("_blank");
    expect(whatsapp.getAttribute("rel")).toBe("noopener noreferrer");

    expect(within(screen.getByRole("list", { name: "ctaStepsLabel" })).getAllByRole("listitem")).toHaveLength(3);
  });

  it("leaves out channels that aren't set", () => {
    render(<ContactSection heading="Contact" locale="en" settings={{ contactEmail: null, whatsappNumber: "+967700000000" }} />);
    expect(screen.queryByRole("link", { name: /@/ })).toBeNull();
    expect(screen.getByRole("link", { name: /\+967700000000/ })).toBeTruthy();
  });
});

describe("ReadingSection", () => {
  const post: Post = {
    id: "p1",
    slug: "example-article",
    title: "Example article",
    excerpt: "One line",
    coverUrl: null,
    readingMinutes: 4,
    publishedAt: "2026-10-01T09:00:00Z",
  };
  const resource: Resource = { id: "r1", kind: "guide", title: "Example guide", description: null, access: "direct" };
  const media: MediaItem = {
    id: "m1",
    category: "media",
    title: "On protection",
    outlet: "News channel",
    date: "2026-02-01",
    imageUrl: null,
    url: null,
    videoUrl: null,
  };

  it("sets the latest appearance beside two articles and one resource", () => {
    render(
      <ReadingSection
        heading="Speaking and writing"
        posts={[post, { ...post, id: "p2", slug: "second", title: "Second article" }, { ...post, id: "p3", slug: "third", title: "Third article" }]}
        resources={[resource, { ...resource, id: "r2" }]}
        media={media}
      />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "On protection" })).toBeTruthy();
    const writing = screen.getByRole("navigation", { name: "latestWriting" });
    expect(within(writing).getAllByRole("article")).toHaveLength(2);
    expect(within(writing).getByRole("link", { name: "Example article" }).getAttribute("href")).toBe("/blog/example-article");
    expect(screen.getAllByRole("heading", { level: 3, name: "Example guide" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "readingMore" }).getAttribute("href")).toBe("/blog");
  });

  it("shows only the parts that have something", () => {
    render(<ReadingSection heading="Reading" posts={[]} resources={[resource]} media={null} />);
    expect(screen.queryByRole("navigation", { name: "latestWriting" })).toBeNull();
    expect(screen.queryByRole("link", { name: "readingMore" })).toBeNull();
    expect(screen.getByRole("heading", { level: 3, name: "Example guide" })).toBeTruthy();
  });
});

describe("LetterSection", () => {
  const letter = {
    heading: "A letter to whoever is reading this",
    salutation: "To whoever is reading this,",
    paragraphs: ["First paragraph."],
    signOff: "Ahmed Alzubairi",
    isPlaceholder: true,
    signatureUrl: null,
    signatureDarkUrl: null,
  };

  it("tags the placeholder text and signature, with no date", () => {
    render(<LetterSection content={letter} writtenAt="2026-03-10T08:00:00Z" locale="en" />);
    expect(screen.getByText("placeholderTag")).toBeTruthy();
    expect(screen.queryByText("letterWritten")).toBeNull();
    // The placeholder signature stands in until the scans are uploaded.
    expect(document.querySelector('[data-signature="ink"]')?.getAttribute("src")).toBe(SIGNATURE_PLACEHOLDER.ink);
    expect(document.querySelector('[data-signature="light"]')?.getAttribute("src")).toBe(SIGNATURE_PLACEHOLDER.light);
    // The photo is decorative.
    expect(document.querySelector(`img[src*="hands-notes"]`)?.getAttribute("alt")).toBe("");
  });

  it("says when Ahmed's own letter was written, in the page's digits", () => {
    const { rerender } = render(
      <LetterSection content={{ ...letter, isPlaceholder: false }} writtenAt="2026-03-10T08:00:00Z" locale="en" />,
    );
    expect(screen.queryByText("placeholderTag")).toBeNull();
    expect(screen.getByText("letterWritten")).toBeTruthy();
    expect(screen.getByText("March 2026")).toBeTruthy();
    rerender(<LetterSection content={{ ...letter, isPlaceholder: false }} writtenAt="2026-03-10T08:00:00Z" locale="ar" />);
    expect(screen.getByText("مارس ٢٠٢٦")).toBeTruthy();
  });
});

describe("SectionBoundary", () => {
  function Broken(): never {
    throw new Error("read failed");
  }

  it("shows the section's error with a retry, and leaves its neighbours alone", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <main>
        <p>Before</p>
        <SectionBoundary labels={{ heading: "Projects", title: "This section didn't load", text: "Weak connection.", retry: "Try again" }}>
          <Broken />
        </SectionBoundary>
        <p>After</p>
      </main>,
    );
    const failed = screen.getByRole("region", { name: "Projects" });
    expect(within(failed).getByRole("alert").textContent).toContain("This section didn't load");
    expect(within(failed).getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByText("Before")).toBeTruthy();
    expect(screen.getByText("After")).toBeTruthy();
    error.mockRestore();
  });
});

describe("format helpers", () => {
  it("separates meta items with a dash in Arabic, where a middle dot reads as a zero", () => {
    expect(metaSeparator("ar")).toBe(" — ");
    expect(metaSeparator("en")).toBe(" · ");
  });

  it("builds a wa.me link without the plus", () => {
    expect(whatsappHref("+967712345678")).toBe("https://wa.me/967712345678");
  });

  it("shows a date-only value on its own day, in the page's language", () => {
    // Day, month, year (the Numbers board), and Arabic-Indic digits in Arabic.
    expect(formatDate("2026-09-20", "en")).toBe("20 September 2026");
    expect(formatDate("2026-09-20", "ar")).toBe("٢٠ سبتمبر ٢٠٢٦");
    expect(formatDate("2026-09-20", "ar")).toContain("سبتمبر");
  });

  it("gives a month and year for the letter, in UTC", () => {
    expect(formatMonth("2026-03-31T23:30:00Z", "en")).toBe("March 2026");
    expect(formatMonth("2026-03-31T23:30:00Z", "ar")).toBe("مارس ٢٠٢٦");
  });
});
