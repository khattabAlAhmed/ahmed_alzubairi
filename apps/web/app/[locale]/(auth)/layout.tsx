import type { ReactNode } from "react";
import { noindexMetadata } from "@/lib/seo";
import { AppClerkProvider } from "@/components/clerk/app-clerk-provider";
import { LanguageFallbackProvider } from "@/components/language-switch";
import { CONTAINER } from "@/components/public/parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { cx } from "@/components/ui/cx";

// Private pages stay out of search engines (§6.24); child pages inherit it.
export const metadata = noindexMetadata;

/**
 * Sign in, sign up and onboarding sit inside the public site (the SignIn
 * board): the same header and footer, the form on the page grid. Clerk loads
 * here eagerly, since the page is the form.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AppClerkProvider>
      <LanguageFallbackProvider>
        <SiteHeader />
        <main id={MAIN_CONTENT_ID} className={cx(CONTAINER, "flex-1 pt-8 pb-12 md:pt-16 md:pb-8")}>
          {children}
        </main>
        <SiteFooter />
      </LanguageFallbackProvider>
    </AppClerkProvider>
  );
}
