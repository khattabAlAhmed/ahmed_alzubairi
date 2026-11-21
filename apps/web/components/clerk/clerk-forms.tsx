"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  onboardingPath,
  RETURN_PARAM,
  safeReturnPath,
  signInPath,
  signUpPath,
} from "@/lib/auth/return-path";

/*
 * Clerk's card fills its column beside the reason. Set through `appearance`
 * rather than descendant CSS, which Clerk flags as structural and fragile.
 */
const fillColumn = {
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", maxWidth: "none" },
  },
};

function useReturnPath() {
  return safeReturnPath(useSearchParams().get(RETURN_PARAM));
}

// `forceRedirectUrl` wins over Clerk's own `redirect_url` parameter, so only a
// path that passed `safeReturnPath` decides where a user lands.

/** Clerk's sign-in, themed by `clerkAppearance`. `SignInForm` puts the reason beside it. */
export function ClerkSignIn() {
  const locale = useLocale();
  const returnPath = useReturnPath();

  return (
    <SignIn
      appearance={fillColumn}
      routing="path"
      path={signInPath(locale)}
      signUpUrl={signUpPath(locale, returnPath)}
      forceRedirectUrl={returnPath ?? `/${locale}/account`}
      signUpForceRedirectUrl={onboardingPath(locale, returnPath)}
    />
  );
}

/** Clerk's sign-up. `SignUpForm` puts the steps and the note beside it. */
export function ClerkSignUp() {
  const locale = useLocale();
  const returnPath = useReturnPath();

  return (
    <SignUp
      appearance={fillColumn}
      routing="path"
      path={signUpPath(locale)}
      signInUrl={signInPath(locale, returnPath)}
      forceRedirectUrl={onboardingPath(locale, returnPath)}
      signInForceRedirectUrl={returnPath ?? `/${locale}/account`}
    />
  );
}
