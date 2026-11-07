import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@repo/shared";
import { useTranslations } from "next-intl";
import { CARD, CONTAINER, EmptyNote, PageSection } from "@/components/public/projects";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";

/** Where "طلب الاطلاع" goes. Phase 4 builds the request there. */
export const DOCUMENT_REQUEST_PATH = "/account/documents";
export const DOCUMENT_PARAM = "document";

export type ListedDocument = { id: string; title: string; category: DocumentCategory };

/**
 * `/documents` below its hero: titles and categories only, never the file
 * (§6.12). Signed out, the request link goes through sign-in and back.
 */
export function DocumentsList({ documents }: { documents: ListedDocument[] }) {
  const t = useTranslations("Catalog");

  if (documents.length === 0) {
    return (
      <div className={cx(CONTAINER, "py-12 md:py-16")}>
        <EmptyNote text={t("noDocuments")} />
      </div>
    );
  }

  const groups = DOCUMENT_CATEGORIES.flatMap((category) => {
    const items = documents.filter((document) => document.category === category);
    return items.length > 0 ? [{ category, items }] : [];
  });

  return (
    <div className={cx(CONTAINER, "flex flex-col gap-12 py-12 md:py-16")}>
      {groups.map(({ category, items }) => (
        <PageSection key={category} id={`documents-${category}`} title={t(`documentCategory.${category}`)}>
          <ul className="grid gap-4 md:grid-cols-2">
            {items.map((document) => (
              <li key={document.id} className={cx(CARD, "flex flex-wrap items-center justify-between gap-4 p-5!")}>
                <span className="min-w-0 flex-1 basis-48 text-pretty font-semibold">{document.title}</span>
                <Link
                  href={{ pathname: DOCUMENT_REQUEST_PATH, query: { [DOCUMENT_PARAM]: document.id } }}
                  aria-label={t("requestAccessLabel", { title: document.title })}
                  className="inline-flex h-10 shrink-0 items-center rounded-md border border-text/30 px-4 text-sm font-semibold hover:bg-text/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t("requestAccess")}
                </Link>
              </li>
            ))}
          </ul>
        </PageSection>
      ))}
    </div>
  );
}
