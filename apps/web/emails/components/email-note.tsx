import { Text } from "@react-email/components";
import type { ReactNode } from "react";
import { withLineBreaks } from "./line-breaks";
import { CLASSES, COLORS, FONTS, SIZES } from "./theme";

/** Small grey text for a side remark, such as why the reader got this email. */
export function EmailNote({ children }: { children: ReactNode }) {
  return (
    <Text
      className={CLASSES.muted}
      style={{
        margin: 0,
        color: COLORS.light.textSecondary,
        fontFamily: FONTS.text,
        fontSize: 13,
        lineHeight: SIZES.lineHeight,
        overflowWrap: "anywhere",
      }}
    >
      {withLineBreaks(children)}
    </Text>
  );
}
