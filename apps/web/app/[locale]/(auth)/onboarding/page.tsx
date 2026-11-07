import { auth, currentUser } from "@clerk/nextjs/server";
import { LOCALES } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { readOwnProfile } from "@/lib/auth/gates";
import {
  onboardingPath,
  RETURN_PARAM,
  safeReturnPath,
  signInPath,
} from "@/lib/auth/return-path";

export default async function OnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: value } = await params;
  const locale = LOCALES.find((item) => item === value);
  if (!locale) notFound();

  const raw = (await searchParams)[RETURN_PARAM];
  const returnPath = safeReturnPath(typeof raw === "string" ? raw : null);
  const destination = returnPath ?? `/${locale}/account`;

  const { userId } = await auth();
  if (!userId) redirect(signInPath(locale, onboardingPath(locale, returnPath)));
  // Onboarding runs once. With a profile, go straight on.
  if (await readOwnProfile(userId)) redirect(destination);

  const user = await currentUser();
  const t = await getTranslations("Onboarding");
  const { Onboarding, Errors } = await getMessages();

  return (
    <section className="w-full max-w-lg rounded-lg border border-text/10 bg-surface p-6 shadow-sm">
      <h1 className="text-2xl">{t("title")}</h1>
      <p className="mt-2 text-text-secondary">{t("intro")}</p>
      <NextIntlClientProvider messages={{ Onboarding, Errors }}>
        <OnboardingForm
          destination={destination}
          locale={locale}
          askName={!user?.fullName?.trim()}
        />
      </NextIntlClientProvider>
    </section>
  );
}
