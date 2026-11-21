"use client";

import { useLocale, useTranslations } from "next-intl";
import { requestClerk, useAuthState } from "@/components/clerk/auth-state";
import { Link } from "@/i18n/navigation";
import { RETURN_PARAM } from "@/lib/auth/return-path";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { CONSULTATION_HREF } from "./nav-items";

/**
 * «اطلب استشارة», always within reach (§6.1): the one primary action of the
 * shell. Small in the header, full width in the phone menu, larger in a
 * closing invitation. Signed out, it goes to sign-up and brings the visitor
 * back to the request form.
 */
export function ConsultationButton({
  size = "sm",
  variant = "primary",
  block = false,
  className,
}: {
  size?: ButtonSize;
  /** Primary everywhere but beside another primary action, as in the hero. */
  variant?: ButtonVariant;
  /** Full width, as at the bottom of the phone menu. */
  block?: boolean;
  className?: string;
}) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  // Signed-out first: Clerk loads after the page (§13 Performance).
  const { isSignedIn } = useAuthState();

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
      onPointerEnter={requestClerk}
      onFocus={requestClerk}
      className={buttonClasses({ variant, size, className: cx("no-underline", block && "flex w-full", className) })}
    >
      {t("requestConsultation")}
    </Link>
  );
}
