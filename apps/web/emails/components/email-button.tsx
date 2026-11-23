import { Button, Section } from "@react-email/components";
import type { Locale } from "@repo/shared";
import type { ReactNode } from "react";
import { CLASSES, COLORS, FONTS, TYPE } from "./theme";

/**
 * The email's one call to action: the accent fill with `on-accent` text,
 * square-cornered, as the site's primary button.
 */
export function EmailButton({
  locale,
  href,
  children,
}: {
  /** The email's language. */
  locale: Locale;
  href: string;
  children: ReactNode;
}) {
  const type = TYPE[locale];

  return (
    <Section style={{ margin: "8px 0 32px" }}>
      <Button
        href={href}
        className={CLASSES.button}
        style={{
          display: "inline-block",
          padding: "12px 24px",
          backgroundColor: COLORS.light.accent,
          borderRadius: 0,
          color: COLORS.light.onAccent,
          fontFamily: FONTS.sans,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: type.small.lineHeight,
          textDecoration: "none",
        }}
      >
        {children}
      </Button>
    </Section>
  );
}
