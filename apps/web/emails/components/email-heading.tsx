import { Heading } from "@react-email/components";
import type { Locale } from "@repo/shared";
import type { ReactNode } from "react";
import { CLASSES, COLORS, FONTS, TYPE } from "./theme";

/** The email's title. One per email, weight 500 as the site's headings. */
export function EmailHeading({
  locale,
  children,
}: {
  /** The email's language: Arabic takes its own, larger type scale. */
  locale: Locale;
  children: ReactNode;
}) {
  const { heading } = TYPE[locale];

  return (
    <Heading
      as="h1"
      className={CLASSES.text}
      style={{
        margin: "0 0 24px",
        color: COLORS.light.ink,
        fontFamily: FONTS.sans,
        ...heading,
        overflowWrap: "anywhere",
      }}
    >
      {children}
    </Heading>
  );
}
