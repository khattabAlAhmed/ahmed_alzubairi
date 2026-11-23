"use client";

import { useClerk } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useSyncExternalStore } from "react";
import { getPathname } from "@/i18n/navigation";
import { cx } from "@/components/ui/cx";

type Clerk = ReturnType<typeof useClerk>;

/**
 * Whether Clerk has loaded, kept current from Clerk's own status events.
 * `useClerk().loaded` alone isn't enough: after a client navigation from
 * sign-in, a new provider mounts and its Clerk can finish loading before the
 * provider listens, so nothing re-renders. Subscribing here (with `notify`)
 * and re-reading `loaded` after subscribing closes that gap.
 */
function useClerkLoaded(clerk: Clerk): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      clerk.on("status", onChange, { notify: true });
      return () => clerk.off("status", onChange);
    },
    [clerk],
  );
  return useSyncExternalStore(
    subscribe,
    () => clerk.loaded,
    () => false,
  );
}

/**
 * Sign out, for the account and the dashboard. Until Clerk has loaded (before
 * hydration, or just after a client navigation mounts a new provider), the
 * button is shown but marked disabled and ignores clicks, so a click is never
 * silently lost. Only the colour and cursor change, never the size.
 */
export function SignOutButton() {
  const t = useTranslations("Header");
  const clerk = useClerk();
  // Clerk's own button goes to "/", which is always Arabic: send the member
  // to their own language's home instead.
  const home = getPathname({ href: "/", locale: useLocale() });
  const ready = useClerkLoaded(clerk);

  return (
    <button
      type="button"
      aria-disabled={ready ? undefined : "true"}
      onClick={() => {
        // Read it live: the snapshot can trail Clerk by a render.
        if (!clerk.loaded) return;
        void clerk.signOut({ redirectUrl: home });
      }}
      className={cx(
        "inline-flex h-9 items-center px-2 text-sm font-semibold whitespace-nowrap",
        ready ? "hover:bg-ink/10" : "cursor-not-allowed opacity-50",
      )}
    >
      {t("signOut")}
    </button>
  );
}
