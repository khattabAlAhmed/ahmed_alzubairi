import { describe, expect, it } from "vitest";
import { toTrustRow, trustBlockers } from "./rows";

describe("toTrustRow", () => {
  it("drops the letter path and keeps only whether there is one", () => {
    const result = toTrustRow({ id: "a", authorEn: "Dr. Example", letterKey: "letters/x.pdf" });
    expect(result).toEqual({ row: { id: "a", authorEn: "Dr. Example" }, hasLetter: true });
    expect(JSON.stringify(result)).not.toContain("letters/");
  });

  it("says there is no letter when the key is missing or empty", () => {
    expect(toTrustRow({ id: "a" }).hasLetter).toBe(false);
    expect(toTrustRow({ id: "a", letterKey: "" }).hasLetter).toBe(false);
    expect(toTrustRow({ id: "a", letterKey: null }).hasLetter).toBe(false);
  });
});

describe("trustBlockers", () => {
  it("names the missing consent and the missing approval", () => {
    expect(trustBlockers({})).toEqual(["no_consent", "not_approved"]);
    expect(trustBlockers({ consentConfirmed: true })).toEqual(["not_approved"]);
    expect(trustBlockers({ adminApproved: true })).toEqual(["no_consent"]);
  });

  it("has nothing to say once both are set", () => {
    expect(trustBlockers({ consentConfirmed: true, adminApproved: true })).toEqual([]);
  });
});
