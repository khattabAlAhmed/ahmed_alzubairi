// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExpertiseArea, Project, ProjectDetail } from "@/lib/content";
import { filterProjects, filterQuery, parsePage, parseProjectFilters } from "./filters";
import { ProjectDetailPage } from "./project-detail";
import { orderProjects, pageOf, ProjectsList } from "./projects-list";
import { routeSlug, staticSlugs } from "../static-slugs";

// The page language, switched by a test that checks the Arabic separator.
const intl = vi.hoisted(() => ({ locale: "en" }));

vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
  useLocale: () => intl.locale,
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
    className,
    "aria-current": current,
  }: {
    href: string | { pathname: string; query: Record<string, string> };
    children: ReactNode;
    className?: string;
    "aria-current"?: "true";
  }) => {
    const query = typeof href === "string" ? "" : new URLSearchParams(href.query).toString();
    const path = typeof href === "string" ? href : `${href.pathname}${query ? `?${query}` : ""}`;
    return (
      <a href={path} className={className} aria-current={current}>
        {children}
      </a>
    );
  },
}));

afterEach(() => {
  cleanup();
  intl.locale = "en";
});

const areas: ExpertiseArea[] = [
  { id: "a1", slug: "governance", title: "Governance", summary: "" },
  { id: "a2", slug: "management", title: "Management", summary: "" },
  { id: "a3", slug: "unused", title: "Unused area", summary: "" },
];

