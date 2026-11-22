import { DOCUMENT_CATEGORIES, type DocumentCategory, type Locale } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/components/public/home/format";
import { DocumentRequestProvider } from "@/components/documents/request-provider";
import { EmptyState } from "@/components/empty-state";
import { DocumentTabs } from "./documents-tabs";

export type ListedDocument = { id: string; title: string; category: DocumentCategory };

/**
 * `/documents` below its header: titles and categories only, never the file
 * (§6.12, §9), under a tab per category. Each row has "طلب الاطلاع" and a box
 * for "طلب عدة وثائق"; the request flow runs in the browser, so the page
 * itself stays cached.
 */
export function DocumentsList({
  documents,
}: {
  documents: ListedDocument[];
  /** Kept for the design-system page: the list no longer draws the page container. */
  bare?: boolean;
}) {
  const t = useTranslations("Catalog");
  const locale = useLocale() as Locale;

  if (documents.length === 0) {
    return (
      <EmptyState level={2} title={t("documentsPage.empty.title")} text={t("documentsPage.empty.text")} />
    );
  }

  // The shared category order, then the list in that order, so "All" reads grouped.
  const categories = DOCUMENT_CATEGORIES.flatMap((category) => {
    const count = documents.filter((document) => document.category === category).length;
    if (count === 0) return [];
    return [{ category, label: t(`documentCategory.${category}`), count: formatNumber(count, locale) }];
  });
  const ordered = categories.flatMap(({ category }) => documents.filter((document) => document.category === category));

  return (
    <DocumentRequestProvider documents={documents.map(({ id, title }) => ({ id, title }))}>
      <DocumentTabs
        documents={ordered}
        categories={categories}
        labels={{
          tabs: t("documentsPage.tabsLabel"),
          all: t("documentsPage.all"),
          list: t("documentsPage.listLabel"),
        }}
      />
    </DocumentRequestProvider>
  );
}
