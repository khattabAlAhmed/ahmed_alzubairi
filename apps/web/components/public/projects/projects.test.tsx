// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExpertiseArea, Project, ProjectDetail } from "@/lib/content";
import { filterProjects, filterQuery, parseProjectFilters } from "./filters";
import { ProjectDetailPage } from "./project-detail";
import { ProjectsList } from "./projects-list";
import { routeSlug, staticSlugs } from "./static-slugs";

vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
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

afterEach(cleanup);

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

describe("ProjectsList", () => {
  it("shows the matching projects, with the hidden project's label", () => {
    render(<ProjectsList projects={projects} areas={areas} filters={{ area: "governance", orgType: null }} />);

    const cards = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(cards).toEqual(["Gov project", "Hidden project"]);
    expect(screen.getByText("An international organization")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe('resultCount:{"count":2}');
  });

  it("offers only filters that match a project, and keeps the other filter in each link", () => {
    render(<ProjectsList projects={projects} areas={areas} filters={{ area: "governance", orgType: null }} />);

    const areaGroup = screen.getByRole("group", { name: "filterArea" });
    expect(within(areaGroup).queryByText("Unused area")).toBeNull();
    expect(within(areaGroup).getByText("Governance").closest("a")?.getAttribute("aria-current")).toBe("true");

    const typeGroup = screen.getByRole("group", { name: "filterOrgType" });
    expect(within(typeGroup).getByText("orgType.company").closest("a")?.getAttribute("href")).toBe(
      "/projects?area=governance&type=company",
    );
    expect(within(typeGroup).getByText("filterAll").closest("a")?.getAttribute("href")).toBe(
      "/projects?area=governance",
    );
    expect(screen.getByText("clearFilters").closest("a")?.getAttribute("href")).toBe("/projects");
  });

  it("says so when the filters match nothing", () => {
    render(<ProjectsList projects={projects} areas={areas} filters={{ area: "management", orgType: "government" }} />);
    expect(screen.getByText("noProjects")).toBeTruthy();
  });

  it("shows only the empty note when nothing is published", () => {
    render(<ProjectsList projects={[]} areas={areas} filters={{ area: null, orgType: null }} />);
    expect(screen.getByText("noProjects")).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});

describe("ProjectDetailPage", () => {
  const detail: ProjectDetail = {
    ...projects[1],
    role: "Lead consultant",
    duration: "Six months",
    activities: "Workshops",
    results: "Three plans",
    keyResult: "12 teams trained",
    images: [{ url: "https://x.supabase.co/storage/v1/object/public/public-media/a.jpg", alt: null }],
    serviceIds: [],
    availableIn: ["ar", "en"],
  };

  it("shows every field, the organization label, and a link to the area's filtered list", () => {
    render(<ProjectDetailPage project={detail} area={areas[0]} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Hidden project");
    expect(screen.getAllByText("An international organization").length).toBeGreaterThan(0);
    for (const text of ["Goal", "Lead consultant", "Six months", "Workshops", "Three plans", "12 teams trained"]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByText("Governance").closest("a")?.getAttribute("href")).toBe("/projects?area=governance");
    expect(screen.getByRole("img").getAttribute("alt")).toBe('photoAlt:{"title":"Hidden project"}');
  });

  it("leaves out empty fields", () => {
    render(
      <ProjectDetailPage
        project={{ ...detail, organization: null, role: null, duration: null, activities: null, results: null, keyResult: null, images: [] }}
        area={null}
      />,
    );
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByText("activities")).toBeNull();
    expect(screen.queryByText("results")).toBeNull();
    expect(screen.queryByText("photos")).toBeNull();
  });
});
