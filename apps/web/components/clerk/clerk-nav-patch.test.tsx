// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { Activity, createContext, useContext } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as NavFun from "../../node_modules/@clerk/nextjs/dist/types/app-router/client/useInternalNavFun";

// The real hook, as patched by patches/@clerk__nextjs@7.9.25.patch (P8D-T29).
// It isn't exported, so it's loaded by path: if a Clerk bump moves it, this
// test fails to load, a reminder to recheck the patch.
const { useInternalNavFun } = await vi.importActual<typeof NavFun>(
  "../../node_modules/@clerk/nextjs/dist/esm/app-router/client/useInternalNavFun.js",
);

type Navigation = { fun?: (to: string) => Promise<void> };
declare global {
  interface Window {
    __clerk_internal_navigations?: Record<string, Navigation>;
  }
}

// Stands in for Next's LayoutRouterContext, which `useRouter()` reads in Next
// 16.4: it changes on every navigation and re-renders every consumer, hidden
// trees included, past any memo.
const LayoutContext = createContext(0);
const routed = vi.fn();

/** A layout's Clerk provider, as `@clerk/nextjs` builds it around the hook. */
function FakeClerkProvider({ layout }: { layout: string }) {
  useContext(LayoutContext);
  useInternalNavFun({
    windowNav: () => routed(layout, "window"),
    routerNav: (to) => routed(layout, to),
    name: "push",
  });
  return null;
}

// Two layouts, as after sign-out: account hidden, auth shown. The hidden one
// comes first in the tree, so its background render would come last.
function App({ shown, version }: { shown: "account" | "auth"; version: number }) {
  return (
    <LayoutContext value={version}>
      <Activity mode={shown === "account" ? "visible" : "hidden"}>
        <FakeClerkProvider layout="account" />
      </Activity>
      <Activity mode={shown === "auth" ? "visible" : "hidden"}>
        <FakeClerkProvider layout="auth" />
      </Activity>
    </LayoutContext>
  );
}

const push = (to: string) => window.__clerk_internal_navigations!.push!.fun!(to);

afterEach(() => {
  cleanup();
  routed.mockClear();
  delete window.__clerk_internal_navigations;
});

describe("@clerk/nextjs navigation patch (P8D-T29)", () => {
  it("a hidden layout's provider never takes over Clerk's navigation", async () => {
    const { rerender } = render(<App shown="account" version={1} />);
    await act(async () => rerender(<App shown="auth" version={2} />));
    // Navigations re-render the hidden account provider through context.
    await act(async () => rerender(<App shown="auth" version={3} />));
    await act(async () => rerender(<App shown="auth" version={4} />));

    let settled = false;
    await act(async () => {
      void push("/en/sign-up/verify-email-address").then(() => {
        settled = true;
      });
    });
    expect(routed).toHaveBeenCalledWith("auth", "/en/sign-up/verify-email-address");
    expect(routed).not.toHaveBeenCalledWith("account", expect.anything());
    expect(settled).toBe(true);
  });

  it("goes back to a layout once it shows again", async () => {
    const { rerender } = render(<App shown="account" version={1} />);
    await act(async () => rerender(<App shown="auth" version={2} />));
    await act(async () => rerender(<App shown="account" version={3} />));
    let settled = false;
    await act(async () => {
      void push("/en").then(() => {
        settled = true;
      });
    });
    expect(settled).toBe(true);
    expect(routed).toHaveBeenCalledWith("account", "/en");
    expect(routed).not.toHaveBeenCalledWith("auth", expect.anything());
  });
});
