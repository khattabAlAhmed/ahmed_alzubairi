import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@repo/shared";
import { useTranslations } from "next-intl";
import { DocumentRequestProvider, RequestButton, SelectBox } from "@/components/documents/request-provider";
import { CONTAINER, EmptyNote, PageSection } from "@/components/public/projects";
import { LockIcon } from "@/components/icons";
import { cx } from "@/components/ui/cx";

export type ListedDocument = { id: string; title: string; category: DocumentCategory };

/**
 * `/documents` below its hero: titles and categories only, never the file
 * (§6.12). Each has "طلب الاطلاع" and a box for "طلب عدة وثائق"; the request
 * flow runs in the browser, so the page itself stays cached.
 */
export function DocumentsList({
  documents,
  bare = false,
}: {
  documents: ListedDocument[];
  /** Without the page container, for the design-system page. */
  bare?: boolean;
}) {
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
      <div className={cx(!bare && CONTAINER, "flex flex-col gap-12", !bare && "py-12 md:py-16")}>
        {groups.map(({ category, items }) => (
          <PageSection key={category} id={`documents-${category}`} title={t(`documentCategory.${category}`)}>
            {/* DocumentItem board: rows under the 2px rule; a chosen row takes the accent wash. */}
            <ul className="border-t-2 border-rule">
              {items.map((document) => (
                <li
                  key={document.id}
                  className={cx(
                    "grid grid-cols-[24px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-b border-line px-1 py-3.5 transition-state has-[:checked]:bg-accent-wash",
                    "sm:grid-cols-[24px_28px_minmax(0,1fr)_auto] md:grid-cols-[24px_28px_minmax(0,1fr)_180px_auto]",
                  )}
                >
                  <SelectBox id={document.id} title={document.title} />
                  <LockIcon aria-hidden="true" className="hidden size-5.5 text-ink-2 sm:block" />
                  <span className="min-w-0 text-pretty text-[18px] leading-[1.6] font-semibold wrap-anywhere">{document.title}</span>
                  <span className="hidden text-ink-2 type-small md:block">{t(`documentCategory.${category}`)}</span>
                  <div className="col-start-2 sm:col-start-auto">
                    <RequestButton id={document.id} title={document.title} />
                  </div>
                </li>
              ))}
            </ul>
          </PageSection>
        ))}
      </div>
    </DocumentRequestProvider>
  );
}
