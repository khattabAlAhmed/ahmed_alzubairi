"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";
import { moveItem } from "./order";

type Item = { id: string; name: string };

const ICON_BUTTON = cx(
  "inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-text/15 bg-surface text-text",
  "hover:bg-text/5 disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-wait",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
);

function GripIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="currentColor">
      {[5, 10, 15].flatMap((y) =>
        [7, 13].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />),
      )}
    </svg>
  );
}

/**
 * A list the member can reorder by dragging a row, or with the keyboard alone
 * through each row's move up and move down buttons. Focus stays on the moved
 * row, and a live region says where it went. `onReorder` saves the new order
 * and returns false when it failed: the list then goes back.
 */
export function ReorderList<T extends Item>({
  items,
  label,
  onReorder,
  renderItem,
}: {
  items: readonly T[];
  /** The list's accessible name. */
  label: string;
  onReorder: (ordered: T[]) => Promise<boolean>;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  const t = useTranslations("DashboardHome.order");
  const [pending, setPending] = useState<T[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement | null>());
  const shown = pending ?? items;
  const total = shown.length;

  async function move(from: number, to: number, focus?: "up" | "down") {
    if (saving || from === to || to < 0 || to >= total) return;
    const ordered = moveItem(shown, from, to);
    const moved = ordered[to];
    setPending(ordered);
    setSaving(true);
    setAnnouncement(`${t("moved", { name: moved.name, position: to + 1, total })} ${t("saving")}`);
    if (focus) {
      // At an end, its button disables, so focus moves to the other one.
      const side = (focus === "up" && to === 0) || (focus === "down" && to === total - 1)
        ? (focus === "up" ? "down" : "up")
        : focus;
      requestAnimationFrame(() => buttons.current.get(`${moved.id}:${side}`)?.focus());
    }
    const ok = await onReorder(ordered);
    setSaving(false);
    setPending(null);
    setAnnouncement(ok ? t("saved") : t("failed"));
  }

  function dropOn(event: DragEvent, targetId: string) {
    event.preventDefault();
    const from = shown.findIndex((item) => item.id === dragging);
    const to = shown.findIndex((item) => item.id === targetId);
    setDragging(null);
    setOver(null);
    if (from >= 0 && to >= 0) void move(from, to);
  }

  return (
    <>
      <ol aria-label={label} aria-busy={saving} className="space-y-3">
        {shown.map((item, index) => (
          <li
            key={item.id}
            onDragOver={(event) => {
              if (!dragging) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOver(item.id);
            }}
            onDragLeave={() => setOver((current) => (current === item.id ? null : current))}
            onDrop={(event) => dropOn(event, item.id)}
            className={cx(
              "rounded-lg border bg-surface p-3 sm:p-4",
              over === item.id && dragging !== item.id ? "border-text" : "border-text/10",
              dragging === item.id && "opacity-60",
            )}
          >
            <div className="flex items-start gap-2 sm:gap-3">
              <span
                draggable={!saving}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", item.id);
                  setDragging(item.id);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
                title={t("drag", { name: item.name })}
                // Pointer only: keyboard users have the buttons, so the handle stays out of the tab order.
                aria-hidden="true"
                className="mt-2.5 hidden cursor-grab text-text-secondary active:cursor-grabbing sm:block"
              >
                <GripIcon />
              </span>
              <div className="min-w-0 flex-1">{renderItem(item, index)}</div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  ref={(node) => {
                    buttons.current.set(`${item.id}:up`, node);
                  }}
                  className={ICON_BUTTON}
                  aria-label={t("moveUp", { name: item.name })}
                  disabled={index === 0}
                  aria-disabled={saving || undefined}
                  onClick={() => void move(index, index - 1, "up")}
                >
                  <ChevronDownIcon className="rotate-180" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  ref={(node) => {
                    buttons.current.set(`${item.id}:down`, node);
                  }}
                  className={ICON_BUTTON}
                  aria-label={t("moveDown", { name: item.name })}
                  disabled={index === total - 1}
                  aria-disabled={saving || undefined}
                  onClick={() => void move(index, index + 1, "down")}
                >
                  <ChevronDownIcon aria-hidden="true" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
