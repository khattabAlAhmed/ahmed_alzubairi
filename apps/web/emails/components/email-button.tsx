import { Button, Section } from "@react-email/components";
import type { ReactNode } from "react";
import { CLASSES, COLORS, FONTS } from "./theme";

/**
 * The email's one call to action. Gold with navy text (§13: text on gold is
 * navy), in both color schemes.
 */
export function EmailButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Section style={{ margin: "8px 0 24px" }}>
      <Button
        href={href}
        className={CLASSES.button}
        style={{
          display: "inline-block",
          padding: "12px 28px",
          backgroundColor: COLORS.light.gold,
          borderRadius: 6,
          color: COLORS.light.navy,
          fontFamily: FONTS.text,
          fontSize: 16,
          fontWeight: 700,
          lineHeight: 1.5,
          textDecoration: "none",
        }}
      >
        {children}
      </Button>
    </Section>
  );
}
