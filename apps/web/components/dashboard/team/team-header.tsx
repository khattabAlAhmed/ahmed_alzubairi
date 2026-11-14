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
        {/* One row of tabs. On a narrow phone the row scrolls inside itself; the page never does. */}
        <ul className="flex gap-1 overflow-x-auto border-b border-text/15">
          {TABS.map((tab) => (
            <li key={tab.key} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={tab.key === current ? "page" : undefined}
                className={cx(
                  "-mb-px inline-flex h-11 items-center rounded-t-md border-b-2 border-transparent px-3 text-sm whitespace-nowrap text-text-secondary hover:bg-text/5 hover:text-text sm:px-4",
                  "aria-[current=page]:border-text aria-[current=page]:font-semibold aria-[current=page]:text-text",
                  FOCUS_RING,
                  // The row clips overflow, so the ring sits inside the tab.
                  "focus-visible:-outline-offset-2",
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
