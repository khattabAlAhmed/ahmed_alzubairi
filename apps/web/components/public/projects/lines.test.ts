import { describe, expect, it } from "vitest";
import { activityRows, resultLines, textLines } from "./lines";

describe("textLines", () => {
  it("splits, trims, drops blanks and list bullets", () => {
    expect(textLines("- One\n\n• Two \r\n1. Three\n١. أربعة")).toEqual(["One", "Two", "Three", "أربعة"]);
    expect(textLines(null)).toEqual([]);
  });
});

describe("activityRows", () => {
  it("takes a short lead before a colon or dash as the label", () => {
    expect(activityRows("Months 1–2: listening sessions\nالشهر ٣ — ورشتان\nA long sentence: with a colon after many words")).toEqual([
      { label: "Months 1–2", text: "listening sessions" },
      { label: "الشهر ٣", text: "ورشتان" },
      { label: null, text: "A long sentence: with a colon after many words" },
    ]);
  });
});

describe("resultLines", () => {
  it("reads lines that open with a number as figures, and keeps the rest", () => {
    expect(resultLines("70% of reports come through the committees\n٤٠ متطوعاً يعرفون المسار\n2023\nThe path still runs")).toEqual({
      figures: [
        { value: "70%", text: "of reports come through the committees" },
        { value: "٤٠", text: "متطوعاً يعرفون المسار" },
      ],
      rest: ["2023", "The path still runs"],
    });
  });

  it("takes a figure followed by a dash or colon", () => {
    expect(resultLines("1,200 — trainees").figures).toEqual([{ value: "1,200", text: "trainees" }]);
  });
});
