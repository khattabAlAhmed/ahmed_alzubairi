import { auth } from "@clerk/nextjs/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { groupRequests, type GroupedRequests } from "@/components/documents/group";
import { DOCUMENTS_PATH } from "@/components/documents/paths";
import { readOwnRequests } from "@/components/documents/read";
import { RequestCard } from "@/components/documents/request-card";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth/gates";
import { pageLocale } from "../consultations/locale";

const GROUPS: (keyof GroupedRequests)[] = ["available", "inProgress", "ended"];

/**
 * "وثائقي المتاحة" (§6.18): the client's requests in three groups. Available
 * ones open in the viewer; in-contact ones link to their chat; ended ones
 * (expired or withdrawn) offer "طلب مجدداً". Read with the client's own token.
 */
export default async function MyDocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireProfile(params, "/account/documents");
  const locale = pageLocale((await params).locale);
  const [{ userId }, t, messages] = await Promise.all([
    auth(),
    getTranslations("AccountDocuments"),
    getMessages(),
  ]);
  if (!userId) throw new Error("no session after the gate");
  const groups = groupRequests(await readOwnRequests(userId, locale));
  const empty = GROUPS.every((group) => groups[group].length === 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        intro={t("intro")}
        actions={
          !empty && (
            <ButtonLink href={DOCUMENTS_PATH} variant="secondary">
              {t("browse")}
            </ButtonLink>
          )
        }
      />
      {empty ? (
        <Card as="section">
          <h2 className="text-xl">{t("empty.title")}</h2>
          <p className="mt-2 max-w-prose text-text-secondary">{t("empty.text")}</p>
          <ButtonLink href={DOCUMENTS_PATH} className="mt-4">
            {t("browse")}
          </ButtonLink>
        </Card>
      ) : (
        <NextIntlClientProvider
          locale={locale}
          messages={{ AccountDocuments: messages.AccountDocuments, Workspace: messages.Workspace }}
        >
          {GROUPS.map((group) =>
            groups[group].length === 0 ? null : (
              <section key={group} aria-labelledby={`documents-${group}`} className="space-y-3">
                <div>
                  <h2 id={`documents-${group}`} className="text-2xl">
                    {t(`groups.${group}`)}
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">{t(`groupsIntro.${group}`)}</p>
                </div>
                <ul className="grid gap-4 md:grid-cols-2">
                  {groups[group].map((request) => (
                    <li key={request.id} className="flex">
                      <RequestCard
                        request={request}
                        group={group}
                        canRequestAgain={"canRequestAgain" in request ? request.canRequestAgain : false}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </NextIntlClientProvider>
      )}
    </div>
  );
}
