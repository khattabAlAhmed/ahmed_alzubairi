/** Moves the item at `from` to `to`. Out-of-range moves return the list unchanged. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** The position an item gets at `index`. Positions start at 1, as in the seed. */
export function positionAt(index: number): number {
  return index + 1;
}

export type PositionChange = { id: string; position: number };

/**
 * The rows whose `position` must change for the list to read in this order.
 * Rows already at their place are left out, so a move saves only what moved.
 */
export function positionChanges(
  ordered: readonly { id: string; position: number }[],
): PositionChange[] {
  return ordered.flatMap((item, index) =>
    item.position === positionAt(index) ? [] : [{ id: item.id, position: positionAt(index) }],
  );
}

/** The position a new row gets: after the last one. */
export function nextPosition(items: readonly { position: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.position), 0) + 1;
}
