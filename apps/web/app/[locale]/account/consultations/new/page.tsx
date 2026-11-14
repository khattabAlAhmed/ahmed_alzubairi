import { auth } from "@clerk/nextjs/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { NewConsultationForm } from "@/components/consultations/new-consultation-form";
import { readServiceOptions } from "@/components/consultations/read";
import { SERVICE_PARAM } from "@/components/public/pages/request-service-button";
import { ButtonLink, PageHeader } from "@/components/ui";
import { requireProfile, withQuery } from "@/lib/auth/gates";
import { readOwnProfileDetails } from "@/lib/profile/read";
import { pageLocale } from "../locale";

/** The `?service=` value, when there is exactly one. */
function serviceParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * "بدء استشارة جديدة" (§6.17). `?service=<slug>` preselects the service. The
 * gate carries the query through sign-in and onboarding, so a service page's
 * request comes back here with its service (§6.16, §6.22).
 */
export default async function NewConsultationPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { params: route, searchParams } = props;
  // `?service` rides along through sign-in and onboarding, and back here.
  const params = withQuery(route, searchParams, [SERVICE_PARAM]);
  await requireProfile(params, "/account/consultations/new");
  const service = serviceParam((await searchParams)[SERVICE_PARAM]);
  const locale = pageLocale((await route).locale);
  const [{ userId }, t, messages, services] = await Promise.all([
    auth(),
    getTranslations("AccountConsultations.form"),
    getMessages(),
    readServiceOptions(locale),
  ]);
  const profile = userId ? await readOwnProfileDetails(userId) : null;
  if (!profile) throw new Error("profile missing after the gate");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        intro={t("intro")}
        actions={
          <ButtonLink href="/account/consultations" variant="secondary" size="sm">
            {t("back")}
          </ButtonLink>
        }
      />
      {services.length === 0 ? (
        <p role="status" className="rounded-lg border border-text/10 bg-surface p-6 text-text-secondary shadow-sm">
          {t("noServices")}
        </p>
      ) : (
        <NextIntlClientProvider
          locale={locale}
          messages={{ AccountConsultations: messages.AccountConsultations, Workspace: messages.Workspace }}
        >
          <NewConsultationForm services={services} initialService={service} organization={profile.orgName} />
        </NextIntlClientProvider>
      )}
    </div>
  );
}
