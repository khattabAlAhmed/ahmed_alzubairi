import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CONSULTATION_HREF } from "./nav-items";

// `accent` with `on-accent`: `primary` would vanish on the dark background.
export function ConsultationButton({ className = "" }: { className?: string }) {
  const t = useTranslations("Nav");

  return (
    <Link
      href={CONSULTATION_HREF}
      className={`inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-semibold whitespace-nowrap text-on-accent shadow-sm hover:opacity-90 ${className}`}
    >
      {t("requestConsultation")}
    </Link>
  );
}
