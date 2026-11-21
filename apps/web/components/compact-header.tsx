import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { LanguageSwitch } from "./language-switch";
import { SiteLogo } from "./site-logo";
import { ThemeSwitch } from "./theme-switch";

/**
 * The top bar for screens without the public menu (account, dashboard, the
 * design-system page): his name, the language and theme switches, and what the
 * caller adds. The same ground and rule as the public header.
 */
export function CompactHeader({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <header className={cx("border-t-2 border-b border-t-rule border-b-line bg-bg text-ink", className)}>
      {/* At least 56 px; the name wraps rather than being cut off next to the controls. */}
      <div className="flex min-h-14 items-stretch gap-2 px-4">
        <SiteLogo className="min-w-0" />
        <div className="ms-auto flex shrink-0 items-center gap-1">
          <LanguageSwitch />
          <ThemeSwitch />
          {children}
        </div>
      </div>
    </header>
  );
}
