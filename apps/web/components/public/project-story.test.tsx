// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/lib/content";
import { ProjectStoryFeatured, ProjectStoryList, ProjectStoryRow, storyFromProject } from "./project-story";

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

afterEach(cleanup);

const REAL_NAME = "Real Ministry of Secrets";

/**
 * A hidden project as lib/content gives it: `organization` is the general
 * label. The extra row fields stand for anything a caller might spread in by
 * mistake; the story must render only the fields it knows.
 */
const hidden = {
  id: "p1",
  slug: "hidden",
  expertiseId: null,
  orgType: "government",
  title: "Delegation guide",
  organization: "A ministry",
  goal: "Decisions waited a month.",
  keyResult: "Decided in a week.",
  isFeatured: true,
  coverUrl: null,
  org_name_en: REAL_NAME,
  orgName: REAL_NAME,
} as unknown as Project;

describe("ProjectStory", () => {
  it("shows the general label of a hidden organization, and never its real name", () => {
    const story = storyFromProject(hidden, { area: "Governance", whatIDid: "Lead consultant" });
    const { container } = render(
      <>
        <ProjectStoryFeatured story={story} />
        <ProjectStoryList>
          <ProjectStoryRow story={story} />
        </ProjectStoryList>
      </>,
    );
    expect(screen.getAllByText("A ministry").length).toBeGreaterThan(0);
    expect(container.innerHTML).not.toContain(REAL_NAME);
    expect(JSON.stringify(story)).not.toContain(REAL_NAME);
  });

  it("maps goal, role and key result to the three rows, with only what changed in the accent", () => {
    render(<ProjectStoryFeatured story={storyFromProject(hidden, { whatIDid: "Lead consultant" })} />);
    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    expect(terms).toEqual(["situation", "whatIDid", "whatChanged"]);
    expect(screen.getByText("Decisions waited a month.")).toBeTruthy();
    expect(screen.getByText("Lead consultant")).toBeTruthy();
    const accented = screen.getAllByRole("term").filter((term) => term.className.includes("text-accent"));
    expect(accented.map((term) => term.textContent)).toEqual(["whatChanged"]);
  });

  it("leaves out rows it wasn't given", () => {
    render(<ProjectStoryFeatured story={storyFromProject({ ...hidden, keyResult: null })} />);
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual(["situation"]);
  });

  it("links the whole row to the project, with what changed and the area", () => {
    render(
      <ProjectStoryList>
        <ProjectStoryRow story={storyFromProject(hidden, { area: "Governance" })} />
      </ProjectStoryList>,
    );
    const row = within(screen.getByRole("listitem"));
    expect(row.getByRole("link").getAttribute("href")).toBe("/projects/hidden");
    expect(row.getByText("Decided in a week.", { exact: false })).toBeTruthy();
    expect(row.getByText("Governance")).toBeTruthy();
  });
});
