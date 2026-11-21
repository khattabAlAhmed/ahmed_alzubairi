import { SITE_NAME } from "@repo/shared";
import { useTranslations } from "next-intl";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";

/**
 * The text logo (until §14 decision 1): his name as a link home, and on wide
 * screens the line of his fields under it (the Header board).
 */
export function SiteLogo({ fields = false, className }: { fields?: boolean; className?: string }) {
  const t = useTranslations("Header");

  return (
    <Link
      href="/"
      className={cx("flex min-w-0 flex-col justify-center py-3.5 text-ink no-underline", FOCUS_RING, className)}
    >
      <span className="text-[17px] leading-[1.4] font-semibold md:text-[19px]">{SITE_NAME}</span>
      {fields && <span className="hidden text-xs leading-[1.4] text-ink-2 lg:block">{t("fields")}</span>}
    </Link>
  );
}
