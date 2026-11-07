import { SITE_NAME } from "@repo/shared";
import { expect, test } from "vitest";

test("the app can import from @repo/shared", () => {
  expect(SITE_NAME.length).toBeGreaterThan(0);
});
