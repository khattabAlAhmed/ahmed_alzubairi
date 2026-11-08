"use client";

import { useAuth } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import { buttonClasses } from "@/components/ui";
import { CONSULTATION_HREF } from "@/components/nav-items";
import { Link } from "@/i18n/navigation";
import { RETURN_PARAM } from "@/lib/auth/return-path";

/** The query parameter Phase 4's consultation form reads to preselect a service. */
export const SERVICE_PARAM = "service";

/** The consultation request with this service selected, as a path with its query. */
export function serviceRequestPath(serviceId: string) {
  return `${CONSULTATION_HREF}?${new URLSearchParams({ [SERVICE_PARAM]: serviceId })}`;
}

/**
 * "اطلب هذه الخدمة" (§6.5). Signed out, it goes through sign-up, and
 * onboarding when needed, and back to the same request (T11's return path).
 * The label comes from the server, so no messages ship to the browser for it.
 */
export function RequestServiceButton({
  serviceId,
  label,
  className,
}: {
  serviceId: string;
  label: string;
  className?: string;
}) {
  const locale = useLocale();
  const { isSignedIn } = useAuth();

  const href = isSignedIn
    ? { pathname: CONSULTATION_HREF, query: { [SERVICE_PARAM]: serviceId } }
    : { pathname: "/sign-up", query: { [RETURN_PARAM]: `/${locale}${serviceRequestPath(serviceId)}` } };

  return (
    <Link href={href} className={buttonClasses({ size: "lg", className })}>
      {label}
    </Link>
  );
}
