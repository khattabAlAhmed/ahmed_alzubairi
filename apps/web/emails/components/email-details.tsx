import { Column, Row, Section } from "@react-email/components";
import type { Locale } from "@repo/shared";
import { CLASSES, COLORS, FONTS, SIZES, TYPE } from "./theme";

export type EmailDetail = { label: string; value: string };

/**
 * A label/value list, such as a message's subject and sender: the record's
 * label column, with a hairline between rows and no box. Values are shown as
 * text, and a long one wraps instead of widening the email.
 */
export function EmailDetails({
  locale,
  items,
}: {
  /** The email's language: sets the type scale and which side the label's gap is on. */
  locale: Locale;
  items: readonly EmailDetail[];
}) {
  const { small } = TYPE[locale];
  // Mail apps ignore logical padding: the gap after the label goes on its end side by hand.
  const labelPadding = locale === "ar" ? "10px 0 10px 16px" : "10px 16px 10px 0";
  if (items.length === 0) return null;

  const cell = {
    padding: "10px 0",
    borderTop: `${SIZES.ruleHair}px solid ${COLORS.light.line}`,
    fontFamily: FONTS.sans,
    verticalAlign: "top",
    ...small,
  } as const;

  return (
    <Section
      className={CLASSES.details}
      style={{
        margin: "8px 0 24px",
        borderBottom: `${SIZES.ruleHair}px solid ${COLORS.light.line}`,
      }}
    >
      {items.map(({ label, value }, index) => (
        <Row key={`${index}-${label}`}>
          <Column
            className={`${CLASSES.muted} ${CLASSES.line}`}
            style={{
              ...cell,
              width: SIZES.labelCol,
              padding: labelPadding,
              color: COLORS.light.ink2,
            }}
          >
            {label}
          </Column>
          <Column
            className={`${CLASSES.text} ${CLASSES.line}`}
            style={{
              ...cell,
              color: COLORS.light.ink,
              fontWeight: 500,
              overflowWrap: "anywhere",
            }}
          >
            {/* A name or title may be in the other language: let it set its own direction. */}
            <span dir="auto">{value}</span>
          </Column>
        </Row>
      ))}
    </Section>
  );
}
