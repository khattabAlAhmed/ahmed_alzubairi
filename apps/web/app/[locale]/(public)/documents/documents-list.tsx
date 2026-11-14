import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@repo/shared";
import { useTranslations } from "next-intl";
import { DocumentRequestProvider, RequestButton, SelectBox } from "@/components/documents/request-provider";
import { CARD, CONTAINER, EmptyNote, PageSection } from "@/components/public/projects";
import { cx } from "@/components/ui/cx";

export type ListedDocument = { id: string; title: string; category: DocumentCategory };

/**
 * `/documents` below its hero: titles and categories only, never the file
 * (§6.12). Each has "طلب الاطلاع" and a box for "طلب عدة وثائق"; the request
 * flow runs in the browser, so the page itself stays cached.
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
    <DocumentRequestProvider documents={documents.map(({ id, title }) => ({ id, title }))}>
      <div className={cx(CONTAINER, "flex flex-col gap-12 py-12 md:py-16")}>
        {groups.map(({ category, items }) => (
          <PageSection key={category} id={`documents-${category}`} title={t(`documentCategory.${category}`)}>
            <ul className="grid gap-4 md:grid-cols-2">
              {items.map((document) => (
                <li key={document.id} className={cx(CARD, "flex flex-wrap items-center justify-between gap-4 p-5!")}>
                  <div className="flex min-w-0 flex-1 basis-48 items-start gap-3">
                    <SelectBox id={document.id} title={document.title} />
                    <span className="min-w-0 text-pretty font-semibold wrap-anywhere">{document.title}</span>
                  </div>
                  <RequestButton id={document.id} title={document.title} />
                </li>
              ))}
            </ul>
          </PageSection>
        ))}
      </div>
    </DocumentRequestProvider>
  );
}
