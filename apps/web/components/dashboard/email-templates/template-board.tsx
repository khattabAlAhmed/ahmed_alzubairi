"use client";

import type { EmailEvent } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import type { EmailTemplateEntry } from "@/lib/admin/email-templates/templates";
import { TemplateEditor } from "./template-editor";

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
  // What this tab last saved or reset, per event, against the page's copy it
  // was saved over. `templates` only changes when router.refresh() lands, so
  // until then an editor reopened here starts from the saved text, not the
  // old copy. A new `templates` is newer than any of these, so it wins.
  const [stored, setStored] = useState<{
    over: EmailTemplateEntry[];
    byEvent: Partial<Record<EmailEvent, EmailTemplateEntry>>;
  }>({ over: templates, byEvent: {} });
  const current = stored.over === templates ? stored.byEvent : {};
  const remember = (entry: EmailTemplateEntry) =>
    setStored((previous) => ({
      over: templates,
      byEvent: {
        ...(previous.over === templates ? previous.byEvent : {}),
        [entry.event]: entry,
      },
    }));

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h2 id={headingId} className="text-2xl">
        {t("listHeading")}
      </h2>
      <ul className="space-y-3">
        {templates.map((fromPage) => {
          const entry = current[fromPage.event] ?? fromPage;
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
