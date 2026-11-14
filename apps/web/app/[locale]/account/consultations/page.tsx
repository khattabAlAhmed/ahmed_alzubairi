import { auth } from "@clerk/nextjs/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { ConsultationList, NEW_CONSULTATION_HREF } from "@/components/consultations/consultation-list";
import { readOwnConsultations } from "@/components/consultations/read";
import { ButtonLink, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth/gates";
import { pageLocale } from "./locale";

/** "استشاراتي" (§6.17): the client's consultations and "بدء استشارة جديدة". */
export default async function ConsultationsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireProfile(params, "/account/consultations");
  const locale = pageLocale((await params).locale);
  const [{ userId }, t, messages] = await Promise.all([
    auth(),
    getTranslations("AccountConsultations.list"),
    getMessages(),
  ]);
  if (!userId) throw new Error("no session after the gate");
  const consultations = await readOwnConsultations(userId, locale);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        intro={t("intro")}
        actions={consultations.length > 0 && <ButtonLink href={NEW_CONSULTATION_HREF}>{t("new")}</ButtonLink>}
      />
      {/* The status pills' labels only. */}
      <NextIntlClientProvider locale={locale} messages={{ Workspace: messages.Workspace }}>
        <ConsultationList consultations={consultations} />
      </NextIntlClientProvider>
    </div>
  );
}
