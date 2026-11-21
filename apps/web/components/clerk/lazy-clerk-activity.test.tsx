// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { Activity, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestClerk, resetAuthStateForTests } from "./auth-state";
import { LazyClerk } from "./lazy-clerk";

// Stands in for `@clerk/nextjs`'s provider: every render claims the global
// navigation function, as `useInternalNavFun` does.
const provider = vi.hoisted(() => ({ renders: 0, mounted: 0 }));
vi.mock("next-intl", () => ({ useLocale: () => "en" }));
vi.mock("./public-clerk", () => ({
  default: function FakePublicClerk() {
    provider.renders += 1;
    useEffect(() => {
      provider.mounted += 1;
      return () => {
        provider.mounted -= 1;
      };
    }, []);
    return null;
  },
}));

afterEach(() => {
  cleanup();
  resetAuthStateForTests();
  provider.renders = 0;
  provider.mounted = 0;
});

// What Next does with the public layout after a client navigation to an
// auth page: it stays mounted, hidden, and may re-render with new props.
function Layout({ mode, version }: { mode: "visible" | "hidden"; version: number }) {
  return (
    <Activity mode={mode}>
      <p>{version}</p>
      <LazyClerk />
    </Activity>
  );
}

describe("LazyClerk in a hidden layout (P8D-T27)", () => {
  it("drops its Clerk provider while hidden, so it can't take over Clerk's navigation", async () => {
    const { rerender } = render(<Layout mode="visible" version={1} />);
    await act(async () => {
      requestClerk();
      await vi.dynamicImportSettled();
    });
    expect(provider.mounted).toBe(1);

    await act(async () => rerender(<Layout mode="hidden" version={2} />));
    const rendersWhenHidden = provider.renders;
    await act(async () => rerender(<Layout mode="hidden" version={3} />));
    expect(provider.mounted).toBe(0);
    expect(provider.renders).toBe(rendersWhenHidden);
  });

  it("brings it back when the layout shows again", async () => {
    const { rerender } = render(<Layout mode="visible" version={1} />);
    await act(async () => {
      requestClerk();
      await vi.dynamicImportSettled();
    });
    await act(async () => rerender(<Layout mode="hidden" version={2} />));
    await act(async () => rerender(<Layout mode="visible" version={3} />));
    expect(provider.mounted).toBe(1);
  });
});
