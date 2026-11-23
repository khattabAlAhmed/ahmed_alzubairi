import { getTranslations } from "next-intl/server";
import { grantedPermissions } from "@/components/dashboard/access";
import { loadSummary, summaryPermissions } from "@/components/dashboard/home/summary";
import { SummaryList } from "@/components/dashboard/home/summary-list";
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
    grantedPermissions(
      [...new Set([...sectionPermissions(), ...summaryPermissions()])],
      locale === "en" ? "en" : "ar",
    ),
  ]);
  // The summary's numbers (§6.20), each only for a member who may read those
  // rows, with their own client (RLS). A failed count leaves its line out.
  const summary = await loadSummary(granted);
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
      <SummaryList items={summary} />
      {sections.length === 0 ? (
        <Card as="section">
          <p className="text-ink-2">{t("home.noSections")}</p>
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
              <p className="mt-1 text-sm text-ink-2">
                {t(`home.sections.${section.key}`)}
              </p>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
