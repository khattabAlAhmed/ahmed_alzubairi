"use client";

import { homeSectionKeySchema, type HomeSectionKey, type Locale } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Badge, Button, Card, Checkbox, SectionHeading } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useFieldText } from "../content/field-text";
import { rowStatus, rowTitle, type Row } from "../content/form-values";
import { saveContent } from "../content/save";
import { nextPosition, positionChanges } from "./order";
import { ReorderList } from "./reorder-list";
import { SectionEditor } from "./section-editor";
import { StatEditor } from "./stat-editor";

/** The one form open on the page. One at a time, so ids and focus stay simple. */
export type OpenForm =
  | { kind: "section"; key: HomeSectionKey }
  | { kind: "stat"; id: string }
  | { kind: "newStat" }
  | null;

type SectionItem = { id: HomeSectionKey; name: string; position: number; row: Row };
type StatItem = { id: string; name: string; position: number; row: Row };

/**
 * Saves a new order: one PATCH per row whose position changed, through the
 * content API (it checks the permission, writes the audit log and refreshes the
 * home cache). Stops at the first failure.
 */
async function saveOrder(
  type: "home_sections" | "home_stats",
  ordered: readonly { id: string; position: number }[],
): Promise<boolean> {
  for (const change of positionChanges(ordered)) {
    const ref = type === "home_sections" ? { key: change.id } : { id: change.id };
    const result = await saveContent(type, { ...ref, position: change.position }, false);
    if (!result.ok) return false;
  }
  return true;
}

function StatusBadges({ row, hidden }: { row: Row; hidden?: boolean }) {
  const text = useFieldText();
  const t = useTranslations("DashboardHome");
  const status = rowStatus(row);
  return (
    <span className="flex flex-wrap gap-1.5">
      <Badge tone={status === "published" ? "strong" : "neutral"}>{text.t(`status.${status}`)}</Badge>
      {hidden && <Badge>{t("sections.hiddenBadge")}</Badge>}
    </span>
  );
}

function ToggleButton({
  open,
  name,
  onToggle,
  controls,
}: {
  open: boolean;
  name: string;
  onToggle: () => void;
  controls: string;
}) {
  const t = useTranslations("DashboardHome.sections");
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={open ? t("closeLabel", { name }) : t("editLabel", { name })}
      onClick={onToggle}
    >
      {open ? t("close") : t("edit")}
    </Button>
  );
}

