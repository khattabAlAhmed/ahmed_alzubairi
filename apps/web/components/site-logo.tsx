import { SITE_NAME } from "@repo/shared";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";

/** The site name as a link home, in the heading font. */
export function SiteLogo() {
  return (
    <Link href="/" className={cx("min-w-0 truncate rounded-sm font-heading text-xl font-bold", FOCUS_RING)}>
      {SITE_NAME}
    </Link>
  );
}
