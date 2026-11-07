import type { ReactNode } from "react";
import { CompactHeader } from "@/components/compact-header";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <CompactHeader />
      <main
        id={MAIN_CONTENT_ID}
        className="flex flex-1 items-start justify-center p-4 sm:items-center"
      >
        {children}
      </main>
    </>
  );
}
