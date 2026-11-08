"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { MoonIcon, SunIcon } from "./icons";

const ICON_BUTTON = cx(
  "inline-flex size-9 items-center justify-center rounded-md hover:bg-text/10",
  FOCUS_RING,
);

export function ThemeSwitch() {
  const t = useTranslations("Header");
  const { resolvedTheme, setTheme } = useTheme();

  // CSS picks the icon, so the first paint is right before React hydrates.
  return (
    <button
      type="button"
      className={ICON_BUTTON}
      aria-label={t("switchTheme")}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <MoonIcon className="dark:hidden" />
      <SunIcon className="hidden dark:block" />
    </button>
  );
}
