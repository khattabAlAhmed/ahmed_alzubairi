"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { MoonIcon, ScreenIcon, SunIcon } from "./icons";

/** Device default, light, dark: the order the header button goes round in. */
export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

const ICONS = { system: ScreenIcon, light: SunIcon, dark: MoonIcon } as const;

const noSubscription = () => () => {};

/**
 * The saved choice once the page runs in the browser, or null before that:
 * the server can't know it, so both renders start from the same button.
 */
function useThemeChoice(): [ThemeChoice | null, (choice: ThemeChoice) => void] {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noSubscription, () => true, () => false);
  const choice = THEME_CHOICES.find((option) => option === theme) ?? "system";
  return [mounted ? choice : null, setTheme];
}

/** The next choice round the cycle. */
export function nextTheme(choice: ThemeChoice): ThemeChoice {
  return THEME_CHOICES[(THEME_CHOICES.indexOf(choice) + 1) % THEME_CHOICES.length] ?? "system";
}

/**
 * The header's theme button (the LanguageAndTheme board): one button that goes
 * round device, light and dark, and says its state in its name. The choice is
 * saved (§6.1); the default follows the device.
 */
export function ThemeSwitch({ withText = false, className }: { withText?: boolean; className?: string }) {
  const t = useTranslations("Header");
  const [choice, setChoice] = useThemeChoice();
  const shown = choice ?? "system";
  const Icon = ICONS[shown];
  const name = t(`themeButton.${shown}`);

  return (
    <button
      type="button"
      className={cx(
        "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 text-ink transition-state hover:bg-surface-hover",
        withText && "px-3 text-sm",
        FOCUS_RING,
        className,
      )}
      aria-label={withText ? undefined : name}
      onClick={() => setChoice(nextTheme(shown))}
    >
      <Icon />
      {withText && <span>{name}</span>}
    </button>
  );
}

/**
 * The three-way switch for settings and the design-system page: one pressed
 * button per choice.
 */
export function ThemeChoiceSwitch() {
  const t = useTranslations("Header");
  const [choice, setChoice] = useThemeChoice();

  return (
    <div role="group" aria-label={t("themeLabel")} className="inline-flex border border-line-strong">
      {THEME_CHOICES.map((option) => {
        const Icon = ICONS[option];
        const pressed = choice === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={choice === null ? undefined : pressed}
            onClick={() => setChoice(option)}
            className={cx(
              "inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 text-[13px] transition-state not-first:border-s not-first:border-line-strong",
              pressed ? "bg-ink text-bg" : "text-ink-2 hover:text-ink",
              FOCUS_RING,
            )}
          >
            <Icon width={16} height={16} />
            {t(`theme.${option}`)}
          </button>
        );
      })}
    </div>
  );
}
