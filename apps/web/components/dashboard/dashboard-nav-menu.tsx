"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { usePathname } from "@/i18n/navigation";
import { buttonClasses } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { ChevronDownIcon } from "@/components/ui/icons";

/**
 * The dashboard menu's frame. The entries come in as `children`, already
 * filtered by permission on the server; this only shows and hides them.
 * From md up the list is a column, always open. On a phone it folds behind a
 * button that names the current section, so it holds any number of entries
 * without a row that scrolls sideways.
 */
export function DashboardNavMenu({
  label,
  children,
}: {
  /** The menu's name, e.g. "Dashboard menu". */
  label: string;
  /** The `<li>` entries. The current one carries `aria-current="page"`. */
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [shownPath, setShownPath] = useState(pathname);
  const navRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  // A new page closes the list.
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(false);
  }

  // The button names the entry the links marked as current.
  useLayoutEffect(() => {
    const link = listRef.current?.querySelector('[aria-current="page"]');
    setCurrent(link?.textContent ?? null);
  }, [pathname, children]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !navRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutside);
    };
  }, [open]);

  // Choosing an entry closes the list, even the page already open.
  const closeOnLink = (event: MouseEvent<HTMLUListElement>) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      setOpen(false);
    }
  };

  return (
    <nav ref={navRef} aria-label={label}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        className={buttonClasses({
          variant: "secondary",
          className: "w-full justify-between md:hidden",
        })}
      >
        {/* The name keeps the visible text and adds which menu it opens. */}
        <span className="min-w-0 truncate">
          {current === null ? (
            label
          ) : (
            <>
              <span className="sr-only">{label}: </span>
              {current}
            </>
          )}
        </span>
        <ChevronDownIcon
          className={cx(
            "shrink-0 transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      <ul
        ref={listRef}
        id={listId}
        onClick={closeOnLink}
        className={cx("mt-2 flex-col gap-1 md:mt-0 md:flex", open ? "flex" : "hidden")}
      >
        {children}
      </ul>
    </nav>
  );
}
