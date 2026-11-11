import { render } from "@react-email/render";
import { LOCALES, SITE_NAME } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { EmailDetails } from "./email-details";
import { EmailLayout } from "./email-layout";
import { EmailText } from "./email-text";
import { SampleEmail } from "./sample";
import { COLORS } from "./theme";

describe("SampleEmail", () => {
  it("renders Arabic right to left", async () => {
    const html = await render(<SampleEmail locale="ar" />);

    expect(html).toMatch(/<html[^>]*\sdir="rtl"/);
    expect(html).toMatch(/<html[^>]*\slang="ar"/);
    expect(html).toContain(SITE_NAME);
  });

  it("renders English left to right", async () => {
    const html = await render(<SampleEmail locale="en" />);

    expect(html).toMatch(/<html[^>]*\sdir="ltr"/);
    expect(html).toMatch(/<html[^>]*\slang="en"/);
    expect(html).toContain(SITE_NAME);
  });

  it.each(LOCALES)("uses every block in %s", async (locale) => {
    const html = await render(<SampleEmail locale={locale} />);

    expect(html).toContain("<h1");
    expect(html).toContain('href="https://example.com/account/consultations"');
    expect(html).toContain("Google Meet");
    expect(html).toContain("em-panel");
    expect(html).toContain("em-muted");
  });

  it("sets the direction with attributes, never with left or right", async () => {
    const html = await render(<SampleEmail locale="ar" />);

    expect(html).not.toMatch(/text-align:\s*(left|right)/);
    expect(html).not.toMatch(/align="(left|right)"/);
  });

  it("declares both color schemes and keeps light colors inline", async () => {
    const html = await render(<SampleEmail locale="en" />);

    expect(html).toContain('name="color-scheme" content="light dark"');
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain(`background-color:${COLORS.light.surface}`);
    expect(html).toContain(`color:${COLORS.light.text}`);
  });
});

describe("EmailLayout", () => {
  it("shows the preview and footer it is given", async () => {
    const html = await render(
      <EmailLayout locale="en" preview="Preview line" footer="Footer line">
        <EmailText>Body</EmailText>
      </EmailLayout>,
    );

    expect(html).toContain("Preview line");
    expect(html).toContain("Footer line");
  });

  it("has no words of its own without a footer", async () => {
    const text = await render(
      <EmailLayout locale="ar" preview="">
        <EmailText>نص</EmailText>
      </EmailLayout>,
      { plainText: true },
    );

    expect(text.replace(/\s+/g, " ").trim()).toBe(`${SITE_NAME} نص ${SITE_NAME}`);
  });
});

describe("EmailText and EmailDetails", () => {
  it("render input as text, never as HTML", async () => {
    const html = await render(
      <EmailLayout locale="en" preview="">
        <EmailText>{"<script>alert(1)</script>"}</EmailText>
        <EmailDetails
          items={[{ label: "<b>Subject</b>", value: "<img src=x>" }]}
        />
      </EmailLayout>,
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x>");
    expect(html).not.toContain("<b>Subject</b>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders nothing for an empty details list", async () => {
    const html = await render(
      <EmailLayout locale="en" preview="">
        <EmailDetails items={[]} />
      </EmailLayout>,
    );

    expect(html).not.toContain("em-panel\"");
  });
});
