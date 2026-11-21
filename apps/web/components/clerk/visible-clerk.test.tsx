// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { Activity } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VisibleClerk } from "./visible-clerk";

// Stands in for `@clerk/nextjs`'s provider: every render claims the global
// navigation function, as `useInternalNavFun` does.
const providerRendered = vi.fn();
function FakeClerkProvider({ version }: { version: number }) {
  providerRendered();
  return <p data-testid="provider">{version}</p>;
}

afterEach(() => {
  cleanup();
  providerRendered.mockClear();
});

// What Next does with an account or auth layout after a client navigation
// away from it: it stays mounted, hidden, and re-renders on a router refresh.
function Layout({ mode, version }: { mode: "visible" | "hidden"; version: number }) {
  return (
    <Activity mode={mode}>
      <VisibleClerk>
        <FakeClerkProvider version={version} />
      </VisibleClerk>
    </Activity>
  );
}

describe("VisibleClerk (P8D-T27)", () => {
  it("renders its provider while shown", async () => {
    const { rerender } = render(<Layout mode="visible" version={1} />);
    await act(async () => rerender(<Layout mode="visible" version={2} />));
    expect(screen.getByTestId("provider").textContent).toBe("2");
  });

  it("doesn't re-render a hidden provider, so it can't take over Clerk's navigation", async () => {
    const { rerender } = render(<Layout mode="visible" version={1} />);
    await act(async () => rerender(<Layout mode="hidden" version={2} />));
    const rendersWhenHidden = providerRendered.mock.calls.length;
    await act(async () => rerender(<Layout mode="hidden" version={3} />));
    await act(async () => rerender(<Layout mode="hidden" version={4} />));
    expect(providerRendered).toHaveBeenCalledTimes(rendersWhenHidden);
  });

  it("renders the latest children once shown again", async () => {
    const { rerender } = render(<Layout mode="visible" version={1} />);
    await act(async () => rerender(<Layout mode="hidden" version={2} />));
    await act(async () => rerender(<Layout mode="hidden" version={3} />));
    await act(async () => rerender(<Layout mode="visible" version={4} />));
    expect(screen.getByTestId("provider").textContent).toBe("4");
  });
});
