"use client";

import type { EmailEvent } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import type { EmailTemplateEntry } from "@/lib/admin/email-templates/templates";
import { TemplateEditor } from "./template-editor";

/** True when two entries hold the same texts and the same edited state. */
function sameTemplate(a: EmailTemplateEntry, b: EmailTemplateEntry): boolean {
  return (
    a.event === b.event &&
    a.edited === b.edited &&
    a.subjectAr === b.subjectAr &&
    a.subjectEn === b.subjectEn &&
    a.bodyAr === b.bodyAr &&
    a.bodyEn === b.bodyEn
  );
}

/**
 * Every email the site sends (§6.21), by its name in the page's language,
 * marked as default or edited. One editor is open at a time, and it can't be
 * closed or swapped while it is saving.
 */
export function TemplateBoard({ templates }: { templates: EmailTemplateEntry[] }) {
  const t = useTranslations("DashboardEmailTemplates");
  const headingId = useId();
  const [open, setOpen] = useState<EmailEvent | null>(null);
  // True while the open editor's save or reset is on its way. The editor
  // stays open until it settles, so one event never has two saves in flight.
  const [locked, setLocked] = useState(false);
  // What this tab last saved or reset, per event. The page's copy only
  // changes when router.refresh() lands, and a refresh started by an earlier
  // save can land after a later one. So a saved entry is kept, and wins over
  // the page, until a page copy that matches it arrives; then it is dropped,
  // and the page is followed again (another admin's later change shows).
  const [saved, setSaved] = useState<Partial<Record<EmailEvent, EmailTemplateEntry>>>({});
  const [seenTemplates, setSeenTemplates] = useState(templates);
  if (seenTemplates !== templates) {
    setSeenTemplates(templates);
    const pending = Object.values(saved).filter(
      (entry) => !templates.some((page) => sameTemplate(page, entry)),
    );
    if (pending.length !== Object.keys(saved).length) {
      setSaved(Object.fromEntries(pending.map((entry) => [entry.event, entry])));
    }
  }
  const remember = (entry: EmailTemplateEntry) =>
    setSaved((previous) => ({ ...previous, [entry.event]: entry }));

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h2 id={headingId} className="text-2xl">
        {t("listHeading")}
      </h2>
      <ul className="space-y-3">
        {templates.map((fromPage) => {
          const entry = saved[fromPage.event] ?? fromPage;
          const name = t(`events.${entry.event}`);
          const isOpen = open === entry.event;
          return (
            <Card as="li" compact key={entry.event} className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h3 className="min-w-0 flex-1 basis-48 text-lg">{name}</h3>
                <Badge tone={entry.edited ? "strong" : "neutral"}>
                  {entry.edited ? t("status.edited") : t("status.default")}
                </Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-expanded={isOpen}
                  disabled={locked}
                  aria-label={isOpen ? t("closeLabel", { name }) : t("editLabel", { name })}
                  onClick={() => setOpen(isOpen ? null : entry.event)}
                >
                  {isOpen ? t("close") : t("edit")}
                </Button>
              </div>
              {isOpen && (
                <TemplateEditor entry={entry} onBusyChange={setLocked} onSaved={remember} />
              )}
            </Card>
          );
        })}
      </ul>
    </section>
  );
}
