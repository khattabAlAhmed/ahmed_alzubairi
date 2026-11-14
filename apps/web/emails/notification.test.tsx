import { render } from "@react-email/render";
import { SITE_NAME } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { EMAIL_FOOTER } from "./defaults";
import { NotificationEmail, paragraphsOf, titleOf } from "./notification";

const base = {
  locale: "en",
  subject: "[Contact message] A question",
  body: "First paragraph.\n\nSecond paragraph,\nsecond line.",
} as const;

describe("NotificationEmail", () => {
  it("renders Arabic right to left, on the html, the body and the container", async () => {
    const html = await render(
      <NotificationEmail locale="ar" subject="[رسالة تواصل] سؤال" body="فقرة أولى." />,
    );
    expect(html).toMatch(/<html[^>]*\slang="ar"/);
    expect(html).toMatch(/<html[^>]*\sdir="rtl"/);
    expect(html).toMatch(/<body[^>]*\sdir="rtl"/);
    expect(html).not.toMatch(/text-align:\s*(left|right)/);
    expect(html).toContain(EMAIL_FOOTER.ar);
    expect(html).toContain(SITE_NAME);
  });

  it("renders English left to right", async () => {
    const html = await render(<NotificationEmail {...base} />);
    expect(html).toMatch(/<html[^>]*\slang="en"/);
    expect(html).toMatch(/<html[^>]*\sdir="ltr"/);
    // React writes the apostrophe as an entity.
    expect(html).toContain(EMAIL_FOOTER.en.replace("'", "&#x27;"));
  });

  it("shows the subject without its tag as the one title", async () => {
    const html = await render(<NotificationEmail {...base} />);
    expect(html.match(/<h1/g)).toHaveLength(1);
    const title = /<h1[\s\S]*?<\/h1>/.exec(html)?.[0] ?? "";
    expect(title).toContain("A question");
    expect(title).not.toContain("[Contact message]");
  });

  it("makes a paragraph of each block and keeps single line breaks", async () => {
    const html = await render(<NotificationEmail {...base} />);
    expect(html.match(/<p [^>]*class="em-text"/g)).toHaveLength(2);
    expect(html).toMatch(/Second paragraph,<br\s*\/?>second line\./);
  });

  it("writes HTML and script in the subject and body as text, escaped", async () => {
    const html = await render(
      <NotificationEmail
        locale="en"
        subject={`[Contact message] <script>alert("s")</script>`}
        body={`From <img src=x onerror="alert(1)"> & <b>co</b>.\n\n<a href="https://evil.example">click</a>`}
      />,
    );
    expect(html).toContain("&lt;script&gt;alert(&quot;s&quot;)&lt;/script&gt;");
    expect(html).toContain("From &lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &lt;b&gt;co&lt;/b&gt;.");
    expect(html).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;click&lt;/a&gt;");
    expect(html).not.toMatch(/<script|<img|<b>|evil\.example">/);
    // No link at all: this email has no button.
    expect(html).not.toContain("<a ");
  });

  it("shows the button only when a link is given, with its label as text", async () => {
    const html = await render(
      <NotificationEmail
        {...base}
        action={{ href: "https://site.example/en/dashboard/messages", label: "View <messages>" }}
      />,
    );
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('href="https://site.example/en/dashboard/messages"');
    expect(html).toContain("View &lt;messages&gt;");
  });

  it("gives a plain-text version with the same words and no markup", async () => {
    const text = await render(<NotificationEmail {...base} />, { plainText: true });
    expect(text).toContain("First paragraph.");
    expect(text).toContain("second line.");
    expect(text).not.toMatch(/<[a-z]/i);
  });
});

describe("titleOf and paragraphsOf", () => {
  it("drops one leading tag, in either language, and keeps a subject that is only a tag", () => {
    expect(titleOf("[رسالة تواصل] سؤال")).toBe("سؤال");
    expect(titleOf("[New reply] [draft] Budget")).toBe("[draft] Budget");
    expect(titleOf("No tag here")).toBe("No tag here");
    expect(titleOf("[Reminder]")).toBe("[Reminder]");
  });

  it("splits on blank lines, whatever the line ending, and drops empty blocks", () => {
    expect(paragraphsOf("One\r\ntwo\r\n\r\n\r\n  \n\nThree\n")).toEqual(["One\ntwo", "Three"]);
    expect(paragraphsOf("   ")).toEqual([]);
  });
});
