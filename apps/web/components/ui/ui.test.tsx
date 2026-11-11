// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Badge } from "./badge";
import { Button, buttonClasses } from "./button";
import { cx } from "./cx";
import { Checkbox, Select, TextArea, TextField } from "./form-field";
import { LanguageTabs } from "./language-tabs";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// jsdom has no matchMedia. Narrow screen: tabs mode.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia;

afterEach(cleanup);

describe("cx", () => {
  it("joins classes and skips empty ones", () => {
    expect(cx("a", false, undefined, null, "", "b")).toBe("a b");
  });
});

describe("buttonClasses", () => {
  it("makes primary gold with navy text", () => {
    const classes = buttonClasses({ variant: "primary" });
    expect(classes).toContain("bg-accent");
    expect(classes).toContain("text-on-accent");
  });

  it("never uses gold as a text color", () => {
    for (const variant of ["primary", "secondary", "quiet"] as const) {
      expect(buttonClasses({ variant })).not.toMatch(/\btext-accent\b/);
    }
  });

  it("has a visible focus ring", () => {
    expect(buttonClasses()).toContain("focus-visible:outline-ring");
  });
});

describe("Button", () => {
  it("is a plain button by default, so it doesn't submit forms", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveProperty("type", "button");
  });

  it("blocks clicks and announces the label while loading", () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Sending" onClick={onClick}>
        Send
      </Button>,
    );
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Sending");
  });
});

describe("Badge", () => {
  it("renders its text", () => {
    render(<Badge tone="strong">منشور</Badge>);
    expect(screen.getByText("منشور")).toBeTruthy();
  });
});

describe("form fields", () => {
  it("ties the label, hint and error to the input", () => {
    render(<TextField label="Email" hint="We reply here." error="Enter a valid email." />);
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const described = (input.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(["We reply here.", "Enter a valid email."]);
  });

  it("announces the error", () => {
    render(<TextArea label="Message" error="Required." />);
    expect(screen.getByRole("alert").textContent).toBe("Required.");
  });

  it("is valid with no error", () => {
    render(<Select label="Type"><option>A</option></Select>);
    const select = screen.getByLabelText("Type");
    expect(select.getAttribute("aria-invalid")).toBeNull();
    expect(select.getAttribute("aria-describedby")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("labels a checkbox", () => {
    render(<Checkbox label="I accept" error="Accept to continue." />);
    const box = screen.getByRole("checkbox", { name: "I accept" });
    expect(box.getAttribute("aria-invalid")).toBe("true");
  });
});

describe("LanguageTabs", () => {
  const tabs = (
    <LanguageTabs
      label="Language"
      invalidLabel="has errors"
      arabic={{ label: "العربية", content: <p>نص</p> }}
      english={{ label: "English", content: <p>Text</p>, invalid: true }}
    />
  );

  it("leaves the panels in the page's language and direction, with each heading in its own language", () => {
    render(tabs);
    for (const [text, lang] of [["نص", "ar"], ["Text", "en"]] as const) {
      const panel = screen.getByText(text).closest("section") as HTMLElement;
      expect(panel.getAttribute("lang")).toBeNull();
      expect(panel.getAttribute("dir")).toBeNull();
      const heading = panel.querySelector("h3") as HTMLElement;
      expect(heading.getAttribute("lang")).toBe(lang);
      // It sits on the UI's start side, with the labels under it.
      expect(heading.getAttribute("dir")).toBeNull();
    }
  });

  it("starts on Arabic and moves with the arrow keys", () => {
    render(tabs);
    const arabic = screen.getByRole("tab", { name: "العربية" });
    expect(arabic.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(arabic, { key: "ArrowLeft" });
    const english = screen.getByRole("tab", { name: /English/ });
    expect(english.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(english);
  });

  it("names an invalid tab for screen readers", () => {
    render(tabs);
    expect(screen.getByRole("tab", { name: "English has errors" })).toBeTruthy();
  });

  it("keeps both panels in the DOM, so a form posts both languages", () => {
    render(tabs);
    expect(screen.getByText("نص")).toBeTruthy();
    expect(screen.getByText("Text")).toBeTruthy();
  });
});

/** The language and direction an element resolves to: its own, or the nearest above it. */
const resolved = (element: Element | null | undefined) => [
  element?.closest("[lang]")?.getAttribute("lang"),
  element?.closest("[dir]")?.getAttribute("dir"),
];

const DIRECTION = { ar: "rtl", en: "ltr" } as const;

describe("fields in a language panel", () => {
  /** One of each field in both panels, on a page in the `ui` language. */
  function renderPanels(ui: "ar" | "en") {
    const fields = (panel: "ar" | "en") => (
      <>
        <TextField label={`title ${panel}`} hint={`title hint ${panel}`} error={`title error ${panel}`} />
        <TextArea label={`summary ${panel}`} hint={`summary hint ${panel}`} error={`summary error ${panel}`} />
        <Checkbox label={`featured ${panel}`} hint={`featured hint ${panel}`} error={`featured error ${panel}`} />
        <TextField label={`address ${panel}`} type="url" dir="ltr" />
        <Select label={`kind ${panel}`}>
          <option>A</option>
        </Select>
      </>
    );
    render(
      <div lang={ui} dir={DIRECTION[ui]}>
        <LanguageTabs
          label="Language"
          arabic={{ label: "العربية", content: fields("ar") }}
          english={{ label: "English", content: fields("en") }}
        />
      </div>,
    );
  }

  describe.each([
    ["ar", "en"],
    ["en", "ar"],
    ["ar", "ar"],
    ["en", "en"],
  ] as const)("%s UI, %s panel", (ui, panel) => {
    it.each(["title", "summary", "featured"])(
      "gives the %s field's label, hint and error the UI's language and direction, and its input the panel's",
      (name) => {
        renderPanels(ui);
        const input = screen.getByLabelText(`${name} ${panel}`);
        expect([input.getAttribute("lang"), input.getAttribute("dir")]).toEqual([panel, DIRECTION[panel]]);

        const label = document.querySelector(`label[for="${input.id}"]`);
        const hint = screen.getByText(`${name} hint ${panel}`);
        const error = screen.getByText(`${name} error ${panel}`);
        for (const text of [label, hint, error]) {
          expect(resolved(text)).toEqual([ui, DIRECTION[ui]]);
          // Nothing of the panel's sits between the text and the page.
          expect(text?.closest("section")?.contains(text.closest("[dir]") ?? null)).toBe(false);
        }
      },
    );

    it("keeps a field's own direction, and leaves a select in the UI's", () => {
      renderPanels(ui);
      const address = screen.getByLabelText(`address ${panel}`);
      expect([address.getAttribute("lang"), address.getAttribute("dir")]).toEqual([panel, "ltr"]);
      // A select's options are UI text.
      expect(resolved(screen.getByLabelText(`kind ${panel}`))).toEqual([ui, DIRECTION[ui]]);
    });
  });

  it("leaves a field outside a panel as it was: no language or direction of its own", () => {
    render(
      <div lang="ar" dir="rtl">
        <TextField label="title" hint="hint" error="error" />
        <TextArea label="summary" />
        <Checkbox label="featured" />
        <TextField label="address" type="url" dir="ltr" />
      </div>,
    );
    for (const name of ["title", "summary", "featured"]) {
      const input = screen.getByLabelText(name);
      expect(input.getAttribute("lang")).toBeNull();
      expect(input.getAttribute("dir")).toBeNull();
    }
    expect(screen.getByLabelText("address").getAttribute("dir")).toBe("ltr");
  });
});
