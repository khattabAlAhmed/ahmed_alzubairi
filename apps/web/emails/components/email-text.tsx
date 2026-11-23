import { Text } from "@react-email/components";
import type { Locale } from "@repo/shared";
import type { ReactNode } from "react";
import { withLineBreaks } from "./line-breaks";
import { CLASSES, COLORS, FONTS, TYPE } from "./theme";

/** A paragraph of body text. Line breaks in a plain-text template are kept. */
export function EmailText({
  locale,
  children,
}: {
  /** The email's language: Arabic takes its own, larger type scale. */
  locale: Locale;
  children: ReactNode;
}) {
  const { body } = TYPE[locale];

  return (
    <Text
      className={CLASSES.text}
      style={{
        margin: "0 0 16px",
        color: COLORS.light.ink,
        fontFamily: FONTS.sans,
        ...body,
        overflowWrap: "anywhere",
      }}
    >
      {withLineBreaks(children)}
    </Text>
  );
}
