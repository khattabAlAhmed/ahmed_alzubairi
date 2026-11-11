import { Heading } from "@react-email/components";
import type { ReactNode } from "react";
import { CLASSES, COLORS, FONTS, SIZES } from "./theme";

/** The email's title. One per email. */
export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <Heading
      as="h1"
      className={CLASSES.text}
      style={{
        margin: "0 0 16px",
        color: COLORS.light.text,
        fontFamily: FONTS.heading,
        fontSize: 24,
        fontWeight: 700,
        lineHeight: SIZES.headingLineHeight,
      }}
    >
      {children}
    </Heading>
  );
}
