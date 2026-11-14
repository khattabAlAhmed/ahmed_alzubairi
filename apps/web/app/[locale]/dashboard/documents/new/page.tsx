import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { documentsAccess } from "@/components/dashboard/documents/data";
import { DocumentForm } from "@/components/dashboard/documents/document-form";
import { Refusal } from "@/components/dashboard/refusal";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

/** Upload a new protected document (§6.20). Needs `documents.manage`. */
export default async function NewDocumentPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireTeamMember(params, "/dashboard/documents/new");
  const access = await documentsAccess(params);
  if (!access.allowed) return <Refusal />;

  const [t, all] = await Promise.all([getTranslations("DashboardDocuments.new"), getMessages()]);

  return (
    <div className="space-y-6">
      <ButtonLink href="/dashboard/documents" variant="quiet" size="sm">
        {t("back")}
      </ButtonLink>
      <PageHeader title={t("title")} intro={t("intro")} />
      <Card as="section">
        <NextIntlClientProvider
          locale={access.locale}
          messages={{ DashboardDocuments: all.DashboardDocuments, Workspace: all.Workspace }}
        >
          <DocumentForm />
        </NextIntlClientProvider>
      </Card>
    </div>
  );
}
