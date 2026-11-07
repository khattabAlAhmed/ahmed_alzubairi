import { SITE_NAME } from "@repo/shared";
import { Link } from "@/i18n/navigation";

export function SiteLogo() {
  return (
    <Link href="/" className="min-w-0 truncate font-heading text-lg font-bold">
      {SITE_NAME}
    </Link>
  );
}
