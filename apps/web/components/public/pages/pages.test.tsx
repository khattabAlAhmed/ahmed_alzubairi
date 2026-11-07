// @vitest-environment jsdom
import type { TiptapDoc } from "@repo/shared";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Faq, Page, Project, ServiceDetail, TimelineItem } from "@/lib/content";

const mocks = vi.hoisted(() => ({
  signedIn: false,
  projects: [] as Project[],
  serviceIds: {} as Record<string, string[]>,
  service: null as unknown,
  services: [] as unknown[],
}));

vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ isSignedIn: mocks.signedIn }) }));
vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
  useTranslations: () => (key: string) => key,
  useLocale: () => "ar",
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/components/consultation-button", () => ({
  ConsultationButton: () => <button type="button">requestConsultation</button>,
}));
vi.mock("@/i18n/navigation", () => ({
  // Serializes an object href the way next-intl's Link builds it.
  Link: ({
    href,
    children,
    className,
  }: {
    href: string | { pathname: string; query: Record<string, string> };
    children: ReactNode;
    className?: string;
  }) => (
    <a
      href={typeof href === "string" ? href : `${href.pathname}?${new URLSearchParams(href.query)}`}
      className={className}
    >
      {children}
    </a>
  ),
}));
vi.mock("@/lib/content", () => ({
  getProjects: async () => mocks.projects,
  getProject: async (slug: string) => {
    const project = mocks.projects.find((item) => item.slug === slug);
    return project ? { ...project, serviceIds: mocks.serviceIds[project.id] ?? [] } : null;
  },
  getService: async () => mocks.service,
  getServices: async () => mocks.services,
  getExpertiseAreas: async () => [],
  getFaqs: async () => [],
}));

const { AboutPage } = await import("./about");
const { ServiceDetailPage, splitStages } = await import("./services");
const { RequestServiceButton, serviceRequestPath } = await import("./request-service-button");
const { getServiceProjects, servedOrganizations } = await import("./related");
const { routeSlug, staticSlugs } = await import("./static-slugs");
const servicePage = await import("@/app/[locale]/(public)/services/[slug]/page");

const doc = (...paragraphs: string[]) =>
  ({
    type: "doc",
    content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
  }) as TiptapDoc;

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    slug: `p-${id}`,
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

const service: ServiceDetail = {
  id: "svc-1",
  slug: "governance-review",
  expertiseId: null,
  title: "Governance review",
  summary: "Summary",
  isFeatured: true,
  audience: null,
  deliverables: "Report",
  stages: "1. Discovery\n2. Review\n3. Report",
  availableIn: ["ar", "en"],
};

beforeEach(() => {
  mocks.signedIn = false;
  mocks.projects = [];
  mocks.serviceIds = {};
});

afterEach(cleanup);

