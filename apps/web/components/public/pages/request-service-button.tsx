"use client";

import { useAuth } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import { buttonClasses } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { RETURN_PARAM } from "@/lib/auth/return-path";

/** The query parameter the consultation form reads to preselect a service. */
export const SERVICE_PARAM = "service";

/** The new-consultation form. */
export const NEW_CONSULTATION_PATH = "/account/consultations/new";

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
  const { isSignedIn } = useAuth();

  const href = isSignedIn
    ? { pathname: NEW_CONSULTATION_PATH, query: { [SERVICE_PARAM]: serviceSlug } }
    : { pathname: "/sign-up", query: { [RETURN_PARAM]: `/${locale}${serviceRequestPath(serviceSlug)}` } };

  return (
    <Link href={href} className={buttonClasses({ size: "lg", className })}>
      {label}
    </Link>
  );
}
