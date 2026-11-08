import { PERMISSIONS } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { loadRows } from "@/components/dashboard/content/data";
import { rowStatus } from "@/components/dashboard/content/form-values";
import {
  listPath,
  LISTED_TYPES,
  parseContentType,
} from "@/components/dashboard/content/registry";
import { TypeList } from "@/components/dashboard/content/type-list";
import { sectionAccess } from "@/components/dashboard/gate";
import { Refusal } from "@/components/dashboard/refusal";
import { Card, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { requireTeamMember } from "@/lib/auth/gates";

type Params = Promise<{ locale: string }>;

export default async function ContentPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  await requireTeamMember(params, "/dashboard/content");
  const access = await sectionAccess(params, PERMISSIONS.CONTENT_MANAGE);
  if (!access.allowed) return <Refusal />;

  // `?type=` opens one type's list; without it, the list of types.
  const type = parseContentType((await searchParams).type);
  if (type) return <TypeList type={type} locale={access.locale} />;

  const [t, lists] = await Promise.all([
    getTranslations("DashboardContent"),
    Promise.all(LISTED_TYPES.map((type) => loadRows(type))),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("list.title")} intro={t("list.intro")} />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {LISTED_TYPES.map((type, index) => {
          const rows = lists[index];
          const published = rows.filter((row) => rowStatus(row) === "published").length;
          return (
            <Card as="li" compact key={type} className="relative">
              <h2 className="text-lg">
                <Link
                  href={listPath(type)}
                  className="after:absolute after:inset-0 hover:underline"
                >
                  {t(`types.${type}`)}
                </Link>
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {t("list.counts", { total: rows.length, published })}
              </p>
            </Card>
          );
        })}
      </ul>
    </div>
  );
}
