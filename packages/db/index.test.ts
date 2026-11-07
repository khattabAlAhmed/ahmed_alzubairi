import { expect, test } from "vitest";
import pkg from "./package.json";

test("the package is named @repo/db", () => {
  expect(pkg.name).toBe("@repo/db");
});
