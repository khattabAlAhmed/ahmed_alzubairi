// @vitest-environment jsdom
import type { TiptapDoc } from "@repo/shared";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RichText, safeHref, splitLead } from "./rich-text";

afterEach(cleanup);

const doc = (...content: unknown[]) => ({ type: "doc", content }) as TiptapDoc;
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const link = (href: string) => ({ type: "link", attrs: { href } });

function html(value: TiptapDoc) {
  return render(<RichText doc={value} />).container;
}

describe("RichText", () => {
  it("renders the StarterKit nodes and marks", () => {
    const container = html(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [text("Values")] },
        p(text("Bold", [{ type: "bold" }]), text(" and "), text("italic", [{ type: "italic" }])),
        { type: "bulletList", content: [{ type: "listItem", content: [p(text("One"))] }] },
        { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [p(text("Three"))] }] },
        { type: "blockquote", content: [p(text("Quote"))] },
        { type: "horizontalRule" },
        p(text("Line"), { type: "hardBreak" }, text("break")),
      ),
    );
    expect(container.querySelector("h2")?.textContent).toBe("Values");
    expect(container.querySelector("strong")?.textContent).toBe("Bold");
    expect(container.querySelector("em")?.textContent).toBe("italic");
    expect(container.querySelector("ul li")?.textContent).toBe("One");
    expect(container.querySelector("ol")?.getAttribute("start")).toBe("3");
    expect(container.querySelector("blockquote")?.textContent).toBe("Quote");
    expect(container.querySelector("hr")).not.toBeNull();
    expect(container.querySelector("br")).not.toBeNull();
  });

  it("drops a script node and everything under it", () => {
    const container = html(doc({ type: "script", content: [text("alert(1)")] }, p(text("Safe"))));
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toBe("Safe");
  });

  it("drops an unknown node, and an iframe or raw HTML node", () => {
    const container = html(
      doc(
        { type: "mysteryWidget", attrs: { html: "<b>x</b>" }, content: [text("hidden")] },
        { type: "iframe", attrs: { src: "https://evil.example" } },
        { type: "html", text: "<img src=x onerror=alert(1)>" },
        p(text("Kept")),
      ),
    );
    expect(container.querySelector("iframe, img, b")).toBeNull();
    expect(container.textContent).toBe("Kept");
  });

  it("shows raw HTML in text as plain characters", () => {
    const container = html(doc(p(text("<script>alert(1)</script><img src=x onerror=alert(1)>"))));
    expect(container.querySelector("script, img")).toBeNull();
    expect(container.textContent).toBe("<script>alert(1)</script><img src=x onerror=alert(1)>");
  });

  it("renders a javascript: link as plain text", () => {
    const container = html(
      doc(
        p(text("click", [link("javascript:alert(1)")])),
        p(text("data", [link("data:text/html;base64,PHNjcmlwdD4=")])),
        p(text("spaced", [link("  JaVaScRiPt:alert(1)")])),
        p(text("relative", [link("/ar/about")])),
      ),
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("clickdataspacedrelative");
  });

  it("links http(s) and mailto, with noopener noreferrer on external links", () => {
    const container = html(
      doc(p(text("site", [link("https://example.com/a")]), text("mail", [link("mailto:contact@example.com")]))),
    );
    const [external, mail] = [...container.querySelectorAll("a")];
    expect(external.getAttribute("href")).toBe("https://example.com/a");
    expect(external.getAttribute("rel")).toBe("noopener noreferrer");
    expect(mail.getAttribute("href")).toBe("mailto:contact@example.com");
    expect(mail.getAttribute("rel")).toBeNull();
  });

  it("starts content headings at h2, since the page owns its h1", () => {
    const container = html(
      doc(
        { type: "heading", attrs: { level: 1 }, content: [text("One")] },
        { type: "heading", attrs: { level: 6 }, content: [text("Six")] },
      ),
    );
    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("h2")?.textContent).toBe("One");
    expect(container.querySelector("h4")?.textContent).toBe("Six");
  });

  it("ignores unknown marks and malformed values", () => {
    const container = html(
      doc(
        p(text("plain", [{ type: "fontColor", attrs: { style: "color:red" } }])),
        p({ type: "text", text: 42 }),
        "not a node",
        null,
      ),
    );
    expect(container.textContent).toBe("plain");
    expect(container.querySelector("[style]")).toBeNull();
  });

  it("stops at a crafted, very deep document", () => {
    let node: Record<string, unknown> = text("deep");
    for (let i = 0; i < 200; i++) node = { type: "blockquote", content: [node] };
    expect(html(doc(node)).textContent).toBe("");
  });
});

describe("safeHref", () => {
  it("allows http, https and mailto only", () => {
    expect(safeHref("http://example.com")?.external).toBe(true);
    expect(safeHref("mailto:a@example.com")?.external).toBe(false);
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("vbscript:x")).toBeNull();
    expect(safeHref("ftp://example.com")).toBeNull();
    expect(safeHref(42)).toBeNull();
  });
});

describe("splitLead", () => {
  it("takes the first paragraph with text as the lead", () => {
    const { lead, rest } = splitLead(
      doc(p(), p(text("Short bio")), { type: "heading", attrs: { level: 2 }, content: [text("Values")] }),
    );
    expect(html(lead!).textContent).toBe("Short bio");
    cleanup();
    expect(html(rest!).textContent).toBe("Values");
  });

  it("returns no rest when only the lead has text", () => {
    expect(splitLead(doc(p(text("Only")))).rest).toBeNull();
  });

  it("returns no lead when there's no paragraph", () => {
    const value = doc({ type: "heading", attrs: { level: 2 }, content: [text("Values")] });
    expect(splitLead(value)).toEqual({ lead: null, rest: value });
  });
});
