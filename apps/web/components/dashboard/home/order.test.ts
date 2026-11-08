import { describe, expect, it } from "vitest";
import { moveItem, nextPosition, positionChanges } from "./order";

describe("moveItem", () => {
  it("moves an item up and down", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
  });

  it("leaves the list as it is for an out-of-range move", () => {
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 2)).toEqual(["a", "b"]);
  });
});

describe("positionChanges", () => {
  it("saves only the rows that moved, from position 1", () => {
    const ordered = [
      { id: "hero", position: 1 },
      { id: "expertise", position: 3 },
      { id: "stats", position: 2 },
      { id: "audiences", position: 4 },
    ];
    expect(positionChanges(ordered)).toEqual([
      { id: "expertise", position: 2 },
      { id: "stats", position: 3 },
    ]);
  });

  it("fixes rows that all start at the default position", () => {
    expect(positionChanges([{ id: "a", position: 0 }, { id: "b", position: 0 }])).toEqual([
      { id: "a", position: 1 },
      { id: "b", position: 2 },
    ]);
  });
});

describe("nextPosition", () => {
  it("goes after the last row", () => {
    expect(nextPosition([])).toBe(1);
    expect(nextPosition([{ position: 4 }, { position: 2 }])).toBe(5);
  });
});
