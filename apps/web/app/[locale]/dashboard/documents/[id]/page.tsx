import { uuidSchema } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AccessLog } from "@/components/dashboard/documents/access-log";
import { documentsAccess, loadAccessLog, loadDocument } from "@/components/dashboard/documents/data";
import { DeleteDocument } from "@/components/dashboard/documents/delete-document";
import { DocumentForm } from "@/components/dashboard/documents/document-form";
import { PublishToggle } from "@/components/dashboard/documents/publish-toggle";
import { Refusal } from "@/components/dashboard/refusal";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

type Params = Promise<{ locale: string; id: string }>;

/**
 * One document: edit, publish, its requests, its access log (with
 * `document_requests.decide`) and delete (with `data.delete`). Opens with
 * `documents.manage`; every route checks its own permission again.
 */
export default async function DocumentPage({ params }: { params: Params }) {
  await requireTeamMember(params, "/dashboard/documents/[id]");
  const access = await documentsAccess(params);
  if (!access.allowed) return <Refusal />;
  const { locale } = access;

  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const [t, all, document] = await Promise.all([
    getTranslations("DashboardDocuments"),
    getMessages(),
    loadDocument(id.data),
  ]);
  if (!document) notFound();
  const log = access.canSeeLog ? await loadAccessLog({ documentId: document.id }) : null;
  const title = (locale === "ar" ? document.titleAr : document.titleEn) || t("list.noTitle");

  return (
    <div className="space-y-6">
      <ButtonLink href="/dashboard/documents" variant="quiet" size="sm">
        {t("detail.back")}
      </ButtonLink>
      <NextIntlClientProvider
        locale={locale}
        messages={{ DashboardDocuments: all.DashboardDocuments, Workspace: all.Workspace }}
      >
        <PageHeader
          title={title}
          actions={
            <Badge tone={document.status === "published" ? "strong" : "neutral"}>
              {t(`status.${document.status}`)}
            </Badge>
          }
        />
        <div className="flex flex-wrap items-center gap-3">
          <PublishToggle id={document.id} title={title} status={document.status} />
          <ButtonLink
            href={`/dashboard/document-requests?document=${encodeURIComponent(document.id)}`}
            variant="secondary"
            size="sm"
          >
            {t("detail.requests")}
          </ButtonLink>
        </div>

        <Card as="section" aria-labelledby="document-details">
          <h2 id="document-details" className="mb-4 text-xl">
            {t("detail.edit")}
          </h2>
          {/* Keyed by the saved values, so a refresh after a save resets the form to them. */}
          <DocumentForm key={JSON.stringify(document)} document={document} />
        </Card>

        {log && <AccessLog entries={log} locale={locale} scope="document" />}

        {access.canDelete && (
          <div>
            <DeleteDocument id={document.id} title={title} />
          </div>
        )}
      </NextIntlClientProvider>
    </div>
  );
}
