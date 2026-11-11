import { Column, Row, Section } from "@react-email/components";
import { CLASSES, COLORS, FONTS, SIZES } from "./theme";

export type EmailDetail = { label: string; value: string };

/**
 * A label/value list, such as a message's subject and sender. Values are
 * shown as text, and a long one wraps instead of widening the email.
 */
export function EmailDetails({ items }: { items: readonly EmailDetail[] }) {
  if (items.length === 0) return null;

  return (
    <Section
      className={CLASSES.panel}
      style={{
        margin: "0 0 24px",
        backgroundColor: COLORS.light.background,
        borderRadius: SIZES.radius,
      }}
    >
      {items.map(({ label, value }, index) => (
        <Row key={`${index}-${label}`}>
          <Column
            className={CLASSES.muted}
            style={{
              width: "34%",
              padding: cellPadding(index, items.length),
              color: COLORS.light.textSecondary,
              fontFamily: FONTS.text,
              fontSize: 14,
              lineHeight: SIZES.lineHeight,
              verticalAlign: "top",
            }}
          >
            {label}
          </Column>
          <Column
            className={CLASSES.text}
            style={{
              padding: cellPadding(index, items.length),
              color: COLORS.light.text,
              fontFamily: FONTS.text,
              fontSize: 15,
              fontWeight: 600,
              lineHeight: SIZES.lineHeight,
              verticalAlign: "top",
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

/** Even padding around the list, with a smaller gap between its rows. */
function cellPadding(index: number, count: number): string {
  const top = index === 0 ? 16 : 6;
  const bottom = index === count - 1 ? 16 : 6;
  return `${top}px 16px ${bottom}px`;
}
