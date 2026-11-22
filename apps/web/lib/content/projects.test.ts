import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Projects from the row to the page: the list fields T16 added, and the rule
 * that a hidden organization name never reaches the browser (§6.6). The fake
 * client returns the fixture rows for any query, so the rule must hold in
 * lib/content's own code.
 */
const db = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: db.rows, error: null }).then(resolve),
    };
    return { from: () => builder };
  },
}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string | { pathname: string }; children: ReactNode }) =>
    createElement("a", { href: typeof href === "string" ? href : href.pathname }, children),
}));
// The invitation's button reads the auth state; it has nothing to do with the record.
vi.mock("@/components/consultation-button", () => ({ ConsultationButton: () => null }));

const { getProject, getProjects } = await import("./projects");
const { ProjectDetailPage, ProjectsList } = await import("@/components/public/projects");

const SECRET_AR = "اسم الجهة السري";
const SECRET_EN = "Secret Org Name";

function row(overrides: Record<string, unknown>) {
  return {
    id: "p1",
    slug: "hidden",
    expertise_id: null,
    org_type: "organization",
    title_ar: "مشروع",
    title_en: "A project",
    org_name_ar: SECRET_AR,
    org_name_en: SECRET_EN,
    org_label_ar: "منظمة دولية",
    org_label_en: "An international organization",
    hide_org_name: true,
    goal_ar: "الهدف",
    goal_en: "The goal",
    role_en: "Lead consultant",
    duration_ar: "١٤ شهراً",
    duration_en: "14 months · 2022–2023",
    key_result_en: "Most reports came through the committees",
    is_featured: true,
    status: "published",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-03-14T09:00:00Z",
    project_images: [],
    project_services: [],
    ...overrides,
  };
}

beforeEach(() => {
  db.rows = [row({})];
});

describe("projects content", () => {
  it("gives each list item its duration and when it was last edited", async () => {
    const [project] = await getProjects("en");
    expect(project).toMatchObject({ duration: "14 months · 2022–2023", updatedAt: "2026-03-14T09:00:00Z" });
    expect((await getProjects("ar"))[0]?.duration).toBe("١٤ شهراً");
  });

  it("flags a hidden name and gives only the general label", async () => {
    const project = await getProject("hidden", "en");
    expect(project).toMatchObject({ organization: "An international organization", organizationHidden: true });
    const json = JSON.stringify([project, await getProjects("en"), await getProject("hidden", "ar")]);
    expect(json).not.toContain(SECRET_EN);
    expect(json).not.toContain(SECRET_AR);
  });

  it("shows a public name without the flag", async () => {
    db.rows = [row({ hide_org_name: false })];
    expect(await getProject("hidden", "en")).toMatchObject({ organization: SECRET_EN, organizationHidden: false });
  });

  it("keeps the hidden name out of the list and the project page HTML", async () => {
    const project = await getProject("hidden", "en");
    if (!project) throw new Error("the fixture project should be public");
    const html = [
      renderToStaticMarkup(createElement(ProjectDetailPage, { project, area: null })),
      renderToStaticMarkup(
        createElement(ProjectsList, { projects: await getProjects("en"), areas: [], filters: { area: null, orgType: null } }),
      ),
    ].join("");
    expect(html).toContain("An international organization");
    expect(html).toContain("hiddenName");
    expect(html).not.toContain(SECRET_EN);
    expect(html).not.toContain(SECRET_AR);
  });
});
