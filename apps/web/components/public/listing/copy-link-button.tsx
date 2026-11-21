"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui/cx";
import { CheckIcon, LinkIcon } from "./icons";

type State = "idle" | "copied" | "failed";

/**
 * Copies `url` with the Clipboard API. The labels come from the server parent,
 * so this island needs no message bundle. The result is announced politely.
 */
export function CopyLinkButton({
  url,
  labels,
  className,
}: {
  url: string;
  labels: { copy: string; copied: string; failed: string };
  className?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const attempts = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    // Only the latest click may set the state: an earlier one that finishes
    // late must not hide this one's result.
    const attempt = ++attempts.current;
    let ok = true;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      ok = false;
    }
    if (attempt !== attempts.current) return;
    clearTimeout(timer.current);
    setState(ok ? "copied" : "failed");
    // A failure stays: the visitor needs time to copy the link by hand.
    if (ok) timer.current = setTimeout(() => setState("idle"), 3000);
  }

  return (
    <>
      <button type="button" onClick={copy} className={className}>
        {labels.copy}
        <LinkIcon aria-hidden="true" className="size-4 text-ink-2" />
      </button>
      {/* The result as its own line: a check and words, or the link to copy by hand. */}
      <span
        role="status"
        className={cx(
          "flex items-center gap-1.5 text-sm",
          state === "idle" ? "sr-only" : "min-h-11 border-b border-line",
          state === "copied" && "text-success",
          state === "failed" && "flex-wrap py-2 text-ink-2",
        )}
      >
        {state === "copied" && (
          <>
            <CheckIcon aria-hidden="true" className="size-3.5" />
            {labels.copied}
          </>
        )}
        {/* The link itself, so it can be copied by hand: the address bar may hold a different URL. */}
        {state === "failed" && (
          <>
            {labels.failed}{" "}
            <span dir="ltr" className="select-all font-mono text-xs break-all text-ink">
              {url}
            </span>
          </>
        )}
      </span>
    </>
  );
}