function project(overrides: Partial<Project>): Project {
  return {
    id: "p",
    slug: "p",
    expertiseId: null,
    orgType: null,
    title: "Project",
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

const projects = [
  project({ id: "p1", slug: "gov", title: "Gov project", expertiseId: "a1", orgType: "government" }),
  project({
    id: "p2",
    slug: "hidden",
    title: "Hidden project",
    expertiseId: "a1",
    orgType: "organization",
    organization: "An international organization",
  }),
  project({ id: "p3", slug: "company", title: "Company project", expertiseId: "a2", orgType: "company" }),
];

describe("parseProjectFilters", () => {
  it("reads the area and a known org type", () => {
    expect(parseProjectFilters({ area: "governance", type: "company" })).toEqual({
      area: "governance",
      orgType: "company",
    });
  });

  it("ignores an unknown org type, blanks, and repeats past the first", () => {
    expect(parseProjectFilters({ area: "  ", type: "bogus" })).toEqual({ area: null, orgType: null });
    expect(parseProjectFilters({ area: ["a", "b"], type: ["government", "company"] })).toEqual({
      area: "a",
      orgType: "government",
    });
    expect(parseProjectFilters({})).toEqual({ area: null, orgType: null });
  });
});

describe("filterProjects", () => {
  const ids = (list: Project[]) => list.map((item) => item.id);

  it("keeps everything with no filter", () => {
    expect(ids(filterProjects(projects, areas, { area: null, orgType: null }))).toEqual(["p1", "p2", "p3"]);
  });

  it("filters by area slug, org type, or both", () => {
    expect(ids(filterProjects(projects, areas, { area: "governance", orgType: null }))).toEqual(["p1", "p2"]);
    expect(ids(filterProjects(projects, areas, { area: null, orgType: "company" }))).toEqual(["p3"]);
    expect(ids(filterProjects(projects, areas, { area: "governance", orgType: "organization" }))).toEqual(["p2"]);
  });

  it("matches nothing for an area that doesn't exist", () => {
    expect(filterProjects(projects, areas, { area: "nope", orgType: null })).toEqual([]);
  });
});

describe("filterQuery", () => {
  it("drops null filters", () => {
    expect(filterQuery({ area: null, orgType: null })).toEqual({});
    expect(filterQuery({ area: "governance", orgType: "company" })).toEqual({ area: "governance", type: "company" });
  });
});

describe("staticSlugs and routeSlug", () => {
  it("builds a placeholder when nothing is published", () => {
    expect(staticSlugs([])).toEqual([{ slug: "-" }]);
    expect(staticSlugs(["a"])).toEqual([{ slug: "a" }]);
  });

  it("decodes once and keeps a bad value", () => {
    expect(routeSlug("%D8%A3")).toBe("أ");
    expect(routeSlug("%E0%A4%A")).toBe("%E0%A4%A");
  });
});

describe("parsePage", () => {
  it("reads a whole page number from 2, otherwise 1", () => {
    expect(parsePage({ page: "3" })).toBe(3);
    for (const page of [undefined, "", "1", "0", "-2", "2.5", "abc"]) expect(parsePage({ page })).toBe(1);
  });
});

describe("orderProjects and pageOf", () => {
  const many = Array.from({ length: 14 }, (_, index) =>
    project({ id: `m${index}`, slug: `m${index}`, isFeatured: index === 4 }),
  );

  it("puts the first featured project first only without a filter", () => {
    expect(orderProjects(many, false).items[0].id).toBe("m4");
    expect(orderProjects(many, false).featured?.id).toBe("m4");
    expect(orderProjects(many, true)).toEqual({ items: many, featured: null });
  });

  it("splits into pages of six and clamps the page", () => {
    expect(pageOf(many, 1)).toMatchObject({ page: 1, totalPages: 3 });
    expect(pageOf(many, 3).items.map((item) => item.id)).toEqual(["m12", "m13"]);
    expect(pageOf(many, 99).page).toBe(3);
    expect(pageOf([], 2)).toEqual({ items: [], page: 1, totalPages: 1 });
  });
});

describe("ProjectsList", () => {
  it("shows the matching projects, with the hidden project's label", () => {
    render(<ProjectsList projects={projects} areas={areas} filters={{ area: "governance", orgType: null }} />);

    const cards = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(cards).toEqual(["Gov project", "Hidden project"]);
    expect(screen.getByText(/An international organization/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain('resultCount:{"count":2}');
  });

  it("offers only filters that match a project, with counts, and keeps the other filter in each link", () => {
    render(<ProjectsList projects={projects} areas={areas} filters={{ area: "governance", orgType: null }} />);

    const areaGroup = screen.getByRole("navigation", { name: "filterArea" });
    expect(within(areaGroup).queryByText("Unused area")).toBeNull();
    const governance = within(areaGroup).getByText("Governance").closest("a");
    expect(governance?.getAttribute("aria-current")).toBe("true");
    expect(governance?.textContent).toBe("Governance2");

    const typeGroup = screen.getByRole("navigation", { name: "filterOrgType" });
    const company = within(typeGroup).getByText("orgType.company").closest("a");
    expect(company?.getAttribute("href")).toBe("/projects?area=governance&type=company");
    // With the area kept, no governance project is a company's.
    expect(company?.textContent).toBe("orgType.company0");
    expect(within(typeGroup).getByText("filterAll").closest("a")?.getAttribute("href")).toBe(
      "/projects?area=governance",
    );
    expect(screen.getByText("clearFilters").closest("a")?.getAttribute("href")).toBe("/projects");
  });

  it("separates the count from «clear» with a dot in English and an em dash in Arabic", () => {
    const separator = () => screen.getByRole("status").querySelector('[aria-hidden="true"]')?.textContent;
    render(<ProjectsList projects={projects} areas={areas} filters={{ area: "governance", orgType: null }} />);
    expect(separator()).toBe("·");
    cleanup();
    // A middle dot beside Arabic-Indic digits reads as a zero.
    intl.locale = "ar";
    render(<ProjectsList projects={projects} areas={areas} filters={{ area: "governance", orgType: null }} />);
    expect(separator()).toBe("—");
  });

  it("says so when the filters match nothing, with a way back", () => {
    render(<ProjectsList projects={projects} areas={areas} filters={{ area: "management", orgType: "government" }} />);
    expect(screen.getByRole("heading", { name: "projectsPage.noResults.title" })).toBeTruthy();
    expect(screen.getByText("clearFilters").closest("a")?.getAttribute("href")).toBe("/projects");
  });

  it("shows only the empty state when nothing is published", () => {
    render(<ProjectsList projects={[]} areas={areas} filters={{ area: null, orgType: null }} />);
    expect(screen.getByRole("heading", { name: "projectsPage.empty.title" })).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("opens page 1 with the featured record, and pages through the rest", () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      project({ id: `m${index}`, slug: `m${index}`, title: `Project ${index}`, isFeatured: index === 2 }),
    );
    render(<ProjectsList projects={many} areas={areas} filters={{ area: null, orgType: null }} />);
    expect(screen.getByRole("article").textContent).toContain("Project 2");
    expect(screen.getAllByRole("listitem").filter((item) => item.closest("ul[aria-label]")).length).toBe(5);
    expect(screen.getByRole("navigation", { name: "paginationLabel" })).toBeTruthy();
    cleanup();

    render(<ProjectsList projects={many} areas={areas} filters={{ area: null, orgType: null }} page={2} />);
    expect(screen.queryByRole("article")).toBeNull();
    const titles = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(titles).toEqual(["Project 6", "Project 7"]);
  });
});

describe("ProjectDetailPage", () => {
  const detail: ProjectDetail = {
    ...projects[1],
    role: "Lead consultant",
    duration: "Six months",
    organizationHidden: true,
    activities: "Workshops",
    results: "Three plans",
    keyResult: "12 teams trained",
    images: [
      { url: "https://x.supabase.co/storage/v1/object/public/public-media/a.jpg", alt: null },
      { url: "https://x.supabase.co/storage/v1/object/public/public-media/b.jpg", alt: "Workshop" },
    ],
    serviceIds: ["s1"],
    availableIn: ["ar", "en"],
  };

  it("shows the story, the facts, the label, and links to the service and the area's list", () => {
    render(<ProjectDetailPage project={detail} area={areas[0]} services={[{ slug: "protection", title: "Protection" }]} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Hidden project");
    expect(screen.getAllByText("An international organization").length).toBeGreaterThan(0);
    for (const text of ["Goal", "Lead consultant", "Six months", "Workshops", "Three plans", "12 teams trained"]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByText('areaLink:{"title":"Governance"}').closest("a")?.getAttribute("href")).toBe(
      "/projects?area=governance",
    );
    expect(screen.getByText('serviceLink:{"title":"Protection"}').closest("a")?.getAttribute("href")).toBe(
      "/services/protection",
    );
    expect(screen.getByText("hiddenName")).toBeTruthy();
    expect(screen.getAllByRole("img")[0].getAttribute("alt")).toBe('photoAlt:{"title":"Hidden project"}');
  });

  it("leaves out empty fields, and the note when the name is public", () => {
    render(
      <ProjectDetailPage
        project={{
          ...detail,
          organization: null,
          organizationHidden: false,
          role: null,
          duration: null,
          activities: null,
          results: null,
          keyResult: null,
          images: [],
        }}
        area={null}
      />,
    );
    expect(screen.queryByText("hiddenName")).toBeNull();
    expect(screen.queryByText("activitiesTitle")).toBeNull();
    expect(screen.queryByText("resultsTitle")).toBeNull();
    expect(screen.queryByText("whatIDid")).toBeNull();
    expect(screen.getAllByRole("img").map((image) => image.getAttribute("alt"))).toEqual(["ctaPhotoAlt"]);
  });
});
