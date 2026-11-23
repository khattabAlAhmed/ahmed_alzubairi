// @vitest-environment jsdom
import type { TiptapDoc } from "@repo/shared";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TestimonialSet } from "./identity";
import type { ExpertiseAreaDetail, Faq, HomeStat, Page, Project, Service, ServiceDetail, TimelineItem } from "@/lib/content";

const mocks = vi.hoisted(() => ({
  connected: false,
  connectedBeforeRead: false,
  signedIn: false,
  projects: [] as Project[],
  serviceIds: {} as Record<string, string[]>,
  service: null as unknown,
  services: [] as unknown[],
  page: null as unknown,
  area: null as unknown,
  areas: [] as unknown[],
  readBeforeConnection: false,
  sections: [] as unknown[],
}));

/** Records a content read made before the page waited for a request. */
function read<T>(value: T): T {
  if (!mocks.connected) mocks.readBeforeConnection = true;
  return value;
}

// The pages wait for a request before reading content (the build never reads Supabase).
vi.mock("next/server", () => ({
  connection: async () => {
    mocks.connected = true;
  },
}));
vi.mock("@/components/clerk/auth-state", () => ({
  useAuthState: () => ({ isLoaded: true, isSignedIn: mocks.signedIn, email: null }),
  requestClerk: () => {},
}));
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
// Shows where a page sends the language switch when it has no translation (§6.1).
vi.mock("@/components/language-switch", () => ({
  LanguageFallback: ({ href }: { href: string }) => <span data-testid="language-fallback">{href}</span>,
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
  getService: async () => {
    mocks.connectedBeforeRead = mocks.connected;
    return mocks.service;
  },
  getServices: async () => read(mocks.services),
  getExpertiseAreas: async () => read(mocks.areas),
  getExpertiseArea: async () => read(mocks.area),
  getPage: async () => read(mocks.page),
  getTimeline: async () => read([]),
  getHomeStats: async () => read([]),
  getHomeSections: async () => read(mocks.sections),
  getSiteSettings: async () => read({ cvUrl: null }),
  getFaqs: async () => [],
}));

const { AboutPage } = await import("./about");
const { PageHero } = await import("../parts");
const { ExpertiseDetailPage, ExpertiseListPage } = await import("./expertise");
const { ServiceDetailPage, ServicesListPage, splitStages } = await import("./services");
const { RequestServiceButton, serviceRequestPath } = await import("./request-service-button");
const { areaFacts, newestFirst, servedOrganizations } = await import("./related");
const { isOngoing } = await import("./identity");
const { getServiceProjects } = await import("./service-projects");
const { routeSlug, staticSlugs } = await import("../static-slugs");
const servicePage = await import("@/app/[locale]/(public)/services/[slug]/page");
const aboutRoute = await import("@/app/[locale]/(public)/about/page");
const expertiseRoute = await import("@/app/[locale]/(public)/expertise/page");
const expertiseAreaRoute = await import("@/app/[locale]/(public)/expertise/[slug]/page");
const servicesRoute = await import("@/app/[locale]/(public)/services/page");

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
    duration: null,
    updatedAt: "2026-03-01T00:00:00Z",
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
  mocks.connected = false;
  mocks.readBeforeConnection = false;
});

afterEach(cleanup);

