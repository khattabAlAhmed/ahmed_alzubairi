import { auth } from "@clerk/nextjs/server";
import { LOCALES } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { DetailsForm } from "@/components/account/details-form";
import { DisableAccount } from "@/components/account/disable-account";
import { LanguageForm } from "@/components/account/language-form";
import { NotifySwitch } from "@/components/account/notify-switch";
import { PasswordForm } from "@/components/account/password-form";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth/gates";
import { readOwnProfileDetails } from "@/lib/profile/read";

/**
 * الملف الشخصي (§6.16): details, language, optional notifications, password,
 * and disabling the account. Team members use this page too; the disable
 * block is hidden for them (the admin handles team accounts).
 */
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await requireProfile(params, "/account/profile");
  const { locale: raw } = await params;
  // requireProfile already sent unknown locales to "not found".
  const locale = LOCALES.find((item) => item === raw) ?? "ar";
  const [{ userId }, t, messages] = await Promise.all([
    auth(),
    getTranslations("AccountProfile"),
    getMessages(),
  ]);
  // requireProfile has checked the session and that the row exists.
  const profile = userId ? await readOwnProfileDetails(userId) : null;
  if (!profile) throw new Error("profile missing after the gate");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} intro={t("intro")} />
      {/* The browser gets only this page's namespace. */}
      <NextIntlClientProvider locale={locale} messages={{ AccountProfile: messages.AccountProfile }}>
        <DetailsForm
          saved={{
            phone: profile.phone,
            orgType: profile.orgType,
            orgName: profile.orgName,
            jobTitle: profile.jobTitle,
            timezone: profile.timezone,
          }}
          fullName={profile.fullName}
          email={profile.email}
        />
        <LanguageForm saved={profile.locale} />
        <NotifySwitch saved={profile.notifyOptional} />
        <PasswordForm />
        {!profile.isMember && <DisableAccount />}
      </NextIntlClientProvider>
    </div>
  );
}
