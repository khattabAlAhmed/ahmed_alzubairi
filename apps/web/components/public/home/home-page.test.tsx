// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeSection } from "@/lib/content";

// The page lives in app/[locale]/(public)/page.tsx; its sections live here.

const content = vi.hoisted(() => ({
  sections: [] as unknown[],
  stats: [] as unknown[],
  areas: [] as unknown[],
  services: [] as unknown[],
  projects: [] as unknown[],
  partners: [] as unknown[],
  testimonials: [] as unknown[],
  media: [] as unknown[],
  posts: [] as unknown[],
  resources: [] as unknown[],
  calls: [] as string[],
}));

vi.mock("@/lib/content", () => {
  const read = (name: string, value: () => unknown) => async () => {
    content.calls.push(name);
    return value();
  };
  return {
    getHomeSections: read("sections", () => content.sections),
    getHomeStats: read("stats", () => content.stats),
    getExpertiseAreas: read("areas", () => content.areas),
    getServices: read("services", () => content.services),
    getProjects: read("projects", () => content.projects),
    getPartners: read("partners", () => content.partners),
    getTestimonials: read("testimonials", () => content.testimonials),
    getLatestMediaItems: read("media", () => content.media),
    getLatestPosts: read("posts", () => content.posts),
    getLatestResources: read("resources", () => content.resources),
    getSiteSettings: read("settings", () => ({
      contactEmail: "contact@example.com",
      whatsappNumber: null,
      linkedinUrl: null,
      socialLinks: [],
      cvUrl: null,
    })),
  };
});
vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
  useTranslations: () => (key: string) => key,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
// The page waits for a request before reading content; tests have none.
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
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

const { default: HomePage } = await import("@/app/[locale]/(public)/page");

const heading = (text: string) => ({ heading: text });

function section(key: HomeSection["key"], position: number): HomeSection {
  const sectionContent =
    key === "hero"
      ? { name: "Example Name", title: "Consultant", valueStatement: "Value", photoUrl: null }
      : key === "audiences"
        ? { ...heading("Who I work with"), items: [{ title: "A" }, { title: "B" }, { title: "C" }] }
        : heading(`${key} heading`);
  return { key, position, content: sectionContent } as HomeSection;
}

async function renderPage(locale = "en") {
  render(await HomePage({ params: Promise.resolve({ locale }) }));
}

const shownSections = () =>
  [...document.querySelectorAll("main [data-section]")].map((element) => element.getAttribute("data-section"));

beforeEach(() => {
  content.calls = [];
  content.stats = [{ id: "s1", label: "Projects", value: "40" }];
  content.areas = [{ id: "a1", slug: "governance", title: "Governance", summary: "Summary" }];
  content.services = [
    { id: "v1", slug: "featured", title: "Featured service", summary: "S", isFeatured: true, expertiseId: null },
    { id: "v2", slug: "other", title: "Other service", summary: "S", isFeatured: false, expertiseId: null },
  ];
  content.projects = [];
  content.partners = [{ id: "p1", name: "Example Org A", logoUrl: null }];
  content.testimonials = [{ id: "t1", quote: "Approved quote", author: "Example", organization: null }];
  content.media = [];
  content.posts = [];
  content.resources = [];
});

afterEach(cleanup);

describe("home page", () => {
  it("renders the sections in the order lib/content returns them", async () => {
    content.sections = [section("contact", 1), section("hero", 2), section("partners", 3), section("expertise", 4)];
    await renderPage();
    expect(shownSections()).toEqual(["contact", "hero", "partners", "expertise"]);
  });

  it("never shows the newsletter section yet", async () => {
    content.sections = [section("hero", 1), section("newsletter", 2), section("contact", 3)];
    await renderPage();
    expect(shownSections()).toEqual(["hero", "contact"]);
  });

  it("leaves out media and latest when they have nothing published", async () => {
    content.sections = [section("media", 1), section("latest", 2), section("contact", 3)];
    await renderPage();
    expect(shownSections()).toEqual(["contact"]);
  });

  it("shows media and latest when they have published content", async () => {
    content.sections = [section("media", 1), section("latest", 2)];
    content.media = [
      { id: "m1", category: "events", title: "Talk", outlet: null, date: null, imageUrl: null, url: null, videoUrl: null },
    ];
    content.resources = [{ id: "r1", kind: "guide", title: "Guide", description: null, access: "direct" }];
    await renderPage();
    expect(shownSections()).toEqual(["media", "latest"]);
  });

  it("leaves out a list section with no rows, and stats with no values", async () => {
    content.sections = [section("stats", 1), section("projects", 2), section("testimonials", 3)];
    content.stats = [];
    content.testimonials = [];
    await renderPage();
    expect(shownSections()).toEqual([]);
  });

  it("shows only featured services", async () => {
    content.sections = [section("services", 1)];
    await renderPage();
    expect(screen.getByText("Featured service")).toBeTruthy();
    expect(screen.queryByText("Other service")).toBeNull();
  });

  it("reads only what the visible sections need", async () => {
    content.sections = [section("hero", 1), section("expertise", 2)];
    await renderPage();
    expect(content.calls.sort()).toEqual(["areas", "sections"]);
  });

  it("alternates the light bands over the sections it shows", async () => {
    content.sections = [
      section("hero", 1),
      section("expertise", 2),
      section("media", 3), // left out: no media
      section("partners", 4),
      section("testimonials", 5),
      section("contact", 6),
    ];
    await renderPage();
    const bands = [...document.querySelectorAll("main section[data-band]")].map((element) => [
      element.getAttribute("data-section"),
      element.getAttribute("data-band"),
    ]);
    expect(bands).toEqual([
      ["expertise", "plain"],
      ["partners", "raised"],
      ["testimonials", "plain"],
      ["contact", "navy"],
    ]);
  });

  it("has exactly one h1: the hero's name, or the site name without a hero", async () => {
    content.sections = [section("hero", 1), section("expertise", 2)];
    await renderPage();
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Example Name"]);
    cleanup();

    content.sections = [section("expertise", 1)];
    await renderPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("links the hero to the about page and the consultation flow", async () => {
    content.sections = [section("hero", 1)];
    await renderPage("ar");
    expect(screen.getByRole("link", { name: "aboutCta" }).getAttribute("href")).toBe("/about");
    expect(screen.getByRole("button", { name: "requestConsultation" })).toBeTruthy();
  });

  it("refuses an unknown locale", async () => {
    await expect(HomePage({ params: Promise.resolve({ locale: "fr" }) })).rejects.toThrow("NOT_FOUND");
  });
});
