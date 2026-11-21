"use client";

import { useTranslations } from "next-intl";
import { requestClerk, useAuthState } from "@/components/clerk/auth-state";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";

const CLASSES = cx(
  "inline-flex min-h-11 items-center gap-2 px-3 text-sm whitespace-nowrap text-ink no-underline transition-state hover:bg-surface-hover",
  FOCUS_RING,
);

/**
 * Sign-in or account (the Header board). Clerk loads after the page (§13
 * Performance), so it shows the signed-out link first: always safe, as the
 * sign-in page sends a signed-in visitor on. Pointing at it or focusing it
 * loads Clerk at once. Signed in, a small circle with the first letter of the
 * visitor's own email stands for them.
 *
 * `signedInAs` is for the design-system page only: it draws the signed-in link
 * for that email and ignores the store. Display only: it grants nothing, and
 * nothing on the server reads it. Without it the link follows the store.
 */
export function AuthLink({ className, signedInAs }: { className?: string; signedInAs?: string }) {
  const t = useTranslations("Header");
  const store = useAuthState();
  const { isLoaded, isSignedIn, email } =
    signedInAs === undefined ? store : { isLoaded: true, isSignedIn: true, email: signedInAs };
  const signedIn = isLoaded && isSignedIn;
  const initial = email?.trim().charAt(0).toUpperCase();

  return (
    <Link
      href={signedIn ? "/account" : "/sign-in"}
      onPointerEnter={requestClerk}
      onFocus={requestClerk}
      className={cx(CLASSES, className)}
    >
      {signedIn && initial && (
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-content-center rounded-round bg-surface font-mono text-xs"
        >
          {initial}
        </span>
      )}
      {signedIn ? t("account") : t("signIn")}
    </Link>
  );
}
