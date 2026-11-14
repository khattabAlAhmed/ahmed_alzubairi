import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { documentsAccess, loadDocuments } from "@/components/dashboard/documents/data";
import { fileTypeLabel } from "@/components/dashboard/documents/send";
import { PublishToggle } from "@/components/dashboard/documents/publish-toggle";
import { Refusal } from "@/components/dashboard/refusal";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { requireTeamMember } from "@/lib/auth/gates";

const BASE = "/dashboard/documents";

/**
 * The protected documents (§6.20 Documents): list, publish and unpublish,
 * and the way in to add or edit one. Needs `documents.manage`, checked here
 * on the server; the routes check it again.
 */
export default async function DocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireTeamMember(params, "/dashboard/documents");
  const access = await documentsAccess(params);
  if (!access.allowed) return <Refusal />;
  const { locale } = access;

  const [t, tw, all, documents] = await Promise.all([
    getTranslations("DashboardDocuments"),
    getTranslations("Workspace.document"),
    getMessages(),
    loadDocuments(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        intro={t("intro")}
        actions={<ButtonLink href={`${BASE}/new`}>{t("add")}</ButtonLink>}
      />
      <p role="status" className="text-sm text-text-secondary">
        {t("count", { total: documents.length })}
      </p>

      {documents.length === 0 ? (
        <Card as="section">
          <h2 className="text-xl">{t("empty.title")}</h2>
          <p className="mt-2 text-text-secondary">{t("empty.text")}</p>
        </Card>
      ) : (
        <NextIntlClientProvider locale={locale} messages={{ DashboardDocuments: all.DashboardDocuments }}>
          <ul className="divide-y divide-text/10 rounded-lg border border-text/10 bg-surface">
            {documents.map((document) => {
              const title = (locale === "ar" ? document.titleAr : document.titleEn) || t("list.noTitle");
              const other = locale === "ar" ? document.titleEn : document.titleAr;
              return (
                // Every value is rendered as text, never as HTML (§9).
                <li key={document.id} className="space-y-2 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold wrap-anywhere">
                        <Link
                          href={`${BASE}/${encodeURIComponent(document.id)}`}
                          aria-label={t("list.edit", { title })}
                          className="hover:underline"
                        >
                          {title}
                        </Link>
                      </h2>
                      {other && (
                        // The line starts where the title does; only the text inside is isolated.
                        <p className="text-sm text-text-secondary wrap-anywhere">
                          <span className="sr-only">{t("list.otherTitle")}: </span>
                          <bdi lang={locale === "ar" ? "en" : "ar"}>{other}</bdi>
                        </p>
                      )}
                    </div>
                    <Badge tone={document.status === "published" ? "strong" : "neutral"}>
                      {t(`status.${document.status}`)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                      <span>{tw(`categories.${document.category}`)}</span>
                      <span>{tw(`accessModes.${document.accessMode}`)}</span>
                      <span>
                        {t("list.file")}: {fileTypeLabel(document.mime)}
                      </span>
                    </p>
                    <PublishToggle id={document.id} title={title} status={document.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        </NextIntlClientProvider>
      )}
    </div>
  );
}
