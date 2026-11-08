"use client";

import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";

const CLASSES =
  "inline-flex h-9 items-center rounded-md px-2 text-sm font-semibold whitespace-nowrap";

// Client-side, so the public shell stays static.
export function AuthLink() {
  const t = useTranslations("Header");
  const { isLoaded, isSignedIn } = useAuth();

  // Until Clerk loads, a signed-in visitor would see the sign-in link. Hold the
  // space with nothing to click instead.
  if (!isLoaded) {
    return (
      <span aria-hidden="true" className={`${CLASSES} invisible`}>
        {t("signIn")}
      </span>
    );
  }

  return (
    <Link
      href={isSignedIn ? "/account" : "/sign-in"}
      className={cx(CLASSES, "hover:bg-text/10", FOCUS_RING)}
    >
      {isSignedIn ? t("account") : t("signIn")}
    </Link>
  );
}
