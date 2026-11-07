import { describe, expect, it } from "vitest";
import { isActivePath } from "./nav-items";

describe("isActivePath", () => {
  it("matches home only on the exact path", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/about", "/")).toBe(false);
  });

  it("matches a section and its sub-pages", () => {
    expect(isActivePath("/blog", "/blog")).toBe(true);
    expect(isActivePath("/blog/post", "/blog")).toBe(true);
  });

  it("doesn't match a path that only shares the prefix", () => {
    expect(isActivePath("/blogger", "/blog")).toBe(false);
  });
});
