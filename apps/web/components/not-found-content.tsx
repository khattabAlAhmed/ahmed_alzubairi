import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowForwardIcon } from "@/components/icons";
import { SearchField } from "@/components/public/listing/search-field";
import { CONTAINER } from "@/components/public/parts";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import { MAIN_CONTENT_ID } from "./skip-link";

/** The four ways back, in the order people usually look. */
const WAYS = [
  { href: "/", key: "home" },
  { href: "/projects", key: "projects" },
  { href: "/blog", key: "blog" },
  { href: "/contact", key: "contact" },
] as const;

/**
 * The NotFound board: one sentence in the system's language ("This page is
 * not in the record."), a search, and four ways back, laid out on the page
 * grid under the heavy rule. The search looks in the writing, the one part of
 * the site with a search; it's a GET form, so it works without JavaScript.
 * The photo is a quiet design image, decorative.
 *
 * `embedded` shows it inside another page (the design-system page): a `div`
 * with an h2, so the page keeps its one `main` and its one h1.
 */
export function NotFoundContent({ embedded = false }: { embedded?: boolean } = {}) {
  const t = useTranslations("NotFound");
  const nav = useTranslations("Nav");
  const Root = embedded ? "div" : "main";
  const Title = embedded ? "h2" : "h1";

  return (
    <Root id={embedded ? undefined : MAIN_CONTENT_ID} className={embedded ? undefined : cx(CONTAINER, "flex-1 py-12 md:py-16")}>
      <div className="grid gap-x-8 gap-y-8 border-t-2 border-rule pt-7 md:grid-cols-12">
        <div className="flex flex-col gap-2 md:col-span-3">
          <p className="text-ink-2 type-caption">{t("code")}</p>
          <div className="relative aspect-video bg-surface">
            <Image src="/images/the-table.webp" alt="" fill sizes="(min-width: 768px) 25vw, 100vw" className="object-cover" />
          </div>
        </div>
        <div className="flex flex-col gap-4 md:col-span-5">
          <Title className="type-h1">{t("title")}</Title>
          <p className="max-w-measure text-ink-2">{t("description")}</p>
          <SearchField pathname="/blog" label={t("searchLabel")} className="mt-1.5" />
        </div>
        <nav aria-label={t("waysLabel")} className="border-t border-line md:col-span-4">
          <ul>
            {WAYS.map((way) => (
              <li key={way.key}>
                <Link
                  href={way.href}
                  className="flex items-center justify-between gap-3 border-b border-line py-3 text-ink transition-state hover:text-accent focus-ring"
                >
                  {nav(way.key)}
                  <ArrowForwardIcon className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </Root>
  );
}
