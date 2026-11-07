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

function useReturnPath() {
  return safeReturnPath(useSearchParams().get(RETURN_PARAM));
}

// `forceRedirectUrl` wins over Clerk's own `redirect_url` parameter, so only a
// path that passed `safeReturnPath` decides where a user lands.

export function SignInForm() {
  const locale = useLocale();
  const returnPath = useReturnPath();

  return (
    <SignIn
      routing="path"
      path={signInPath(locale)}
      signUpUrl={signUpPath(locale, returnPath)}
      forceRedirectUrl={returnPath ?? `/${locale}/account`}
      signUpForceRedirectUrl={onboardingPath(locale, returnPath)}
    />
  );
}

export function SignUpForm() {
  const locale = useLocale();
  const returnPath = useReturnPath();

  return (
    <SignUp
      routing="path"
      path={signUpPath(locale)}
      signInUrl={signInPath(locale, returnPath)}
      forceRedirectUrl={onboardingPath(locale, returnPath)}
      signInForceRedirectUrl={returnPath ?? `/${locale}/account`}
    />
  );
}
