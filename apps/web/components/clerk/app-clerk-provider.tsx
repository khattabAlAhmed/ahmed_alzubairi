import { ClerkProvider } from "@clerk/nextjs";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import { clerkAppearance } from "@/lib/auth/appearance";
import { clerkLocalization } from "@/lib/auth/localization";
import { signInPath, signUpPath } from "@/lib/auth/return-path";
import { AuthBridge } from "./auth-bridge";
import { VisibleClerk } from "./visible-clerk";

/**
 * Clerk for account, dashboard, sign-in, sign-up and onboarding, loaded with
 * the page as before. Public pages load it lazily instead (`LazyClerk`).
 */
export async function AppClerkProvider({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const { Clerk } = await getMessages();
  // `VisibleClerk`: a layout Next keeps hidden must not re-render its Clerk
  // provider (P8D-T27).
  return (
    <VisibleClerk>
      <ClerkProvider
        localization={clerkLocalization(locale, Clerk)}
        appearance={clerkAppearance}
        signInUrl={signInPath(locale)}
        signUpUrl={signUpPath(locale)}
        afterSignOutUrl={`/${locale}`}
      >
        <AuthBridge />
        {children}
      </ClerkProvider>
    </VisibleClerk>
  );
}
