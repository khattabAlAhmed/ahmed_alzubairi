// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { useMessages, useTranslations } from "next-intl";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/Resources.json";
import en from "@/messages/en/Resources.json";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next-intl/server", async () => {
  const [arMessages, enMessages] = await Promise.all([
    import("@/messages/ar/Resources.json"),
    import("@/messages/en/Resources.json"),
  ]);
  const all = { ar: arMessages.default, en: enMessages.default };
  return {
    getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => (key: string) =>
      `${locale}:${namespace}.${key}`,
    // What the request config merges: every namespace, more than the browser needs.
    getMessages: async ({ locale }: { locale: "ar" | "en" }) => ({
      Resources: all[locale],
      DashboardContent: { secret: "never sent to the browser" },
    }),
  };
});
vi.mock("@/components/public/parts", () => ({ CONTAINER: "", PageHero: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/ui", () => ({ Skeleton: () => <div /> }));
/** Reads the client messages the way `ResourceDownload` does. */
function ClientList() {
  const t = useTranslations("Resources");
  const namespaces = Object.keys(useMessages());
  return (
    <p>
      {t("download")} | {t("newsletterConsent")} | {namespaces.join(",")}
    </p>
  );
}
vi.mock("@/components/public/resources", () => ({
  ResourcesList: () => <ClientList />,
  parseResourcesQuery: () => ({}),
}));
vi.mock("@/lib/content", () => ({ getExpertiseAreas: async () => [] }));
vi.mock("@/lib/content/resources", () => ({ getResources: async () => [], getMediaItems: async () => [] }));

const page = await import("./page");

/** The first element in a server component's returned tree that matches. */
function findElement(node: ReactNode, match: (element: ReactElement) => boolean): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child as ReactNode, match);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (match(node)) return node;
  return findElement((node.props as { children?: ReactNode }).children, match);
}
const props = (locale: string) => ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) });

afterEach(cleanup);

describe("/resources", () => {
  it("has a title and description per language", async () => {
    for (const locale of ["ar", "en"]) {
      const meta = await page.generateMetadata(props(locale));
      expect(meta.title).toEqual({ absolute: `${locale}:Seo.pages.resources.title | Ahmed Alzubairi` });
      expect(meta.description).toBe(`${locale}:Seo.pages.resources.description`);
      // A listing exists in both languages: both are alternates.
      expect(Object.keys(meta.alternates?.languages ?? {})).toEqual(["ar", "en", "x-default"]);
    }
    expect(await page.generateMetadata(props("fr"))).toEqual({});
  });

  it("shows the page's title in its hero", async () => {
    render(await page.default(props("en")));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("en:Resources.heading");
  });

  it.each([
    ["ar", ar],
    ["en", en],
  ] as const)("gives the list's client components the %s Resources messages, and nothing else", async (locale, messages) => {
    const tree = await page.default(props(locale));
    // The list sits in a Suspense inside main; it's an async server component.
    const list = findElement(tree, (element) => typeof element.type === "function" && element.type.name === "ResourcesFromQuery");
    const { type: ResourcesFromQuery, props: listProps } = list as ReactElement<object> & {
      type: (props: object) => Promise<ReactNode>;
    };
    render(<>{await ResourcesFromQuery(listProps)}</>);
    expect(screen.getByText(`${messages.download} | ${messages.newsletterConsent} | Resources`)).toBeTruthy();
  });

  it("is not found for an unknown locale", async () => {
    await expect(page.default(props("fr"))).rejects.toThrow("NOT_FOUND");
  });
});
