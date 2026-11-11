import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { SITE_NAME, type Locale } from "@repo/shared";
import type { ReactNode } from "react";
import { CLASSES, COLORS, FONTS, HEAD_CSS, SIZES } from "./theme";

const { light } = COLORS;

export type EmailLayoutProps = {
  /** The recipient's language. Sets `lang` and `dir` for the whole email. */
  locale: Locale;
  /** The line a mail app shows next to the subject. */
  preview: string;
  /** The footer line, in the recipient's language. The layout has no words of its own. */
  footer?: string;
  children: ReactNode;
};

/**
 * The frame of every email: a navy header with the site name as a text logo,
 * a white card for the content, and a footer. Blocks inside it take their
 * direction from here, so they set no left or right alignment themselves.
 */
export function EmailLayout({
  locale,
  preview,
  footer,
  children,
}: EmailLayoutProps) {
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <Html lang={locale} dir={dir}>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{HEAD_CSS}</style>
      </Head>
      <Body
        className={CLASSES.body}
        style={{
          margin: 0,
          padding: "24px 12px",
          backgroundColor: light.background,
          fontFamily: FONTS.text,
        }}
      >
        <Preview>{preview}</Preview>
        <Container
          dir={dir}
          style={{ width: "100%", maxWidth: SIZES.width, margin: "0 auto" }}
        >
          <Section>
            <Row>
              <Column
                className={CLASSES.header}
                align="center"
                style={{
                  padding: "24px 20px",
                  backgroundColor: light.navy,
                  borderBottom: `3px solid ${light.gold}`,
                  borderRadius: `${SIZES.radius}px ${SIZES.radius}px 0 0`,
                  textAlign: "center",
                }}
              >
                {/* Ivory on navy in both schemes; `dir` keeps the Latin name whole in an RTL email. */}
                <Text
                  dir="auto"
                  style={{
                    margin: 0,
                    color: light.background,
                    fontFamily: FONTS.heading,
                    fontSize: 22,
                    fontWeight: 700,
                    lineHeight: SIZES.headingLineHeight,
                    letterSpacing: locale === "ar" ? undefined : "0.02em",
                  }}
                >
                  {SITE_NAME}
                </Text>
              </Column>
            </Row>
          </Section>
          <Section>
            <Row>
              <Column
                className={`${CLASSES.card} ${CLASSES.cardPadding}`}
                style={{
                  padding: 32,
                  backgroundColor: light.surface,
                  borderRadius: `0 0 ${SIZES.radius}px ${SIZES.radius}px`,
                }}
              >
                {children}
              </Column>
            </Row>
          </Section>
          <Section>
            <Row>
              <Column align="center" style={{ padding: "20px 20px 0" }}>
                <Text
                  className={CLASSES.muted}
                  style={{
                    margin: 0,
                    color: light.textSecondary,
                    fontFamily: FONTS.text,
                    fontSize: 13,
                    lineHeight: SIZES.lineHeight,
                    textAlign: "center",
                  }}
                >
                  <span dir="auto">{SITE_NAME}</span>
                  {footer ? (
                    <>
                      <br />
                      {footer}
                    </>
                  ) : null}
                </Text>
              </Column>
            </Row>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
