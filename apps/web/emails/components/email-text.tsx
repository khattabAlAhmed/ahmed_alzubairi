import { Text } from "@react-email/components";
import type { ReactNode } from "react";
import { withLineBreaks } from "./line-breaks";
import { CLASSES, COLORS, FONTS, SIZES } from "./theme";

/** A paragraph of body text. Line breaks in a plain-text template are kept. */
export function EmailText({ children }: { children: ReactNode }) {
  return (
    <Text
      className={CLASSES.text}
      style={{
        margin: "0 0 16px",
        color: COLORS.light.text,
        fontFamily: FONTS.text,
        fontSize: 16,
        lineHeight: SIZES.lineHeight,
        overflowWrap: "anywhere",
      }}
    >
      {withLineBreaks(children)}
    </Text>
  );
}
