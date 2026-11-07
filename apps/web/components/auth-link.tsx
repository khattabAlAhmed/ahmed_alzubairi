"use client";

import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// Client-side, so the public shell stays static.
export function AuthLink() {
  const t = useTranslations("Header");
  const { isSignedIn } = useAuth();

  return (
    <Link
      href={isSignedIn ? "/account" : "/sign-in"}
      className="inline-flex h-9 items-center rounded-md px-2 text-sm font-semibold whitespace-nowrap hover:bg-text/10"
    >
      {isSignedIn ? t("account") : t("signIn")}
    </Link>
  );
}