export function HomeEditor({
  sections,
  stats,
  mediaBase,
  initialOpen = null,
  justCreated = false,
}: {
  sections: Row[];
  stats: Row[];
  mediaBase: string;
  initialOpen?: OpenForm;
  justCreated?: boolean;
}) {
  const t = useTranslations("DashboardHome");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [open, setOpen] = useState<OpenForm>(initialOpen);
  const [visibility, setVisibility] = useState<Partial<Record<HomeSectionKey, boolean>>>({});
  const [busyKey, setBusyKey] = useState<HomeSectionKey | null>(null);
  const [notice, setNotice] = useState<{ tone: "status" | "alert"; text: string } | null>(null);

  const sectionItems: SectionItem[] = sections
    .flatMap((row) => {
      const key = homeSectionKeySchema.safeParse(row.key);
      return key.success
        ? [{ id: key.data, name: t(`keys.${key.data}`), position: Number(row.position ?? 0), row }]
        : [];
    })
    .sort((a, b) => a.position - b.position);

  const statItems: StatItem[] = stats
    .map((row) => ({
      id: String(row.id),
      name: rowTitle("home_stats", row, locale) ?? t("stats.untitled"),
      position: Number(row.position ?? 0),
      row,
    }))
    .sort((a, b) => a.position - b.position);

  const isOpen = (form: NonNullable<OpenForm>) => JSON.stringify(open) === JSON.stringify(form);
  const toggle = (form: NonNullable<OpenForm>) => setOpen(isOpen(form) ? null : form);

  async function reorder(type: "home_sections" | "home_stats", ordered: { id: string; position: number }[]) {
    // An open form holds the old position, so close it before the order changes.
    setOpen(null);
    const ok = await saveOrder(type, ordered);
    router.refresh();
    return ok;
  }

  async function setVisible(item: SectionItem, visible: boolean) {
    // Not disabled while saving, so keyboard focus stays on the checkbox.
    if (busyKey) return;
    setBusyKey(item.id);
    setVisibility((current) => ({ ...current, [item.id]: visible }));
    const result = await saveContent("home_sections", { key: item.id, isVisible: visible }, false);
    setBusyKey(null);
    if (!result.ok) {
      setVisibility((current) => ({ ...current, [item.id]: !visible }));
      setNotice({ tone: "alert", text: result.message ?? t("errors.visibility") });
      return;
    }
    setNotice({
      tone: "status",
      text: visible ? t("sections.nowShown", { name: item.name }) : t("sections.nowHidden", { name: item.name }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="sections-heading" className="space-y-4">
        <SectionHeading id="sections-heading" title={t("sections.heading")} intro={t("sections.intro")} />
        <div aria-live="polite">
          {notice && (
            <p
              role={notice.tone}
              className={notice.tone === "alert" ? "text-sm font-semibold text-danger" : "text-sm font-semibold"}
            >
              {notice.text}
            </p>
          )}
        </div>
        <ReorderList
          items={sectionItems}
          label={t("sections.heading")}
          onReorder={(ordered) => reorder("home_sections", ordered)}
          renderItem={(item, index) => {
            const visible = visibility[item.id] ?? item.row.isVisible !== false;
            const form = { kind: "section", key: item.id } as const;
            const formId = `section-form-${item.id}`;
            return (
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="text-lg">{item.name}</h3>
                  <span className="text-sm text-text-secondary">
                    {t("sections.position", { position: index + 1, total: sectionItems.length })}
                  </span>
                  <StatusBadges row={item.row} hidden={!visible} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Checkbox
                    label={t("sections.shown")}
                    checked={visible}
                    onChange={(event) => void setVisible(item, event.target.checked)}
                  />
                  <ToggleButton
                    open={isOpen(form)}
                    name={item.name}
                    controls={formId}
                    onToggle={() => toggle(form)}
                  />
                </div>
                <div id={formId}>
                  {isOpen(form) && <SectionEditor sectionKey={item.id} row={item.row} mediaBase={mediaBase} />}
                </div>
              </div>
            );
          }}
        />
      </section>

      <section aria-labelledby="stats-heading" className="space-y-4">
        <SectionHeading id="stats-heading" title={t("stats.heading")} intro={t("stats.intro")} />
        {statItems.length === 0 ? (
          <p className="text-text-secondary">{t("stats.empty")}</p>
        ) : (
          <ReorderList
            items={statItems}
            label={t("stats.heading")}
            onReorder={(ordered) => reorder("home_stats", ordered)}
            renderItem={(item) => {
              const form = { kind: "stat", id: item.id } as const;
              const formId = `stat-form-${item.id}`;
              const value = typeof item.row.value === "string" && item.row.value.trim() !== "" ? item.row.value : null;
              return (
                <div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="text-lg">
                      <bdi>{item.name}</bdi>
                    </h3>
                    <span className="text-sm text-text-secondary">
                      {value ? <bdi>{value}</bdi> : t("stats.noValue")}
                    </span>
                    <StatusBadges row={item.row} />
                  </div>
                  <div className="mt-3">
                    <ToggleButton
                      open={isOpen(form)}
                      name={item.name}
                      controls={formId}
                      onToggle={() => toggle(form)}
                    />
                  </div>
                  <div id={formId}>
                    {isOpen(form) && (
                      <StatEditor
                        key={`${item.id}:${item.position}`}
                        row={item.row}
                        mediaBase={mediaBase}
                        justCreated={justCreated && initialOpen?.kind === "stat" && initialOpen.id === item.id}
                      />
                    )}
                  </div>
                </div>
              );
            }}
          />
        )}
        {open?.kind === "newStat" ? (
          <Card as="section" compact aria-labelledby="new-stat-heading">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="new-stat-heading" className="text-lg">
                {t("stats.newTitle")}
              </h3>
              <Button variant="quiet" size="sm" onClick={() => setOpen(null)}>
                {t("stats.cancel")}
              </Button>
            </div>
            <StatEditor row={null} newPosition={nextPosition(statItems)} mediaBase={mediaBase} />
          </Card>
        ) : (
          <Button variant="secondary" onClick={() => setOpen({ kind: "newStat" })}>
            {t("stats.add")}
          </Button>
        )}
      </section>
    </div>
  );
}
