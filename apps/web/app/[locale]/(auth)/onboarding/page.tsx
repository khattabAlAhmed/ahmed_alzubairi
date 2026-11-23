import { auth, currentUser } from "@clerk/nextjs/server";
import { LOCALES } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { readOwnProfile } from "@/lib/auth/gates";
import {
  onboardingPath,
  RETURN_PARAM,
  safeReturnPath,
  signInPath,
} from "@/lib/auth/return-path";

/**
 * This request's own origin, from its host, so a same-site absolute
 * `redirect_url` (Clerk's footer links make one) still passes. Never from the
 * value itself.
 */
async function requestOrigin() {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  if (!host) return null;
  const proto = list.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
  return `${proto}://${host}`;
}

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
  const returnPath = safeReturnPath(
    typeof raw === "string" ? raw : null,
    await requestOrigin(),
  );
  const destination = returnPath ?? `/${locale}/account`;

  const { userId } = await auth();
  if (!userId) redirect(signInPath(locale, onboardingPath(locale, returnPath)));
  // Onboarding runs once. With a profile, go straight on.
  if (await readOwnProfile(userId)) redirect(destination);

  const user = await currentUser();
  const [t, steps] = await Promise.all([
    getTranslations("Onboarding"),
    getTranslations("AuthReason.signUp.steps"),
  ]);
  const { Onboarding, Errors } = await getMessages();

  // The second of sign-up's two steps (the SignUp board's next step). The
  // form opens with its own heavy rule, so no box around it.
  return (
    <section aria-labelledby="onboarding-title" className="flex w-full max-w-[44rem] flex-col gap-4">
      <ol aria-label={steps("label")} className="grid grid-cols-2 border-t border-line text-[13px]">
        <li className="py-2.5 text-ink-2">{steps("account")}</li>
        <li aria-current="step" className="py-2.5 text-ink shadow-[inset_0_2px_0_var(--accent)]">
          {steps("details")}
        </li>
      </ol>
      <h1 id="onboarding-title" className="type-h2">
        {t("title")}
      </h1>
      <p className="max-w-measure text-pretty text-ink-2">{t("intro")}</p>
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
