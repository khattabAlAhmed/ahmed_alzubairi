import { Text } from "@react-email/components";
import type { Locale } from "@repo/shared";
import type { ReactNode } from "react";
import { withLineBreaks } from "./line-breaks";
import { CLASSES, COLORS, FONTS, TYPE } from "./theme";

/** A caption in `ink-2` for a side remark, such as why the reader got this email. */
export function EmailNote({
  locale,
  children,
}: {
  /** The email's language: Arabic takes its own, larger type scale. */
  locale: Locale;
  children: ReactNode;
}) {
  const { caption } = TYPE[locale];

  return (
    <Text
      className={CLASSES.muted}
      style={{
        margin: 0,
        color: COLORS.light.ink2,
        fontFamily: FONTS.sans,
        ...caption,
        overflowWrap: "anywhere",
      }}
    >
      {withLineBreaks(children)}
    </Text>
  );
}
