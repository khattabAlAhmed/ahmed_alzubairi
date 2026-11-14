import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";

export type TeamTab = "members" | "roles" | "audit";

const TABS: { key: TeamTab; href: string }[] = [
  { key: "members", href: "/dashboard/team" },
  { key: "roles", href: "/dashboard/team/roles" },
  { key: "audit", href: "/dashboard/team/audit" },
];

/** The Team section's title and its three sub-pages. Each is its own page and address. */
export async function TeamHeader({ current }: { current: TeamTab }) {
  const t = await getTranslations("DashboardTeam");

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} intro={t("intro")} />
      <nav aria-label={t("tabs.label")}>
        <ul className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={tab.key === current ? "page" : undefined}
                className={cx(
                  "inline-flex h-10 items-center rounded-md border border-text/20 px-4 text-sm hover:bg-text/5",
                  "aria-[current=page]:border-text aria-[current=page]:bg-text aria-[current=page]:font-semibold aria-[current=page]:text-background",
                  FOCUS_RING,
                )}
              >
                {t(`tabs.${tab.key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
