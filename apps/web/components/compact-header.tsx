import type { ReactNode } from "react";
import { LanguageSwitch } from "./language-switch";
import { SiteLogo } from "./site-logo";
import { ThemeSwitch } from "./theme-switch";

/** The top bar for screens without the public menu. */
export function CompactHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-text/10 bg-surface">
      <div className="flex h-14 items-center gap-2 px-4">
        <SiteLogo />
        <div className="ms-auto flex shrink-0 items-center gap-1">
          <LanguageSwitch />
          <ThemeSwitch />
          {children}
        </div>
      </div>
    </header>
  );
}
