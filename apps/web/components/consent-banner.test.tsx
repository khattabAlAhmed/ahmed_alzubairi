// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import enConsent from "../messages/en/Consent.json";
import { ConsentBanner, ConsentSpacer, COVERED_VAR } from "./consent-banner";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// jsdom has no layout: the banner's top edge is set by hand. The
// ResizeObserver mock keeps its callback and the element it observes, so a
// test can check what is observed and fire the callback.
let bannerTop = 0;
let observed: (() => void) | null = null;
let observedTarget: Element | null = null;

beforeEach(() => {
  bannerTop = window.innerHeight - 120;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ top: bannerTop }) as DOMRect,
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      callback: () => void;
      constructor(callback: () => void) {
        this.callback = callback;
      }
      observe(target: Element) {
        observedTarget = target;
        observed = this.callback;
      }
      disconnect() {
        observed = null;
        observedTarget = null;
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderBanner(open = true) {
  const onAccept = vi.fn();
  const onDecline = vi.fn();
  const result = render(
    <NextIntlClientProvider locale="en" messages={{ Consent: enConsent }}>
      <ConsentBanner open={open} onAccept={onAccept} onDecline={onDecline} privacyHref="/privacy" />
    </NextIntlClientProvider>,
  );
  return { onAccept, onDecline, result };
}

const covered = () => document.documentElement.style.getPropertyValue(COVERED_VAR);

describe("ConsentBanner covered height", () => {
  it("publishes the screen space it covers as a CSS variable on <html>", () => {
    renderBanner();
    expect(covered()).toBe("120px");
  });

  it("measures again when the banner changes size", () => {
    renderBanner();
    expect(observedTarget).toBe(screen.getByRole("region", { name: "Privacy" }));
    bannerTop = window.innerHeight - 78;
    act(() => observed?.());
    expect(covered()).toBe("78px");
  });

  it("measures again when the window is resized", () => {
    renderBanner();
    bannerTop = window.innerHeight - 141;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(covered()).toBe("141px");
  });

  it("publishes nothing when closed", () => {
    renderBanner(false);
    expect(covered()).toBe("");
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("stops observing and clears the variable once closed", () => {
    const view = render(
      <NextIntlClientProvider locale="en" messages={{ Consent: enConsent }}>
        <ConsentBanner open onAccept={() => {}} onDecline={() => {}} privacyHref="/privacy" />
      </NextIntlClientProvider>,
    );
    expect(observed).not.toBeNull();
    expect(observedTarget).toBe(screen.getByRole("region", { name: "Privacy" }));
    view.rerender(
      <NextIntlClientProvider locale="en" messages={{ Consent: enConsent }}>
        <ConsentBanner open={false} onAccept={() => {}} onDecline={() => {}} privacyHref="/privacy" />
      </NextIntlClientProvider>,
    );
    expect(observed).toBeNull();
    expect(observedTarget).toBeNull();
    expect(covered()).toBe("");
  });
});

describe("ConsentSpacer", () => {
  it("is hidden, and shown by CSS only while an unhidden consent wrapper holds a banner", () => {
    const { container } = render(<ConsentSpacer />);
    const spacer = container.querySelector<HTMLElement>("[data-consent-spacer]")!;
    expect(spacer.getAttribute("aria-hidden")).toBe("true");
    expect(spacer.className).toContain("hidden");
    expect(spacer.className).toContain("[body:has([data-consent-banner]:not([hidden])_section)_&]:block");
  });

  it("takes the measured height, with an estimate before it", () => {
    const { container } = render(<ConsentSpacer />);
    const spacer = container.querySelector<HTMLElement>("[data-consent-spacer]")!;
    expect(spacer.className).toContain("h-[var(--consent-covered,9rem)]");
    expect(spacer.className).toContain("sm:h-[var(--consent-covered,6rem)]");
  });
});

describe("ConsentBanner focus after a choice", () => {
  function page() {
    const main = document.createElement("main");
    main.id = "main-content";
    document.body.prepend(main);
    return main;
  }

  afterEach(() => {
    document.querySelector("main")?.remove();
  });

  it.each(["Agree", "No, thanks"])("moves focus to <main> after %s by keyboard, without scrolling", async (name) => {
    const main = page();
    const focus = vi.spyOn(main, "focus");
    const user = userEvent.setup();
    renderBanner();
    screen.getByRole("button", { name }).focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(main);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(main.getAttribute("tabindex")).toBe("-1");
  });

  it("removes the temporary tabindex once focus leaves <main>", async () => {
    const main = page();
    const after = document.createElement("button");
    main.append(after);
    const user = userEvent.setup();
    renderBanner();
    screen.getByRole("button", { name: "Agree" }).focus();
    await user.keyboard("{Enter}");
    after.focus();
    expect(main.hasAttribute("tabindex")).toBe(false);
  });

  it("leaves focus alone when the choice didn't come from inside the banner", () => {
    const main = page();
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    renderBanner();
    fireEvent.click(screen.getByRole("button", { name: "No, thanks" }));
    expect(document.activeElement).toBe(outside);
    expect(main.hasAttribute("tabindex")).toBe(false);
    outside.remove();
  });
});

describe("ConsentBanner choices", () => {
  it("is reached by Tab: privacy link, then decline, then accept (the board's order)", async () => {
    const user = userEvent.setup();
    renderBanner();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "privacy policy" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "No, thanks" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Agree" }));
  });

  it("keeps accept and decline equal, and calls their handlers", () => {
    const { onAccept, onDecline } = renderBanner();
    const accept = screen.getByRole("button", { name: "Agree" });
    const decline = screen.getByRole("button", { name: "No, thanks" });
    expect(accept.className).toBe(decline.className);
    fireEvent.click(accept);
    fireEvent.click(decline);
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onDecline).toHaveBeenCalledOnce();
  });
});
