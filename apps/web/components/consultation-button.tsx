"use client";

import { useAuth } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { RETURN_PARAM } from "@/lib/auth/return-path";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { CONSULTATION_HREF } from "./nav-items";

// `accent` with `on-accent`: `primary` would vanish on the dark background.
export function ConsultationButton({ className = "" }: { className?: string }) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const { isSignedIn } = useAuth();

  // Signed out, go to sign-up and carry the form along as the destination.
  const href = isSignedIn
    ? CONSULTATION_HREF
    : {
        pathname: "/sign-up",
        query: { [RETURN_PARAM]: `/${locale}${CONSULTATION_HREF}` },
      };

  return (
    <Link
      href={href}
      className={cx(
        "inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-semibold whitespace-nowrap text-on-accent shadow-sm hover:opacity-90",
        FOCUS_RING,
        className,
      )}
    >
      {t("requestConsultation")}
    </Link>
  );
}
