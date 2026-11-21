"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { ConsultationButton } from "./consultation-button";
import { ExternalLinkIcon, MailIcon, WhatsAppIcon } from "./icons";

export type QuickContactChannels = {
  /** The WhatsApp number as set in site settings, and its wa.me link. */
  whatsapp: { number: string; href: string } | null;
  email: string | null;
};

const ROW = "grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-4 py-3.5";

/**
 * Quick contact, always within reach (§6.1, the QuickContact board): a tab at
 * the bottom start corner of every public page that opens a small panel with
 * WhatsApp, the email address and «اطلب استشارة». The number and the address
 * show as text that can be copied, because mailto and wa.me links don't work
 * for everyone. While the consent bar is open, the tab sits above it.
 *
 * It holds no session and loads nothing until opened: the channels come from
 * the server with the page.
 */
export function QuickContact({
  whatsapp,
  email,
  sample = false,
}: QuickContactChannels & {
  /** The design-system page: in place, not fixed, and open from the start. */
  sample?: boolean;
}) {
  const t = useTranslations("Header");
  const [open, setOpen] = useState(sample);
  // Focus moves into the panel only when a person opens it.
  const opened = useRef(false);
  const [copied, setCopied] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    if (opened.current) panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    // A click anywhere else closes it, leaving focus where the click put it.
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !toggle.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  if (!whatsapp && !email) return null;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // No clipboard (an old browser, a denied permission): the address is
      // still there as text to select.
    }
  };

  return (
    <div
      // Above the consent bar while it is open (it publishes the height it covers).
      className={cx(
        "flex flex-col items-start gap-2",
        !sample && "fixed start-4 z-30 bottom-[calc(var(--consent-covered,0px)+16px)]",
      )}
      // Esc acts only while focus is in the panel or on the tab, so it never
      // pulls focus away from elsewhere on the page.
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        toggle.current?.focus();
      }}
    >
      <div
        ref={panel}
        id={id}
        hidden={!open}
        role="dialog"
        aria-label={t("quickContact")}
        className={cx(
          "w-[320px] max-w-[calc(100vw-2rem)] border-t-2 border-rule bg-bg text-ink shadow-overlay",
          // On a short screen it scrolls rather than run off the top: the room
          // above the tab is the screen less the consent bar, the 16px offset,
          // the 44px tab, the 8px gap and 16px at the top.
          !sample && "max-h-[calc(100dvh-var(--consent-covered,0px)-84px)] overflow-y-auto",
        )}
      >
        {whatsapp && (
          <a
            href={whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cx(ROW, "text-ink no-underline transition-state hover:bg-surface-hover", FOCUS_RING, "focus-visible:-outline-offset-2")}
          >
            <WhatsAppIcon />
            <span className="min-w-0">
              <span className="type-small block font-medium">{t("whatsapp")}</span>
              <span dir="ltr" className="block font-mono text-[13px] text-ink-2 [unicode-bidi:isolate]">
                {whatsapp.number}
              </span>
            </span>
            <ExternalLinkIcon width={16} height={16} />
            <span className="sr-only">{t("opensInNewTab")}</span>
          </a>
        )}
        {email && (
          <div className={ROW}>
            <MailIcon />
            <span className="min-w-0">
              <span className="type-small block font-medium">{t("email")}</span>
              <span dir="ltr" className="block truncate font-mono text-[13px] text-ink-2 select-all [unicode-bidi:isolate]">
                {email}
              </span>
            </span>
            <button
              type="button"
              className={buttonClasses({ variant: "quiet", size: "sm", className: "min-h-8" })}
              onClick={() => void copy(email)}
            >
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
        )}
        <p role="status" className="sr-only">
          {copied ? t("copiedAnnounce") : ""}
        </p>
        <div className="p-4">
          <ConsultationButton size="md" block />
        </div>
      </div>
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          opened.current = !open;
          setOpen(!open);
        }}
        className={cx(
          "inline-flex min-h-11 cursor-pointer items-center gap-2 border border-line-strong bg-bg px-3.5 text-sm text-ink transition-state hover:bg-surface-hover",
          FOCUS_RING,
        )}
      >
        <WhatsAppIcon width={18} height={18} />
        {t("quickContact")}
      </button>
    </div>
  );
}
