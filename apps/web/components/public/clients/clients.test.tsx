// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientsContent } from "./clients-page";

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

afterEach(cleanup);

describe("ClientsContent", () => {
  it("shows logos, names without a logo, and testimonials with their organization", () => {
    render(
      <ClientsContent
        partners={[
          { id: "1", name: "Org A", logoUrl: "https://x.supabase.co/a.png" },
          { id: "2", name: "Org B", logoUrl: null },
        ]}
        testimonials={[
          { id: "t1", quote: "Great work.", author: "Sara, program manager", organization: "Org A" },
          { id: "t2", quote: "Thank you.", author: "Officer", organization: null },
        ]}
      />,
    );

    expect(screen.getByRole("img").getAttribute("alt")).toBe('partnerLogo:{"name":"Org A"}');
    expect(screen.getByText("Org B")).toBeTruthy();
    // One in full (with its organization), the others as excerpts.
    const [full] = screen.getAllByRole("figure");
    expect(full.textContent).toContain("Great work.");
    expect(full.textContent).toContain("Org A");
    expect(screen.getByText("Officer")).toBeTruthy();
    expect(screen.queryByText("empty.title")).toBeNull();
  });

  it("hides an empty section, and says so when both are empty", () => {
    render(<ClientsContent partners={[]} testimonials={[{ id: "t", quote: "Q", author: "A", organization: null }]} />);
    expect(screen.queryByText("logosTitle")).toBeNull();
    expect(screen.getByText("testimonialsTitle")).toBeTruthy();
    cleanup();

    render(<ClientsContent partners={[]} testimonials={[]} />);
    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual(["empty.title"]);
  });
});
