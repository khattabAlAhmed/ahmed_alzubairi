import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import { REGISTRATIONS_PATH, REQUESTS_PATH, TRAINING_BASE } from "./format";

const LINKS = [
  { key: "courses", href: TRAINING_BASE },
  { key: "registrations", href: REGISTRATIONS_PATH },
  { key: "requests", href: REQUESTS_PATH },
] as const;

/** The Training section's three parts (§6.20): courses, registrations, custom requests. */
export function TrainingNav({ current }: { current: (typeof LINKS)[number]["key"] }) {
  const t = useTranslations("DashboardTraining.nav");
  return (
    <nav aria-label={t("label")}>
      <ul className="flex flex-wrap gap-2">
        {LINKS.map((link) => (
          <li key={link.key}>
            <Link
              href={link.href}
              aria-current={current === link.key ? "page" : undefined}
              className={cx(
                "inline-flex h-9 items-center border px-3 text-sm font-semibold",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                current === link.key
                  ? "border-ink bg-ink text-bg"
                  : "border-ink/20 text-ink hover:bg-ink/10",
              )}
            >
              {t(link.key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
