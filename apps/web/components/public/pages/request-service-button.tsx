"use client";

import type { ReactNode } from "react";
import { useLocale } from "next-intl";
import { requestClerk, useAuthState } from "@/components/clerk/auth-state";
import { buttonClasses } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { NEW_CONSULTATION_PATH, SERVICE_PARAM } from "@/components/consultations/paths";
import { RETURN_PARAM } from "@/lib/auth/return-path";

export { SERVICE_PARAM };

/** The consultation form with this service selected, as a path with its query. */
export function serviceRequestPath(serviceSlug: string) {
  return `${NEW_CONSULTATION_PATH}?${new URLSearchParams({ [SERVICE_PARAM]: serviceSlug })}`;
}

/**
 * "اطلب هذه الخدمة" (§6.5). Signed out, it goes through sign-up, and
 * onboarding when needed, and back to the same request (T11's return path).
 * The label comes from the server, so no messages ship to the browser for it.
 */
export function RequestServiceButton({
  serviceSlug,
  label,
  className,
}: {
  serviceSlug: string;
  label: string;
  className?: string;
}) {
  const locale = useLocale();
  // Signed-out first: Clerk loads after the page (§13 Performance).
  const { isSignedIn } = useAuthState();

  const href = isSignedIn
    ? { pathname: NEW_CONSULTATION_PATH, query: { [SERVICE_PARAM]: serviceSlug } }
    : { pathname: "/sign-up", query: { [RETURN_PARAM]: `/${locale}${serviceRequestPath(serviceSlug)}` } };

  return (
    <Link
      href={href}
      onPointerEnter={requestClerk}
      onFocus={requestClerk}
      className={buttonClasses({ size: "lg", className })}
    >
      {label}
    </Link>
  );
}

/** Shown only to a signed-out visitor: the request needs an account (the ServicePage board). */
export function SignedOutNote({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuthState();
  if (isSignedIn) return null;
  return <p className="type-caption text-pretty text-ink-2">{children}</p>;
}
