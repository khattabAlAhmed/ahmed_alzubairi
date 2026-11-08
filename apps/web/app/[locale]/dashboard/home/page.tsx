import { homeSectionKeySchema, PERMISSIONS } from "@repo/shared";
import { getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { loadRows, mediaBase } from "@/components/dashboard/content/data";
import { sectionAccess } from "@/components/dashboard/gate";
import { HomeEditor, type OpenForm } from "@/components/dashboard/home/home-editor";
import { Refusal } from "@/components/dashboard/refusal";
import { PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { requireTeamMember } from "@/lib/auth/gates";

type Search = {
  section?: string | string[];
  stat?: string | string[];
  created?: string | string[];
};

/** `?section=<key>` or `?stat=<id>` opens that row's form (from `editPath`). */
function openFrom(search: Search, statIds: readonly string[]): OpenForm {
  const section = homeSectionKeySchema.safeParse(search.section);
  if (section.success) return { kind: "section", key: section.data };
  if (typeof search.stat === "string" && statIds.includes(search.stat)) {
    return { kind: "stat", id: search.stat };
  }
  return null;
}

/** Home sections and quick stats (§6.2): edit, hide, reorder, publish. */
export default async function DashboardHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  await requireTeamMember(params, "/dashboard/home");
  const access = await sectionAccess(params, PERMISSIONS.CONTENT_MANAGE);
  if (!access.allowed) return <Refusal />;

  const [t, messages, sections, stats, search] = await Promise.all([
    getTranslations("DashboardHome"),
    getMessages(),
    loadRows("home_sections"),
    loadRows("home_stats"),
    searchParams,
  ]);
  const initialOpen = openFrom(search, stats.map((row) => String(row.id)));

  return (
    <div className="space-y-6">
      <Link href="/dashboard/content" className="text-sm font-semibold underline-offset-4 hover:underline">
        {t("back")}
      </Link>
      <PageHeader title={t("title")} intro={t("intro")} eyebrow={t("eyebrow")} />
      {/* The browser gets only the namespaces the editor uses. */}
      <NextIntlClientProvider
        locale={access.locale}
        messages={{ DashboardContent: messages.DashboardContent, DashboardHome: messages.DashboardHome }}
      >
        <HomeEditor
          sections={sections}
          stats={stats}
          mediaBase={mediaBase()}
          initialOpen={initialOpen}
          justCreated={search.created === "1"}
        />
      </NextIntlClientProvider>
    </div>
  );
}
