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
import { CLASSES, COLORS, FONTS, HEAD_CSS, SIZES, TYPE } from "./theme";

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
 * The frame of every email, in the record's look: a plain ground, the 2px
 * rule that opens the email, the site name under it, the content, and a
 * footer after a hairline. Square corners, no boxes, no shadow. Blocks inside
 * take their direction from here, so they set no left or right alignment.
 */
export function EmailLayout({
  locale,
  preview,
  footer,
  children,
}: EmailLayoutProps) {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const type = TYPE[locale];

  return (
    <Html lang={locale} dir={dir}>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{HEAD_CSS}</style>
      </Head>
      {/* Some mail apps drop `<html>`: the body and the container repeat its language and direction. */}
      <Body
        lang={locale}
        dir={dir}
        className={CLASSES.body}
        style={{
          margin: 0,
          padding: "24px 0",
          backgroundColor: light.bg,
          fontFamily: FONTS.sans,
        }}
      >
        <Preview>{preview}</Preview>
          <Container
            lang={locale}
            dir={dir}
            style={{ width: "100%", maxWidth: SIZES.width, margin: "0 auto" }}
          >
            <Section>
              <Row>
                <Column className={CLASSES.page} style={{ padding: "0 24px" }}>
                  <Text
                    className={`${CLASSES.text} ${CLASSES.rule}`}
                    style={{
                      margin: 0,
                      padding: "16px 0 0",
                      borderTop: `${SIZES.ruleHeavy}px solid ${light.rule}`,
                      color: light.ink,
                      fontFamily: FONTS.sans,
                      fontSize: 17,
                      fontWeight: 500,
                      lineHeight: type.small.lineHeight,
                    }}
                  >
                    {/* The line takes the email's direction; `dir` keeps the Latin name whole in RTL. */}
                    <span dir="auto" translate="no">{SITE_NAME}</span>
                  </Text>
                </Column>
              </Row>
            </Section>
            <Section>
              <Row>
                <Column className={CLASSES.page} style={{ padding: "40px 24px 16px" }}>
                  {children}
                </Column>
              </Row>
            </Section>
            <Section>
              <Row>
                <Column className={CLASSES.page} style={{ padding: "0 24px" }}>
                  <Text
                    className={`${CLASSES.muted} ${CLASSES.line}`}
                    style={{
                      margin: 0,
                      padding: "16px 0 0",
                      borderTop: `${SIZES.ruleHair}px solid ${light.line}`,
                      color: light.ink2,
                      fontFamily: FONTS.sans,
                      ...type.caption,
                    }}
                  >
                    <span dir="auto" translate="no">{SITE_NAME}</span>
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
