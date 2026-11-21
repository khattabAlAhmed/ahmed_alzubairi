// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import ar from "@/messages/ar/Voice.json";
import en from "@/messages/en/Voice.json";
import { HisSentence } from "./his-sentence";
import { Letter, type LetterContent } from "./letter";
import { SIGNATURE_PLACEHOLDER, Signature } from "./signature";
import { WhyITookIt } from "./why-i-took-it";

afterEach(cleanup);

function wrap(node: ReactNode, locale: "ar" | "en" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ Voice: locale === "ar" ? ar : en }}>
      {node}
    </NextIntlClientProvider>,
  );
}

const content: LetterContent = {
  heading: "A letter to whoever is reading this",
  salutation: "To whoever is reading this,",
  paragraphs: ["First paragraph.", "Second\nline."],
  signOff: "Ahmed Alzubairi",
  signatureUrl: null,
  signatureDarkUrl: null,
  isPlaceholder: true,
};

describe("Letter", () => {
  it("shows the placeholder tag only while isPlaceholder is true", () => {
    wrap(<Letter content={content} />);
    expect(screen.getByText("Placeholder letter and signature")).toBeTruthy();
    cleanup();
    wrap(<Letter content={{ ...content, isPlaceholder: false }} />);
    expect(screen.queryByText("Placeholder letter and signature")).toBeNull();
  });

  it("tags the placeholder in Arabic on Arabic pages", () => {
    wrap(<Letter content={content} />, "ar");
    expect(screen.getByText("نص وتوقيع مؤقتان")).toBeTruthy();
  });

  it("renders the text as text, never HTML, and keeps line breaks", () => {
    const { container } = wrap(
      <Letter content={{ ...content, paragraphs: ["<img src=x onerror=alert(1)><b>bold</b>"] }} />,
    );
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)><b>bold</b>")).toBeTruthy();
  });

  it("is an article named by its heading, with the sign-off and the signature", () => {
    wrap(<Letter content={content} />);
    expect(screen.getByRole("article", { name: content.heading })).toBeTruthy();
    expect(screen.getByText("Ahmed Alzubairi")).toBeTruthy();
    expect(screen.getAllByAltText("Ahmed's signature").length).toBe(2);
  });
});

describe("Signature", () => {
  it("uses the placeholder files until a scan is uploaded, one per theme", () => {
    wrap(<Signature />);
    const [ink, light] = screen.getAllByRole("img") as HTMLImageElement[];
    expect(ink.getAttribute("src")).toBe(SIGNATURE_PLACEHOLDER.ink);
    expect(ink.className).toContain("dark:hidden");
    expect(light.getAttribute("src")).toBe(SIGNATURE_PLACEHOLDER.light);
    expect(light.className).toContain("dark:block");
  });

  it("uses the uploaded scans, and one file when the theme is forced", () => {
    wrap(<Signature inkUrl="https://media.example/ink.png" lightUrl="https://media.example/light.png" theme="dark" />);
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute("src")).toBe("https://media.example/light.png");
  });

  it("never inlines an SVG", () => {
    const { container } = wrap(<Signature />);
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("HisSentence and WhyITookIt", () => {
  it("names his sentence with his name, or labels it in a record", () => {
    wrap(<HisSentence sentence="I stay." />);
    expect(screen.getByText("Ahmed")).toBeTruthy();
    cleanup();
    wrap(<HisSentence variant="inline" sentence="I stay." />);
    expect(screen.getByText("In my words")).toBeTruthy();
  });

  it("is a labelled margin note", () => {
    wrap(<WhyITookIt text="Because no one had asked." />);
    expect(screen.getByRole("complementary", { name: "Why I took this on" })).toBeTruthy();
  });
});
