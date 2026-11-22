"use client";

import type { DocumentCategory } from "@repo/shared";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { RequestButton, SelectBox } from "@/components/documents/request-provider";
import { LockIcon } from "@/components/icons";
import { TAB_LIST, tabClasses } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import type { ListedDocument } from "./documents-list";

/** `count` is already formatted for the locale. */
export type CategoryTab = { category: DocumentCategory; label: string; count: string };

const ALL = "all";

/**
 * The document list under its category tabs (DocumentItem board). Real tabs:
 * a tablist with one tab per category that has documents, arrow keys move
 * between them, and one tabpanel shows the chosen category's rows. The
 * selection lives in the request provider above, so it survives switching
 * tabs, and the dialog lists every chosen document, hidden ones included.
 */
export function DocumentTabs({
  documents,
  categories,
  labels,
}: {
  documents: ListedDocument[];
  categories: CategoryTab[];
  labels: { tabs: string; all: string; list: string };
}) {
  const id = useId();
  const [active, setActive] = useState<DocumentCategory | typeof ALL>(ALL);
  const tabs = [
    { key: ALL, text: labels.all, count: null },
    ...categories.map((item) => ({ key: item.category, text: item.label, count: item.count })),
  ];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const categoryLabel = new Map(categories.map((item) => [item.category, item.label]));
  const shown = active === ALL ? documents : documents.filter((document) => document.category === active);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    // Arrow keys follow the reading direction: in Arabic, left is "next".
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[event.key];
    let next: number | null = null;
    if (step !== undefined) next = (index + step + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    setActive(tabs[next].key as DocumentCategory | typeof ALL);
    refs.current[next]?.focus();
  }

  const showTabs = categories.length > 1;
  const panelId = `${id}-panel`;

  return (
    <div className="flex flex-col gap-4">
      {showTabs && (
        <div role="tablist" aria-label={labels.tabs} className={TAB_LIST}>
          {tabs.map((tab, index) => {
            const selected = tab.key === active;
            return (
              <button
                key={tab.key}
                ref={(element) => {
                  refs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`${id}-tab-${tab.key}`}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(tab.key as DocumentCategory | typeof ALL)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={tabClasses(selected)}
              >
                {tab.text}
                {/* A count of its own, not "· ١": a middle dot beside Arabic digits reads as a zero. */}
                {tab.count && <span className="text-ink-2 tabular-nums">{tab.count}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div
        id={panelId}
        {...(showTabs
          ? { role: "tabpanel", "aria-labelledby": `${id}-tab-${active}`, tabIndex: 0 }
          : { role: "group", "aria-label": labels.list })}
        className="focus-ring focus-visible:outline-offset-4"
      >
        {/* DocumentItem board: rows under the 2px rule; a chosen row takes the accent wash. */}
        <ul className="border-t-2 border-rule">
          {shown.map((document) => (
            <li
              key={document.id}
              className={cx(
                "grid grid-cols-[24px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-b border-line px-1 py-3.5 transition-state has-[:checked]:bg-accent-wash",
                "sm:grid-cols-[24px_28px_minmax(0,1fr)_auto] md:grid-cols-[24px_28px_minmax(0,1fr)_200px_auto]",
              )}
            >
              <SelectBox id={document.id} title={document.title} />
              <LockIcon aria-hidden="true" className="hidden size-5.5 text-ink-2 sm:block" />
              <span className="min-w-0 text-pretty text-[18px] leading-[1.6] font-semibold wrap-anywhere">{document.title}</span>
              <span className="hidden text-ink-2 type-small md:block">
                {categoryLabel.get(document.category)}
              </span>
              <div className="col-start-2 sm:col-start-auto">
                <RequestButton id={document.id} title={document.title} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