describe("RequestServiceButton", () => {
  it("goes through sign-up and back to the request with the service, when signed out", () => {
    render(<RequestServiceButton serviceSlug="strategy-review" label="requestService" />);
    const href = new URL(screen.getByRole("link").getAttribute("href")!, "https://site.invalid");
    expect(href.pathname).toBe("/sign-up");
    expect(href.searchParams.get("redirect_url")).toBe("/ar/account/consultations/new?service=strategy-review");
  });

  it("opens the request with the service, when signed in", () => {
    mocks.signedIn = true;
    render(<RequestServiceButton serviceSlug="strategy-review" label="requestService" />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/account/consultations/new?service=strategy-review");
  });

  it("encodes the service slug in the request path", () => {
    expect(serviceRequestPath("a b&c")).toBe("/account/consultations/new?service=a+b%26c");
  });
});

describe("AboutPage", () => {
  const page: Page = { key: "about", title: "About", body: doc("Short bio", "Long bio"), updatedAt: "2026-03-01T00:00:00Z", availableIn: ["ar"] };
  const timeline: TimelineItem[] = [
    { id: "1", kind: "career", title: "Senior consultant", description: null, period: "2018 – 2024" },
    { id: "2", kind: "qualification", title: "Master's degree", description: null, period: "2010" },
  ];
  const stats: HomeStat[] = [{ id: "s1", label: "Projects", value: "38" }];

  it("opens with his sentence as h1, the page name above it, and the short bio as the intro", () => {
    render(<AboutPage page={page} timeline={timeline} stats={[]} cvUrl={null} portrait={null} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe("aboutSentence");
    const header = h1.closest("header")!;
    expect(header.textContent).toContain("About");
    expect(screen.getByText("Short bio").closest("header")).toBe(header);
  });

  it("puts the long bio and the quick stats under «In short»", () => {
    render(<AboutPage page={page} timeline={timeline} stats={stats} cvUrl={null} portrait={null} />);
    const section = screen.getByRole("heading", { name: "inShort" }).closest("section")!;
    expect(section.textContent).toContain("Long bio");
    expect(section.textContent).toContain("Projects");
  });

  it("leaves «In short» out when there is no long bio and no stats", () => {
    render(<AboutPage page={{ ...page, body: doc("Short bio") }} timeline={[]} stats={[]} cvUrl={null} portrait={null} />);
    expect(screen.queryByRole("heading", { name: "inShort" })).toBeNull();
  });

  it("lists career and qualifications separately", () => {
    render(<AboutPage page={page} timeline={timeline} stats={[]} cvUrl={null} portrait={null} />);
    expect(screen.getByRole("heading", { name: "career" }).closest("section")?.textContent).toContain(
      "Senior consultant",
    );
    const qualifications = screen.getByRole("heading", { name: "qualificationsAndMethod" }).closest("section")!;
    expect(qualifications.textContent).toContain("Master's degree");
    expect(qualifications.querySelector('a[href="/documents"]')).not.toBeNull();
  });

  it("lists his values as definitions beside the qualifications, even without any", () => {
    render(<AboutPage page={page} timeline={[]} stats={[]} cvUrl={null} portrait={null} />);
    const values = screen.getByLabelText("valuesLabel");
    expect([...values.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual([
      "values.listen.title",
      "values.doable.title",
      "values.leave.title",
    ]);
  });

  it("shows the portrait in the header only when the home hero has a photo", () => {
    render(<AboutPage page={page} timeline={[]} stats={[]} cvUrl={null} portrait={{ src: "/p.jpg", name: "Ahmed" }} />);
    expect(screen.getByRole("img", { name: "portraitAlt" }).closest("header")).not.toBeNull();
    cleanup();
    render(<AboutPage page={page} timeline={[]} stats={[]} cvUrl={null} portrait={null} />);
    expect(screen.queryByRole("img", { name: "portraitAlt" })).toBeNull();
  });

  it("shows the work photo beside the career, with its alt and caption, only when set", () => {
    const image = { url: "https://example.supabase.co/work.jpg", alt: "Ahmed in a working session", caption: "Working session" };
    render(<AboutPage page={{ ...page, image }} timeline={timeline} stats={[]} cvUrl={null} portrait={null} />);
    const career = screen.getByRole("heading", { name: "career" }).closest("section")!;
    const img = screen.getByRole("img", { name: "Ahmed in a working session" });
    expect(career.contains(img)).toBe(true);
    expect(img.closest("figure")?.querySelector("figcaption")?.textContent).toContain("Working session");
    expect(img.parentElement?.className).toContain("aspect-[4/5]");
    expect(img.getAttribute("loading")).toBe("lazy");
    cleanup();

    render(<AboutPage page={{ ...page, image: null }} timeline={timeline} stats={[]} cvUrl={null} portrait={null} />);
    const bare = screen.getByRole("heading", { name: "career" }).closest("section")!;
    expect(bare.querySelector("figure")).toBeNull();
    expect(bare.querySelector("ol")?.closest(".md\\:w-2\\/3")).not.toBeNull();
  });

  it("leaves the caption out when the work photo has none", () => {
    const image = { url: "https://example.supabase.co/work.jpg", alt: "Ahmed at work", caption: null };
    render(<AboutPage page={{ ...page, image }} timeline={timeline} stats={[]} cvUrl={null} portrait={null} />);
    expect(screen.getByRole("img", { name: "Ahmed at work" }).closest("figure")?.querySelector("figcaption")).toBeNull();
  });

  it("shows the CV link only when site settings give a URL", () => {
    render(<AboutPage page={page} timeline={[]} stats={[]} cvUrl={null} portrait={null} />);
    expect(screen.queryByRole("link", { name: "cv" })).toBeNull();
    cleanup();

    render(<AboutPage page={page} timeline={[]} stats={[]} cvUrl="https://example.supabase.co/cv.pdf" portrait={null} />);
    expect(screen.getByRole("link", { name: "cv" }).getAttribute("href")).toBe("https://example.supabase.co/cv.pdf");
  });
});

describe("PageHero", () => {
  const props = { eyebrow: "Projects", title: "Title", intro: "Intro", facts: [{ label: "Projects", value: "38" }] };

  it("renders exactly as before when no photo is given", () => {
    const { container: without } = render(<PageHero {...props} />);
    const before = without.innerHTML;
    cleanup();
    const { container: undefinedPhoto } = render(<PageHero {...props} photo={undefined} />);
    expect(undefinedPhoto.innerHTML).toBe(before);
    expect(undefinedPhoto.querySelector("img")).toBeNull();
  });

  it("puts a photo in the end column, with the facts under it", () => {
    render(<PageHero {...props} photo={{ src: "/images/p.webp", alt: "Photo of Ahmed" }} />);
    const img = screen.getByRole("img", { name: "Photo of Ahmed" });
    const column = img.closest("figure")!.parentElement!;
    expect(column.querySelector("dl")?.textContent).toContain("38");
    expect(img.closest("header")).not.toBeNull();
  });

  it("renders exactly as before when no aside is given", () => {
    const { container: without } = render(<PageHero {...props} />);
    const before = without.innerHTML;
    cleanup();
    const { container: undefinedAside } = render(<PageHero {...props} aside={undefined} />);
    expect(undefinedAside.innerHTML).toBe(before);
  });

  it("puts an aside in the end column, after the facts", () => {
    render(<PageHero {...props} aside={<ol aria-label="Steps"><li>One</li></ol>} />);
    const steps = screen.getByRole("list", { name: "Steps" });
    const column = steps.parentElement!;
    expect(column.firstElementChild?.tagName).toBe("DL");
    expect(column.className).toContain("lg:col-span-3");
  });
});

describe("ExpertiseDetailPage", () => {
  const area: ExpertiseAreaDetail = {
    id: "a1",
    slug: "humanitarian",
    title: "Humanitarian work",
    summary: "Area summary",
    body: doc("What I mean"),
    availableIn: ["ar", "en"],
  };
  const areaService: Service = { ...service, id: "svc-2", slug: "protection", title: "Protection", expertiseId: "a1" };

  it("shows the wide photo between the header and the body, with its alt and caption, only when set", () => {
    const image = { url: "https://example.supabase.co/field.jpg", alt: "A listening session", caption: "Listening session" };
    const { container } = render(<ExpertiseDetailPage area={{ ...area, image }} services={[]} projects={[]} />);
    const img = screen.getByRole("img", { name: "A listening session" });
    const figure = img.closest("figure")!;
    expect(img.parentElement?.className).toContain("aspect-[21/8]");
    expect(figure.querySelector("figcaption")?.textContent).toContain("Listening session");
    // In the first screen at every width, so it loads at once (About's photo stays lazy).
    expect(img.getAttribute("loading")).toBe("eager");
    expect(img.getAttribute("fetchpriority")).toBe("high");
    const header = screen.getByRole("heading", { level: 1 }).closest("header")!;
    const meaning = screen.getByRole("heading", { name: "areaMeaning" });
    expect(header.compareDocumentPosition(figure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(figure.compareDocumentPosition(meaning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll("figure").length).toBe(1);
    cleanup();

    const { container: bare } = render(<ExpertiseDetailPage area={{ ...area, image: null }} services={[]} projects={[]} />);
    expect(bare.querySelector("figure")).toBeNull();
    const after = screen.getByRole("heading", { level: 1 }).closest("header")!.nextElementSibling;
    expect(after?.className).toContain("mt-section");
  });

  it("shows the area's counts as a ledger and its services beside the body", () => {
    const projects = [project("1", { organization: "Org A" }), project("2", { organization: "Org A" })];
    render(<ExpertiseDetailPage area={area} services={[areaService]} projects={projects} />);
    const header = screen.getByRole("heading", { level: 1 }).closest("header")!;
    expect(header.querySelectorAll("dd").length).toBe(2);
    expect([...header.querySelectorAll("dd")].map((dd) => dd.textContent)).toEqual(["٢", "١"]);
    const meaning = screen.getByRole("heading", { name: "areaMeaning" }).closest("section")!;
    expect(meaning.textContent).toContain("What I mean");
    expect(meaning.querySelector('a[href="/services/protection"]')).not.toBeNull();
  });

  it("shows the three latest projects, the count only when there are more, and a link to all of them", () => {
    const projects = ["1", "2", "3", "4"].map((id) => project(id));
    render(<ExpertiseDetailPage area={area} services={[]} projects={projects} />);
    const section = screen.getByRole("heading", { name: "areaProjects" }).closest("section")!;
    expect(section.textContent).toContain("areaProjectsCount");
    expect(section.textContent).toContain("Project 3");
    expect(section.textContent).not.toContain("Project 4");
    expect(section.querySelector('a[href="/projects?area=humanitarian"]')).not.toBeNull();
    cleanup();

    render(<ExpertiseDetailPage area={area} services={[]} projects={projects.slice(0, 2)} />);
    expect(screen.getByRole("heading", { name: "areaProjects" }).closest("section")!.textContent).not.toContain(
      "areaProjectsCount",
    );
  });

  it("lists the organizations served, once each, and leaves out empty sections", () => {
    render(
      <ExpertiseDetailPage
        area={{ ...area, body: null }}
        services={[]}
        projects={[project("1", { organization: "An international organization" }), project("2")]}
      />,
    );
    const section = screen.getByRole("heading", { name: "areaOrganizations" }).closest("section")!;
    expect(section.textContent).toContain("An international organization");
    expect(screen.queryByRole("heading", { name: "areaMeaning" })).toBeNull();
  });
});

describe("ExpertiseListPage", () => {
  const areas = [{ id: "a1", slug: "governance", title: "Governance", summary: "S" }];

  it("opens with his sentence and lists each area with its services", () => {
    render(
      <ExpertiseListPage
        areas={areas}
        services={[{ ...service, expertiseId: "a1" }]}
        projects={[project("1", { expertiseId: "a1", organization: "Org" })]}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("expertiseSentence");
    const link = screen.getByRole("link", { name: /Governance/ });
    expect(link.textContent).toContain("Governance review");
    expect(link.textContent).toContain("factProjects ١");
  });

  it("shows an empty state with a way to write when nothing is published", () => {
    render(<ExpertiseListPage areas={[]} services={[]} projects={[]} />);
    expect(screen.getByRole("heading", { name: "emptyExpertiseTitle" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "contact" }).getAttribute("href")).toBe("/contact");
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
      // Numbered in the page's digits (the test page is Arabic).
      expect.arrayContaining(["١Discovery", "٢Review", "٣Report"]),
    );
    expect(screen.getByText("An international organization")).toBeTruthy();
    expect(screen.getByText("What's included?")).toBeTruthy();
    // The ledger: stages, past projects and the area (the Service mockup).
    const header = screen.getByRole("heading", { level: 1 }).closest("header")!;
    expect([...header.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual(["factStages", "factPastProjects", "area"]);
    expect(header.textContent).toContain("Governance");
    // The area links to its page.
    const areaLink = within(header).getByRole("link", { name: "Governance" });
    expect(areaLink.getAttribute("href")).toBe("/expertise/governance");
    // One request, in the panel: no button in the header, no closing band.
    expect(screen.getAllByRole("link", { name: "requestService" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "ctaTitle" })).toBeNull();
    // The first question is open.
    expect(screen.getByText("What's included?").closest("details")?.open).toBe(true);
  });

  it("leaves out projects and FAQs when there are none", () => {
    render(<ServiceDetailPage service={service} area={null} projects={[]} faqs={[]} />);
    expect(screen.queryByRole("heading", { name: "serviceProjects" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "serviceFaqs" })).toBeNull();
  });
});

describe("ServicesListPage", () => {
  const services: Service[] = [
    { ...service, id: "s1", slug: "one", title: "One", isFeatured: false },
    { ...service, id: "s2", slug: "two", title: "Two", isFeatured: true },
  ];

  it("opens with his sentence and the count, and lists every service with its stages", () => {
    render(<ServicesListPage services={services} stageCounts={{ s2: 5 }} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("servicesSentence");
    expect(screen.getByRole("heading", { level: 1 }).closest("header")?.textContent).toContain("servicesEyebrow");
    const two = screen.getByRole("link", { name: /Two/ });
    expect(two.getAttribute("href")).toBe("/services/two");
    expect(two.textContent).toContain("stagesCount");
    expect(screen.getByRole("link", { name: /One/ }).textContent).not.toContain("stagesCount");
  });

  it("shows how the work starts, in four numbered steps", () => {
    render(<ServicesListPage services={services} />);
    const how = screen.getByRole("heading", { name: "howTitle" }).closest("section")!;
    expect(how.querySelectorAll("ol > li")).toHaveLength(4);
    expect(how.textContent).toContain("how.write.title");
  });

  it("shows an empty state with a way to write when nothing is published", () => {
    render(<ServicesListPage services={[]} />);
    expect(screen.getByRole("heading", { name: "emptyServicesTitle" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "contact" }).getAttribute("href")).toBe("/contact");
  });
});

describe("helpers", () => {
  it("splits stages by line and drops typed list markers", () => {
    expect(splitStages("1. One\n\n- Two\n٣) Three\n• Four")).toEqual(["One", "Two", "Three", "Four"]);
    expect(splitStages("A single paragraph.")).toEqual(["A single paragraph."]);
    expect(splitStages("3-month audit\n10.5% reduction\n-5% fee\n*Important* step")).toEqual([
      "3-month audit",
      "10.5% reduction",
      "-5% fee",
      "*Important* step",
    ]);
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

  it("orders career entries newest first, whatever order was saved", () => {
    const item = (id: string, period: string | null) => ({ id, period });
    const sorted = newestFirst(
      [
        item("first", "2012"),
        item("none", null),
        item("governance", "2013 – 2016"),
        item("now", "٢٠٢٠ – الآن"),
        item("protection", "2016 – 2020"),
        item("also-none", "Early career"),
      ],
      isOngoing,
    );
    expect(sorted.map((entry) => entry.id)).toEqual(["now", "protection", "governance", "first", "none", "also-none"]);
  });

  it("counts an area's projects and the organizations they served", () => {
    expect(areaFacts([project("1", { organization: "Org A" }), project("2", { organization: "Org A" }), project("3")])).toEqual({
      projects: 3,
      organizations: 1,
    });
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

  it("builds only the placeholder, without reading content", async () => {
    expect(servicePage.generateStaticParams()).toEqual([{ slug: "-" }]);
  });

  it("waits for a request before reading content", async () => {
    mocks.service = service;
    mocks.connected = false;
    await open("ar", "governance-review");
    expect(mocks.connectedBeforeRead).toBe(true);
  });
});

describe("about, expertise and services routes", () => {
  const params = (locale: string, slug = "governance") => ({ params: Promise.resolve({ locale, slug }) });
  const area = { id: "area-1", slug: "governance", title: "Governance", summary: "Area summary", body: null };
  const routes = [
    ["about", () => aboutRoute.default, () => (mocks.page = { key: "about", title: "About", body: doc("Short bio"), availableIn: ["ar"] })],
    ["expertise", () => expertiseRoute.default, () => (mocks.areas = [area])],
    ["expertise area", () => expertiseAreaRoute.default, () => (mocks.area = { ...area, availableIn: ["ar"] })],
    ["services", () => servicesRoute.default, () => (mocks.services = [service])],
  ] as const;

  beforeEach(() => {
    mocks.page = null;
    mocks.area = null;
    mocks.areas = [];
    mocks.services = [];
  });

  for (const [name, route, seed] of routes) {
    it(`${name}: returns not-found for an unknown locale, without reading content`, async () => {
      seed();
      await expect(route()(params("fr"))).rejects.toThrow("NOT_FOUND");
      expect(mocks.readBeforeConnection).toBe(false);
    });

    it(`${name}: renders one h1 and waits for a request before reading content`, async () => {
      seed();
      render(await route()(params("ar")));
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(mocks.connected).toBe(true);
      expect(mocks.readBeforeConnection).toBe(false);
    });
  }

  it("about: returns not-found when the page isn't published in this language", async () => {
    await expect(aboutRoute.default(params("en"))).rejects.toThrow("NOT_FOUND");
  });

  it("about: takes the portrait from the home hero's photo", async () => {
    mocks.page = { key: "about", title: "About", body: doc("Short bio"), availableIn: ["ar", "en"] };
    mocks.sections = [{ key: "hero", position: 0, content: { name: "Ahmed", photoUrl: "https://x.supabase.co/hero.jpg" } }];
    render(await aboutRoute.default(params("ar")));
    expect(screen.getByRole("img", { name: "portraitAlt" }).closest("header")).not.toBeNull();
    mocks.sections = [];
  });

  it("about: an Arabic-only page sends the language switch home", async () => {
    mocks.page = { key: "about", title: "About", body: doc("Short bio"), availableIn: ["ar"] };
    render(await aboutRoute.default(params("ar")));
    expect(screen.getByTestId("language-fallback").textContent).toBe("/");
  });

  it("expertise area: an Arabic-only area sends the language switch to the expertise list", async () => {
    mocks.area = { ...area, availableIn: ["ar"] };
    render(await expertiseAreaRoute.default(params("ar")));
    expect(screen.getByTestId("language-fallback").textContent).toBe("/expertise");
  });

  it("expertise area: an area in both languages keeps the normal language switch", async () => {
    mocks.area = { ...area, availableIn: ["ar", "en"] };
    render(await expertiseAreaRoute.default(params("ar")));
    expect(screen.queryByTestId("language-fallback")).toBeNull();
  });

  it("expertise area: returns not-found for an unpublished area", async () => {
    await expect(expertiseAreaRoute.default(params("ar", "missing"))).rejects.toThrow("NOT_FOUND");
  });

  it("expertise area: builds only the placeholder, without reading content", () => {
    expect(expertiseAreaRoute.generateStaticParams()).toEqual([{ slug: "-" }]);
    expect(mocks.readBeforeConnection).toBe(false);
  });

  it("lists the published content", async () => {
    mocks.areas = [area];
    render(await expertiseRoute.default(params("ar")));
    expect(screen.getByText("Governance")).toBeTruthy();
    cleanup();
    mocks.services = [service];
    render(await servicesRoute.default(params("ar")));
    expect(screen.getByText("Governance review")).toBeTruthy();
  });
});

describe("TestimonialSet", () => {
  it("joins an excerpt's author and organization with an em dash on Arabic pages", () => {
    render(
      <TestimonialSet
        testimonials={[
          { id: "t1", quote: "Q1", author: "A1", organization: null },
          { id: "t2", quote: "Q2", author: "مديرة برنامج", organization: "منظمة دولية" },
        ]}
      />,
    );
    // A middle dot beside Arabic text with digits reads as a zero (T20).
    expect(screen.getByText("مديرة برنامج — منظمة دولية")).toBeTruthy();
  });
});

describe("Page closings and breadcrumbs (the T23 check)", () => {
  const aboutPage: Page = { key: "about", title: "About", body: doc("Short bio"), updatedAt: "2026-03-01T00:00:00Z", availableIn: ["ar"] };
  const area: ExpertiseAreaDetail = {
    id: "a1",
    slug: "humanitarian",
    title: "Humanitarian work",
    summary: "Area summary",
    body: null,
    availableIn: ["ar", "en"],
  };
  /** The page's closing band: the aside named by its title. */
  const closing = () => document.querySelector("aside[aria-labelledby]");

  it("closes About with his line and one button, no photo and no steps", () => {
    render(<AboutPage page={aboutPage} timeline={[]} stats={[]} cvUrl={null} portrait={null} />);
    const band = closing()!;
    expect(within(band as HTMLElement).getByRole("heading", { level: 2 }).textContent).toBe("ctaAboutTitle");
    expect(band.textContent).toContain("ctaAboutText");
    expect(within(band as HTMLElement).getAllByRole("button")).toHaveLength(1);
    expect(within(band as HTMLElement).queryAllByRole("link")).toHaveLength(0);
    expect(band.querySelector("img, ol")).toBeNull();
  });

  it("closes Services with the photo, his line and one button, no steps", () => {
    render(<ServicesListPage services={[service]} />);
    const band = closing()!;
    expect(within(band as HTMLElement).getByRole("heading", { level: 2 }).textContent).toBe("ctaServicesTitle");
    expect(band.textContent).toContain("ctaServicesText");
    expect(band.querySelector("img")).not.toBeNull();
    expect(band.querySelector("ol")).toBeNull();
    expect(within(band as HTMLElement).getAllByRole("button")).toHaveLength(1);
    expect(within(band as HTMLElement).queryAllByRole("link")).toHaveLength(0);
  });

  it("ends an expertise area without a closing band", () => {
    render(<ExpertiseDetailPage area={area} services={[]} projects={[]} />);
    expect(screen.queryByRole("heading", { name: "ctaTitle" })).toBeNull();
    expect(closing()).toBeNull();
  });

  it("keeps the full closing where a page has no closing of its own", () => {
    render(<ExpertiseListPage areas={[]} services={[]} projects={[]} />);
    const band = closing()!;
    expect(within(band as HTMLElement).getByRole("heading", { level: 2 }).textContent).toBe("ctaTitle");
    expect(within(band as HTMLElement).getByRole("list", { name: "ctaStepsLabel" })).toBeTruthy();
    expect(within(band as HTMLElement).getByRole("link", { name: "ctaDirect" })).toBeTruthy();
  });

  it("shows «Services / name» on a service page, with no back link", () => {
    render(<ServiceDetailPage service={service} area={null} projects={[]} faqs={[]} />);
    const crumbs = screen.getByRole("navigation", { name: "breadcrumbLabel" });
    expect(within(crumbs).getByRole("link", { name: "services" }).getAttribute("href")).toBe("/services");
    expect(within(crumbs).getByText(service.title).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("link", { name: "services" })).toBe(within(crumbs).getByRole("link", { name: "services" }));
  });

  it("shows «Expertise / name» on an area page, with no back link", () => {
    render(<ExpertiseDetailPage area={area} services={[]} projects={[]} />);
    const crumbs = screen.getByRole("navigation", { name: "breadcrumbLabel" });
    expect(within(crumbs).getByRole("link", { name: "expertise" }).getAttribute("href")).toBe("/expertise");
    expect(within(crumbs).getByText("Humanitarian work").getAttribute("aria-current")).toBe("page");
    expect(screen.getAllByRole("link", { name: "expertise" })).toHaveLength(1);
  });
});
