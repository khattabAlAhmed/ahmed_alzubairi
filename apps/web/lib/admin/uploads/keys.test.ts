import { describe, expect, it } from "vitest";
import { makePendingKey, parsePendingKey } from "./keys";

const UUID = "3f8a7c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b";

describe("upload keys", () => {
  it("makes a pending key with the type's one extension", () => {
    expect(makePendingKey("image/jpeg", UUID)).toBe(`pending/${UUID}.jpg`);
    expect(makePendingKey("application/pdf", UUID)).toBe(`pending/${UUID}.pdf`);
  });

  it("reads a server-made key back to its type and final key", () => {
    expect(parsePendingKey("media", `pending/${UUID}.png`)).toEqual({
      mime: "image/png",
      finalKey: `${UUID}.png`,
    });
  });

  it.each([
    ["no pending folder", `${UUID}.png`],
    ["another folder", `other/${UUID}.png`],
    ["a client name", "pending/logo.png"],
    ["a path escape", `pending/../${UUID}.png`],
    ["a nested path", `pending/${UUID}/x.png`],
    ["a non-canonical extension", `pending/${UUID}.jpeg`],
    ["upper case", `pending/${UUID.toUpperCase()}.png`],
    ["a trailing part", `pending/${UUID}.png.exe`],
    ["an SVG", `pending/${UUID}.svg`],
  ])("refuses %s", (_label, key) => {
    expect(parsePendingKey("media", key)).toBeNull();
  });

  it("refuses an extension the target doesn't take", () => {
    expect(parsePendingKey("media", `pending/${UUID}.docx`)).toBeNull();
    expect(parsePendingKey("resource", `pending/${UUID}.docx`)).not.toBeNull();
  });
});
