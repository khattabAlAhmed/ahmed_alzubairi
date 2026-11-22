// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatNumber } from "@/components/public/home/stat-number";
import type { TimelineItem } from "@/lib/content";
import {
  AudienceRows,
  CareerTimeline,
  isOngoing,
  OrganizationRegister,
  ServiceRows,
  StageStrip,
  StatBand,
  StatLedger,
  TestimonialSet,
  ValueList,
} from "./identity";

const locale = vi.hoisted(() => ({ current: "ar" }));

vi.mock("next-intl", () => ({
  useLocale: () => locale.current,
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

afterEach(() => {
  cleanup();
  locale.current = "ar";
  vi.restoreAllMocks();
});

const stats = [
  { id: "1", label: "Years", value: "14" },
  { id: "2", label: "Trainees", value: "1,200" },
  { id: "3", label: "Projects", value: "38+" },
];

describe("quick stats", () => {
  it("never animate: the final value is there at once, with no observer, frame or timer", () => {
    const observer = vi.fn();
    vi.stubGlobal("IntersectionObserver", observer);
    const frame = vi.spyOn(window, "requestAnimationFrame");
    const timeout = vi.spyOn(window, "setTimeout");

    render(<StatBand stats={stats} />);
    act(() => {});

    expect(screen.getByText("١٬٢٠٠")).toBeTruthy();
    expect(observer).not.toHaveBeenCalled();
    expect(frame).not.toHaveBeenCalled();
    expect(timeout).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("show the value in the page's digits, isolated left to right", () => {
    render(<StatNumber value="15+" />);
    const value = screen.getByText("١٥+");
    expect(value.getAttribute("dir")).toBe("ltr");
    expect(value.className).toContain("tabular-nums");
    cleanup();

    locale.current = "en";
    render(<StatNumber value="١٬٢٠٠" />);
    expect(screen.getByText("1,200")).toBeTruthy();
  });

  it("read every row from the stats given, as a band or a ledger", () => {
    render(<StatBand stats={stats} />);
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual(["Years", "Trainees", "Projects"]);
    cleanup();

    render(<StatLedger stats={stats} />);
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual(["١٤", "١٬٢٠٠", "٣٨+"]);
  });
});

describe("isOngoing", () => {
  it("is true for a start with a dash and no end year", () => {
    expect(isOngoing("2020 – الآن")).toBe(true);
    expect(isOngoing("٢٠٢٠ – الآن")).toBe(true);
    expect(isOngoing("2020–present")).toBe(true);
    expect(isOngoing("2020 –")).toBe(true);
  });

  it("is false for a closed period, a single year or nothing", () => {
    expect(isOngoing("2016 – 2020")).toBe(false);
    expect(isOngoing("٢٠١٣ – ٢٠١٦")).toBe(false);
    expect(isOngoing("2012")).toBe(false);
    expect(isOngoing(null)).toBe(false);
  });
});

describe("CareerTimeline", () => {
  const items: TimelineItem[] = [
    { id: "1", kind: "career", title: "Independent consultant", description: "With ministries.", period: "2020 – present" },
    { id: "2", kind: "career", title: "Program manager", description: null, period: "2016 – 2020" },
  ];

  it("lists each role in order, with the current one alone in the accent", () => {
    render(<CareerTimeline items={items} label="Career" />);
    const list = screen.getByRole("list", { name: "Career" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => within(row).getByRole("heading").textContent)).toEqual([
      "Independent consultant",
      "Program manager",
    ]);
    expect(within(rows[0]).getByText("2020 – present").parentElement?.className).toContain("text-accent");
    expect(within(rows[1]).getByText("2016 – 2020").parentElement?.className).not.toContain("text-accent");
  });
});

describe("TestimonialSet", () => {
  const testimonials = [
    { id: "1", quote: "He listened more than he spoke.", author: "Program manager", organization: "An international organization" },
    { id: "2", quote: "Rules staff understand.", author: "Deputy minister", organization: null },
  ];

  it("shows the first in full and the others as excerpts", () => {
    render(<TestimonialSet testimonials={testimonials} source="From a thank-you letter" />);
    const [full, excerpt] = screen.getAllByRole("figure");
    expect(full.textContent).toContain("He listened more than he spoke.");
    expect(full.textContent).toContain("From a thank-you letter");
    expect(full.textContent).toContain("An international organization");
    expect(within(excerpt).getByText("Deputy minister")).toBeTruthy();
  });

  it("renders nothing without testimonials", () => {
    const { container } = render(<TestimonialSet testimonials={[]} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("OrganizationRegister", () => {
  it("names each organization once for screen readers, and links to the rest", () => {
    render(
      <OrganizationRegister
        partners={[
          { id: "1", name: "Org A", logoUrl: "https://x.supabase.co/a.png" },
          { id: "2", name: "Org B", logoUrl: null },
        ]}
        more={{ href: "/clients", label: "All organizations" }}
      />,
    );
    expect(screen.getByRole("img").getAttribute("alt")).toBe('partnerLogo:{"name":"Org A"}');
    expect(screen.getByText("Org A").getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("Org B").getAttribute("aria-hidden")).toBeNull();
    expect(screen.getByRole("link", { name: "All organizations" }).getAttribute("href")).toBe("/clients");
  });
});

describe("rows", () => {
  it("links each service row to its page, with the featured one open", () => {
    render(
      <ServiceRows
        openId="b"
        services={[
          { id: "a", slug: "governance", expertiseId: null, title: "Governance", summary: "S", isFeatured: false },
          { id: "b", slug: "protection", expertiseId: null, title: "Protection", summary: "S", isFeatured: true },
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/services/governance", "/services/protection"]);
    const classes = (element: Element) => element.className.split(" ");
    expect(classes(links[1])).toContain("bg-surface");
    expect(classes(links[0])).not.toContain("bg-surface");
  });

  it("gives each audience a heading and leaves out a missing description", () => {
    render(<AudienceRows items={[{ title: "Government", description: "Rules." }, { title: "Private", description: null }]} />);
    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual(["Government", "Private"]);
    expect(screen.getAllByRole("listitem")[1].querySelector("p")).toBeNull();
  });

  it("splits stages into named steps, or keeps one line as text", () => {
    render(<StageStrip text={"Listen: interviews\nRead\nWrite together"} formatIndex={(n) => `#${n}`} />);
    const steps = screen.getAllByRole("listitem");
    expect(steps.map((step) => step.textContent)).toEqual(["#1Listeninterviews", "#2Read", "#3Write together"]);
    cleanup();

    render(<StageStrip text="As the case needs" formatIndex={String} />);
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText("As the case needs")).toBeTruthy();
  });
});

describe("ValueList", () => {
  it("sets each value as a term and its meaning as the definition, in order", () => {
    render(
      <ValueList
        label="How I work"
        items={[
          { term: "I listen before I write", definition: "No plan before I sit with them." },
          { term: "I leave quietly", definition: "What stays after I leave." },
        ]}
      />,
    );
    const list = screen.getByLabelText("How I work");
    expect(list.tagName).toBe("DL");
    expect([...list.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual(["I listen before I write", "I leave quietly"]);
    expect(list.querySelector("dt + dd")?.textContent).toBe("No plan before I sit with them.");
  });
});
