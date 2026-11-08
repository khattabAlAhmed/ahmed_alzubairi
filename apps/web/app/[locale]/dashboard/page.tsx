import { getTranslations } from "next-intl/server";
import { grantedPermissions } from "@/components/dashboard/access";
import {
  sectionPermissions,
  type DashboardSection,
  visibleSections,
} from "@/components/dashboard/sections";
import { Card, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { requireTeamMember } from "@/lib/auth/gates";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await requireTeamMember(params, "/dashboard");
  const { locale } = await params;
  const [t, granted] = await Promise.all([
    getTranslations("DashboardContent"),
    grantedPermissions(sectionPermissions(), locale === "en" ? "en" : "ar"),
  ]);
  const sections = visibleSections(granted).filter(
    (section): section is DashboardSection & { key: Exclude<DashboardSection["key"], "home"> } =>
      section.key !== "home",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("home.title")}
        intro={sections.length > 0 ? t("home.intro") : undefined}
      />
      {sections.length === 0 ? (
        <Card as="section">
          <p className="text-text-secondary">{t("home.noSections")}</p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <Card as="li" compact key={section.key} className="relative">
              <h2 className="text-lg">
                <Link
                  href={section.href}
                  className="after:absolute after:inset-0 hover:underline"
                >
                  {t(`nav.${section.key}`)}
                </Link>
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {t(`home.sections.${section.key}`)}
              </p>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