describe("RequestServiceButton", () => {
  it("goes through sign-up and back to the request with the service, when signed out", () => {
    render(<RequestServiceButton serviceId="svc-1" label="requestService" />);
    const href = new URL(screen.getByRole("link").getAttribute("href")!, "https://site.invalid");
    expect(href.pathname).toBe("/sign-up");
    expect(href.searchParams.get("redirect_url")).toBe("/ar/account/consultations?service=svc-1");
  });

  it("opens the request with the service, when signed in", () => {
    mocks.signedIn = true;
    render(<RequestServiceButton serviceId="svc-1" label="requestService" />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/account/consultations?service=svc-1");
  });

  it("encodes the service ID in the request path", () => {
    expect(serviceRequestPath("a b&c")).toBe("/account/consultations?service=a+b%26c");
  });
});

describe("AboutPage", () => {
  const page: Page = { key: "about", title: "About", body: doc("Short bio", "Long bio"), availableIn: ["ar"] };
  const timeline: TimelineItem[] = [
    { id: "1", kind: "career", title: "Senior consultant", description: null, period: "2018 – 2024" },
    { id: "2", kind: "qualification", title: "Master's degree", description: null, period: "2010" },
  ];

  it("shows the title as h1, the first paragraph as the intro, and the rest after it", () => {
    render(<AboutPage page={page} timeline={timeline} cvUrl={null} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("About");
    const intro = screen.getByText("Short bio");
    expect(intro.closest("header")).not.toBeNull();
    expect(screen.getByText("Long bio").closest("header")).toBeNull();
  });

  it("lists career and qualifications separately", () => {
    render(<AboutPage page={page} timeline={timeline} cvUrl={null} />);
    expect(screen.getByRole("heading", { name: "career" }).closest("section")?.textContent).toContain(
      "Senior consultant",
    );
    expect(screen.getByRole("heading", { name: "qualifications" }).closest("section")?.textContent).toContain(
      "Master's degree",
    );
  });

  it("shows the CV link only when site settings give a URL", () => {
    render(<AboutPage page={page} timeline={[]} cvUrl={null} />);
    expect(screen.queryByRole("link", { name: "downloadCv" })).toBeNull();
    cleanup();

    render(<AboutPage page={page} timeline={[]} cvUrl="https://example.supabase.co/cv.pdf" />);
    expect(screen.getByRole("link", { name: "downloadCv" }).getAttribute("href")).toBe(
      "https://example.supabase.co/cv.pdf",
    );
  });
});

describe("ServiceDetailPage", () => {
  const faqs: Faq[] = [
    { id: "f1", category: "consultations", serviceId: "svc-1", question: "What's included?", answer: "A review." },
  ];

  it("shows the filled sections, related projects, FAQs and the request button", () => {
    render(
      <ServiceDetailPage
        service={service}
        area={{ id: "a1", slug: "governance", title: "Governance", summary: "S" }}
        projects={[project("1", { organization: "An international organization" })]}
        faqs={faqs}
      />,
    );
    expect(screen.queryByRole("heading", { name: "audience" })).toBeNull();
    expect(screen.getByRole("heading", { name: "deliverables" })).toBeTruthy();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(
      expect.arrayContaining(["1Discovery", "2Review", "3Report"]),
    );
    expect(screen.getByText("An international organization")).toBeTruthy();
    expect(screen.getByText("What's included?")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Governance" }).getAttribute("href")).toBe("/expertise/governance");
    expect(screen.getAllByRole("link", { name: "requestService" })).toHaveLength(2);
  });

  it("leaves out projects and FAQs when there are none", () => {
    render(<ServiceDetailPage service={service} area={null} projects={[]} faqs={[]} />);
    expect(screen.queryByRole("heading", { name: "serviceProjects" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "serviceFaqs" })).toBeNull();
  });
});

describe("helpers", () => {
  it("splits stages by line and drops typed list markers", () => {
    expect(splitStages("1. One\n\n- Two\n٣) Three\n• Four")).toEqual(["One", "Two", "Three", "Four"]);
    expect(splitStages("A single paragraph.")).toEqual(["A single paragraph."]);
  });

  it("lists each organization once, skipping projects without one", () => {
    expect(
      servedOrganizations([
        project("1", { organization: "Org A" }),
        project("2"),
        project("3", { organization: "Org A" }),
        project("4", { organization: "An international organization" }),
      ]),
    ).toEqual(["Org A", "An international organization"]);
  });

  it("finds a service's projects through project_services", async () => {
    mocks.projects = [project("1"), project("2"), project("3")];
    mocks.serviceIds = { "1": ["svc-1"], "2": ["svc-2"], "3": ["svc-2", "svc-1"] };
    expect((await getServiceProjects("svc-1", "ar")).map((item) => item.id)).toEqual(["1", "3"]);
  });

  it("gives Cache Components a placeholder param when nothing is published", () => {
    expect(staticSlugs([])).toEqual([{ slug: "-" }]);
    expect(staticSlugs(["a", "b"])).toEqual([{ slug: "a" }, { slug: "b" }]);
  });

  it("decodes a slug once, and leaves a malformed one as is", () => {
    expect(routeSlug("%D9%85%D8%AB%D8%A7%D9%84")).toBe("مثال");
    expect(routeSlug("%zz")).toBe("%zz");
  });
});

describe("service route", () => {
  const open = (locale: string, slug: string) =>
    servicePage.default({ params: Promise.resolve({ locale, slug }) });

  it("returns not-found for a service not published in this language", async () => {
    mocks.service = null;
    await expect(open("ar", "english-only-service")).rejects.toThrow("NOT_FOUND");
  });

  it("returns not-found for an unknown locale", async () => {
    await expect(open("fr", "governance-review")).rejects.toThrow("NOT_FOUND");
  });

  it("renders a published service", async () => {
    mocks.service = service;
    render(await open("ar", "governance-review"));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Governance review");
  });

  it("builds the services published in the language", async () => {
    mocks.services = [{ slug: "governance-review" }, { slug: "strategic-planning" }];
    expect(await servicePage.generateStaticParams({ params: { locale: "ar" } })).toEqual([
      { slug: "governance-review" },
      { slug: "strategic-planning" },
    ]);
  });
});
