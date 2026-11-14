import { auth } from "@clerk/nextjs/server";
import { uuidSchema } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { isOpenable } from "@/components/documents/group";
import { MY_DOCUMENTS_PATH, requestPath } from "@/components/documents/paths";
import { readOwnRequest } from "@/components/documents/read";
import { DocumentViewer } from "@/components/documents/viewer";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth/gates";
import { pageLocale } from "../../consultations/locale";

type Params = Promise<{ locale: string; requestId: string }>;

/**
 * The viewer for one of the client's requests (§6.18). Only a live grant
 * opens; anything else, including someone else's request, gets the same
 * "not available" page or "not found". The open route checks the grant again.
 */
export default async function DocumentViewerPage({ params }: { params: Params }) {
  await requireProfile(params, "/account/documents/[requestId]");
  const { locale: raw, requestId } = await params;
  const locale = pageLocale(raw);
  const id = uuidSchema.safeParse(requestId);
  if (!id.success) notFound();
  const [{ userId }, t, messages] = await Promise.all([
    auth(),
    getTranslations("AccountDocuments.viewer"),
    getMessages(),
  ]);
  if (!userId) throw new Error("no session after the gate");
  const request = await readOwnRequest(userId, id.data, locale);
  if (!request) notFound();

  const back = (
    <ButtonLink href={MY_DOCUMENTS_PATH} variant="quiet" size="sm">
      {t("back")}
    </ButtonLink>
  );

  if (!isOpenable(request)) {
    return (
      <div className="space-y-6">
        {back}
        <Card as="section" role="alert">
          <h1 className="text-2xl">{t("notAvailable")}</h1>
          <p className="mt-2 max-w-prose text-text-secondary">{t("notAvailableText")}</p>
          <ButtonLink href={requestPath([request.documentId])} variant="secondary" className="mt-4">
            {(await getTranslations("AccountDocuments"))("requestAgain")}
          </ButtonLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {back}
      <PageHeader title={request.title} />
      <NextIntlClientProvider locale={locale} messages={{ AccountDocuments: messages.AccountDocuments }}>
        <DocumentViewer
          documentId={request.documentId}
          title={request.title}
          mime={request.mime}
          accessMode={request.accessMode}
        />
      </NextIntlClientProvider>
    </div>
  );
}
