"use client";

import { LOCALES, type Locale } from "@repo/shared";
import { NextIntlClientProvider, useLocale, useTimeZone, useTranslations, type AbstractIntlMessages } from "next-intl";
import { useEffect, useId, useState, type ReactNode } from "react";
import { ClientsContent } from "@/components/public/clients";
import { ExpertiseDetailPage, ServiceDetailPage } from "@/components/public/pages";
import { ProjectDetailPage } from "@/components/public/projects";
import { Button, Card } from "@/components/ui";
import arPreview from "@/messages/ar/DashboardPreview.json";
import enPreview from "@/messages/en/DashboardPreview.json";
import type { ContentEditorState } from "../content/content-editor";
import type { Row } from "../content/form-values";
import { consentBlockers, hasPreview, previewModel, type PreviewModel } from "./draft";
import { PreviewFrame, PREVIEW_WIDTHS, type PreviewWidth } from "./preview-frame";
import { loadPublicMessages } from "./public-messages";

type Option<T extends string> = { value: T; label: string };

/** A small radio group drawn as a segmented control. */
function Segmented<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="mt-1 inline-flex flex-wrap rounded-md border border-text/20 p-0.5">
        {options.map((option) => (
          <label
            key={option.value}
            className="cursor-pointer rounded px-3 py-1.5 text-sm has-checked:bg-text has-checked:text-background has-focus-visible:outline-2 has-focus-visible:outline-ring"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The matching public component, with the draft as its props. */
function PublicView({ model }: { model: PreviewModel }) {
  switch (model.kind) {
    case "service":
      return <ServiceDetailPage service={model.service} area={model.area} projects={[]} faqs={[]} />;
    case "project":
      return <ProjectDetailPage project={model.project} area={model.area} />;
    case "expertise":
      return <ExpertiseDetailPage area={model.area} services={[]} projects={[]} />;
    case "clients":
      return <ClientsContent partners={model.partners} testimonials={model.testimonials} />;
    default:
      return null;
  }
}

function Notice({ tone = "info", children }: { tone?: "info" | "warning"; children: ReactNode }) {
  return (
    <div
      className={
        tone === "warning"
          ? "rounded-md border border-danger p-3 text-sm"
          : "rounded-md border border-text/20 p-3 text-sm"
      }
    >
      {children}
    </div>
  );
}

function Preview({ editor }: { editor: ContentEditorState }) {
  const t = useTranslations("DashboardPreview");
  const pageLocale = useLocale() as Locale;
  const timeZone = useTimeZone();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>(pageLocale);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [width, setWidth] = useState<PreviewWidth>("mobile");
  const [messages, setMessages] = useState<Partial<Record<Locale, AbstractIntlMessages>>>({});
  const [failedLocale, setFailedLocale] = useState<Locale | null>(null);

  const { ctx } = editor;
  // The form's values on top of the saved row, as a save would merge them.
  // Approval comes from the saved row only.
  const draft: Row = { ...(ctx.original ?? {}), ...ctx.values };
  const model = previewModel(ctx.type, draft, locale, ctx);
  const blockers =
    ctx.type === "testimonials" || ctx.type === "partners" ? consentBlockers(draft) : [];
  const language = t(`languages.${locale}`);
  const loaded = messages[locale];

  useEffect(() => {
    if (!open || loaded) return;
    let live = true;
    loadPublicMessages(locale).then(
      (value) => {
        if (!live) return;
        setMessages((current) => ({ ...current, [locale]: value }));
        setFailedLocale(null);
      },
      () => live && setFailedLocale(locale),
    );
    return () => {
      live = false;
    };
  }, [open, locale, loaded]);

  return (
    <Card as="section" compact aria-labelledby={`${id}-heading`} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <h2 id={`${id}-heading`} className="text-lg">
            {t("heading")}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">{t("intro")}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? t("hide") : t("show")}
        </Button>
      </div>
      <div id={`${id}-body`} hidden={!open} className="space-y-4">
        {open && (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <Segmented
                legend={t("language")}
                name={`${id}-locale`}
                value={locale}
                options={LOCALES.map((value) => ({ value, label: t(`languages.${value}`) }))}
                onChange={setLocale}
              />
              <Segmented
                legend={t("theme")}
                name={`${id}-theme`}
                value={theme}
                options={[
                  { value: "light", label: t("light") },
                  { value: "dark", label: t("dark") },
                ]}
                onChange={setTheme}
              />
              <Segmented
                legend={t("width")}
                name={`${id}-width`}
                value={width}
                options={(Object.keys(PREVIEW_WIDTHS) as PreviewWidth[]).map((value) => ({
                  value,
                  label: t(`widths.${value}`, { pixels: PREVIEW_WIDTHS[value] }),
                }))}
                onChange={setWidth}
              />
            </div>

            <div aria-live="polite" className="space-y-2">
              {blockers.length > 0 && (
                <Notice tone="warning">
                  <p className="font-semibold">{t("notPublicYet")}</p>
                  <ul className="mt-1 list-disc ps-5">
                    {blockers.map((blocker) => (
                      <li key={blocker}>{t(`blockers.${blocker}`)}</li>
                    ))}
                  </ul>
                </Notice>
              )}
              {draft.status !== "published" && <Notice>{t("draftNote")}</Notice>}
              {ctx.type === "projects" && draft.hideOrgName === true && (
                <Notice>{t("hiddenName")}</Notice>
              )}
              {(model.kind === "service" || model.kind === "expertise") && (
                <Notice>{t(model.kind === "service" ? "serviceLimits" : "expertiseLimits")}</Notice>
              )}
              {model.kind === "incomplete" && (
                <Notice tone="warning">{t("incomplete", { language })}</Notice>
              )}
              {failedLocale === locale && <Notice tone="warning">{t("loadFailed")}</Notice>}
            </div>

            {model.kind !== "incomplete" && model.kind !== "unsupported" && (
              <PreviewFrame
                title={t("frameTitle", { language })}
                locale={locale}
                dark={theme === "dark"}
                width={width}
              >
                {loaded ? (
                  <NextIntlClientProvider locale={locale} messages={loaded} timeZone={timeZone}>
                    <PublicView model={model} />
                  </NextIntlClientProvider>
                ) : (
                  <p className="p-6 text-sm">{t("loading")}</p>
                )}
              </PreviewFrame>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

/**
 * The preview before publishing (§6.20): the editor's unsaved draft, drawn
 * with the public page's own components, in either language, light or dark,
 * at a phone or desktop width. Read-only: it never saves, publishes or
 * refreshes a public cache. Types without a public page show nothing.
 */
export function PreviewPanel({ editor }: { editor: ContentEditorState }) {
  const locale = useLocale() as Locale;
  const timeZone = useTimeZone();
  if (!hasPreview(editor.ctx.type)) return null;
  // The panel brings its own small namespace, so no editor page has to pass it.
  return (
    <NextIntlClientProvider
      locale={locale}
      timeZone={timeZone}
      messages={{ DashboardPreview: PANEL_MESSAGES[locale] }}
    >
      <Preview editor={editor} />
    </NextIntlClientProvider>
  );
}

const PANEL_MESSAGES: Record<Locale, typeof enPreview> = { ar: arPreview, en: enPreview };
