import type { Locale } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import type { ComponentType } from "react";
import {
  ArrowForwardIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileIcon,
  GlobeIcon,
  ImageIcon,
  LockIcon,
  MailIcon,
  PaperclipIcon,
  PlayIcon,
  SearchIcon,
  WhatsAppIcon,
  type IconProps,
} from "@/components/icons";
import { formatDate, formatNumber, formatYears, intlLocale } from "@/components/public/home/format";
import { CardCover, type PhotoCrop } from "@/components/public/listing/parts";
import { zoneName } from "@/components/workspace/format";
import { contrastRatio } from "../contrast";
import { DsBlock, DsCode, DsNote, DsSection, DsThemes } from "../parts";
import { COLOR_ROLES, CONTRAST_PAIRS, roleHex } from "../tokens";

type Props = { locale: Locale };

export async function FoundationsSection({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystem" });

  return (
    <DsSection id="foundations" title={t("foundations.title")} intro={t("foundations.intro")}>
      <ColorBlock locale={locale} />
      <TypeBlock locale={locale} />
      <SpacingBlock locale={locale} />
      <GridBlock locale={locale} />
      <IconsBlock locale={locale} />
      <NumbersBlock locale={locale} />
      <PhotographyBlock locale={locale} />
      <FocusBlock locale={locale} />
      <MotionBlock locale={locale} />
    </DsSection>
  );
}

/* ---------------------------------------------------------------- color -- */

async function ColorBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystem" });
  const c = await getTranslations({ locale, namespace: "DesignSystem.foundations.color" });
  const ratio = (value: number) => `${formatNumber(value, locale, { maximumFractionDigits: 1 })} : ${formatNumber(1, locale)}`;

  return (
    <DsBlock title={c("title")} intro={c("intro")}>
      <DsThemes labels={{ light: t("light"), dark: t("dark") }}>
        {(theme) => (
          <div className="flex flex-col gap-6">
            <ul className="border-t border-line">
              {COLOR_ROLES.map((role) => (
                <li key={role.key} className="flex items-center gap-4 border-b border-line py-3">
                  <span
                    aria-hidden="true"
                    className="size-10 shrink-0 border border-line"
                    style={{ backgroundColor: `var(${role.token})` }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block type-small">{c(`roles.${role.key}`)}</span>
                    <DsCode>
                      {role.token} · {role[theme]}
                    </DsCode>
                  </span>
                </li>
              ))}
            </ul>
            <div>
              <p className="mb-2 type-small font-medium">{c("contrast")}</p>
              <table className="w-full border-t-2 border-rule type-caption">
                <tbody>
                  {CONTRAST_PAIRS.map((pair) => {
                    const fg = COLOR_ROLES.find((role) => role.key === pair.fg)!;
                    const bg = COLOR_ROLES.find((role) => role.key === pair.bg)!;
                    const value = contrastRatio(roleHex(pair.fg, theme), roleHex(pair.bg, theme));
                    return (
                      <tr key={`${pair.fg}-${pair.bg}`} className="border-b border-line">
                        <td className="py-2 pe-3">
                          <span
                            className="inline-block px-2"
                            style={{ color: `var(${fg.token})`, backgroundColor: `var(${bg.token})` }}
                          >
                            <span dir="ltr" className="mono-meta">
                              {fg.token} / {bg.token}
                            </span>
                          </span>
                        </td>
                        <td className="py-2 text-end">{ratio(value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DsThemes>
    </DsBlock>
  );
}

/* ----------------------------------------------------------------- type -- */

const AR_SCALE = [
  ["ar-display", "56 / 1.45 · 500"],
  ["ar-display-sm", "34 / 1.5 · 500"],
  ["ar-h1", "40 / 1.5 · 500"],
  ["ar-h2", "28 / 1.55 · 500"],
  ["ar-h3", "21 / 1.6 · 600"],
  ["ar-body", "17 / 1.95 · 400"],
  ["ar-small", "15 / 1.85 · 400"],
  ["ar-caption", "13 / 1.8 · 400"],
] as const;

const EN_SCALE = [
  ["en-display", "50 / 1.1 · 500"],
  ["en-display-sm", "32 / 1.15 · 500"],
  ["en-h1", "36 / 1.15 · 500"],
  ["en-h2", "26 / 1.25 · 500"],
  ["en-h3", "20 / 1.35 · 600"],
  ["en-body", "16 / 1.6 · 400"],
  ["en-small", "14 / 1.5 · 400"],
  ["en-caption", "13 / 1.45 · 400"],
] as const;

async function TypeBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystem.foundations.type" });
  const scale = (lang: "ar" | "en", rows: typeof AR_SCALE | typeof EN_SCALE, sample: string) => (
    <ul lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className="border-t-2 border-rule">
      {rows.map(([name, spec]) => (
        <li key={name} className="flex flex-col gap-1 border-b border-line py-4 md:flex-row md:items-baseline md:gap-6">
          <span className="flex shrink-0 flex-col items-start md:w-label-col">
            <DsCode>{name}</DsCode>
            <DsCode>{spec}</DsCode>
          </span>
          <span className={`min-w-0 ${name} max-md:wrap-break-word`}>{sample}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <DsBlock title={t("title")} intro={t("intro")}>
      <div className="flex flex-col gap-10">
        <div>
          <p className="mb-3 type-small font-medium">{t("arabic")}</p>
          {scale("ar", AR_SCALE, t("sampleAr"))}
        </div>
        <div>
          <p className="mb-3 type-small font-medium">{t("english")}</p>
          {scale("en", EN_SCALE, t("sampleEn"))}
        </div>
        <div>
          <p className="mb-3 type-small font-medium">{t("data")}</p>
          <ul dir="ltr" className="border-t-2 border-rule">
            {(["mono-meta", "mono-figure"] as const).map((name) => (
              <li key={name} className="flex flex-col gap-1 border-b border-line py-4 md:flex-row md:items-baseline md:gap-6">
                <span className="shrink-0 md:w-label-col">
                  <DsCode>{name}</DsCode>
                </span>
                <span className={name}>{t("sampleMono")}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DsBlock>
  );
}

/* -------------------------------------------------------------- spacing -- */

const SPACE = [4, 8, 12, 16, 24, 32, 48, 64, 112] as const;

async function SpacingBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystem.foundations.spacing" });
  return (
    <DsBlock title={t("title")} intro={t("intro")}>
      <ul className="border-t border-line">
        {SPACE.map((px, i) => (
          <li key={px} className="flex items-center gap-4 border-b border-line py-2">
            <span className="w-label-col shrink-0">
              <DsCode>
                space-{i + 1} · {px}
              </DsCode>
            </span>
            <span aria-hidden="true" className="h-3 bg-accent" style={{ width: `var(--space-${i + 1})` }} />
          </li>
        ))}
      </ul>
    </DsBlock>
  );
}

/* ----------------------------------------------------------------- grid -- */

async function GridBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystem.foundations.grid" });
  const breakpoints = [
    [375, t("bp375")],
    [768, t("bp768")],
    [1280, t("bp1280")],
    [1440, t("bp1440")],
  ] as const;

  return (
    <DsBlock title={t("title")}>
      <div className="flex flex-col gap-7">
        {/* The live grid: 4 columns on phones, 8 from 768, 12 from 1280. */}
        <div aria-hidden="true" className="grid grid-cols-4 gap-gutter md:grid-cols-8 xl:grid-cols-12">
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className={`h-30 border-x border-line bg-accent-wash ${i >= 8 ? "hidden xl:block" : i >= 4 ? "hidden md:block" : ""}`}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {breakpoints.map(([width, text]) => (
            <div key={width} className="border-t-2 border-rule py-2.5">
              <p className="type-h3">{formatNumber(width, locale, { useGrouping: false })}</p>
              <p className="text-ink-2 type-caption">{text}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[var(--label-col)_minmax(0,1fr)] gap-6 border-y border-line py-3.5">
          <p className="text-ink-2 type-small">{t("labelCol")}</p>
          <p className="max-w-measure type-small">{t("labelColText")}</p>
        </div>
      </div>
    </DsBlock>
  );
}

/* ---------------------------------------------------------------- icons -- */

const ICONS: [string, ComponentType<IconProps>][] = [
  ["next", ArrowForwardIcon],
  ["download", DownloadIcon],
  ["document", FileIcon],
  ["language", GlobeIcon],
  ["search", SearchIcon],
  ["mail", MailIcon],
  ["whatsapp", WhatsAppIcon],
  ["appointment", CalendarIcon],
  ["attachment", PaperclipIcon],
  ["done", CheckIcon],
  ["waiting", ClockIcon],
  ["close", CloseIcon],
  ["protected", LockIcon],
  ["view", EyeIcon],
  ["play", PlayIcon],
  ["external", ExternalLinkIcon],
];

async function IconsBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystem.foundations.icons" });
  return (
    <DsBlock title={t("title")}>
      <ul className="grid grid-cols-4 border-t-2 border-rule md:grid-cols-8">
        {ICONS.map(([key, Icon]) => (
          <li key={key} className="flex flex-col items-center gap-2 border-b border-line px-1 py-4 text-center">
            <Icon size={24} />
            <span className="text-ink-2 type-caption">{t(`names.${key}` as "names.next")}</span>
          </li>
        ))}
      </ul>
      <DsNote className="mt-3.5">{t("note")}</DsNote>
    </DsBlock>
  );
}

/* -------------------------------------------------------------- numbers -- */

const MEETING = new Date("2025-03-14T11:30:00Z");
const MEETING_ZONE = "Asia/Riyadh";

async function Ledger({ lang }: { lang: Locale }) {
  const t = await getTranslations({ locale: lang, namespace: "DesignSystem.foundations.numbers" });
  const time = new Intl.DateTimeFormat(intlLocale(lang), { timeStyle: "short", timeZone: MEETING_ZONE }).format(MEETING);
  const rows = [
    [t("date"), formatDate("2025-03-14", lang)],
    [t("duration"), `${formatYears(2022, 2023, lang)} · ${t("twoYears")}`],
    [t("meetingTime"), `${time} · ${t("zone")} (${zoneName(MEETING, lang, "short", MEETING_ZONE)})`],
    [t("largeNumber"), t("trainees", { count: formatNumber(1200, lang) })],
    [t("percent"), formatNumber(0.7, lang, { style: "percent" })],
  ];

  return (
    <div lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className="flex flex-col gap-4">
      <p className="mono-meta text-ink-2">{lang === "ar" ? t("arabic") : t("english")}</p>
      <dl className="border-t border-line">
        {rows.map(([term, value]) => (
          <div key={term} className="flex items-baseline justify-between gap-3 border-b border-line py-3">
            <dt className="text-ink-2 type-small">{term}</dt>
            <dd className="text-end font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {lang === "ar" && (
        <p className="text-ink-2 type-caption">
          {t("ltrNote")}{" "}
          <span dir="ltr" className="mono-meta">
            {t("phoneSample")}
          </span>
        </p>
      )}
    </div>
  );
}

async function NumbersBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystem.foundations.numbers" });
  return (
    <DsBlock title={t("title")}>
      <div className="grid gap-8 md:grid-cols-2">
        <Ledger lang="ar" />
        <Ledger lang="en" />
      </div>
    </DsBlock>
  );
}

/* ---------------------------------------------------------- photography -- */

async function PhotographyBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystem.foundations.photography" });
  const photos: { crop: PhotoCrop; ratio: string; caption: string; src: string | null; alt: string }[] = [
    { crop: "portrait", ratio: "4:5", caption: t("portrait"), src: "/images/hands-notes.webp", alt: t("alt.notes") },
    { crop: "work", ratio: "3:2", caption: t("work"), src: "/images/the-table.webp", alt: t("alt.table") },
    { crop: "detail", ratio: "1:1", caption: t("detail"), src: "/images/window-light.webp", alt: t("alt.window") },
    { crop: "wide", ratio: "16:9", caption: t("missingCaption"), src: null, alt: "" },
  ];

  return (
    <DsBlock title={t("title")}>
      <div className="grid grid-cols-2 items-end gap-x-4 gap-y-6 md:grid-cols-[1fr_1.5fr_1fr_1.6fr] md:gap-6">
        {photos.map((photo) => (
          <figure key={photo.crop}>
            <CardCover
              crop={photo.crop}
              image={photo.src ? { src: photo.src, alt: photo.alt } : null}
              fallback={<ImageIcon size={24} />}
              missingLabel={photo.src ? undefined : t("missing")}
              sizes="(min-width: 768px) 25vw, 50vw"
            />
            <figcaption className="flex justify-between gap-3 pt-2 text-ink-2 type-caption">
              <span>{photo.caption}</span>
              <DsCode>{photo.ratio}</DsCode>
            </figcaption>
          </figure>
        ))}
      </div>
      <DsNote className="mt-4">{t("note")}</DsNote>
    </DsBlock>
  );
}

/* ---------------------------------------------------------------- focus -- */

// Always drawn here, so the ring shows without a keyboard; Tab shows the real one.
const SHOWN_RING = "outline-2 outline-offset-3 outline-focus outline-solid transition-state";

async function FocusBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystem" });
  const f = await getTranslations({ locale, namespace: "DesignSystem.foundations.focus" });
  return (
    <DsBlock title={f("title")}>
      <DsThemes labels={{ light: t("light"), dark: t("dark") }}>
        {() => (
          <div className="flex flex-wrap items-center gap-6 py-2">
            <button type="button" className={`min-h-12 bg-accent px-6 text-on-accent hover:bg-ink hover:text-bg ${SHOWN_RING}`}>
              {f("onAccent")}
            </button>
            <button type="button" className={`min-h-12 border border-ink px-6 hover:bg-surface-hover ${SHOWN_RING}`}>
              {f("onGround")}
            </button>
            <span className="bg-surface p-3">
              <button type="button" className={`min-h-12 border border-ink px-6 hover:bg-surface-hover ${SHOWN_RING}`}>
                {f("onSurface")}
              </button>
            </span>
            <button
              type="button"
              className={`text-accent underline decoration-1 underline-offset-5 hover:decoration-2 ${SHOWN_RING}`}
            >
              {f("onLink")}
            </button>
          </div>
        )}
      </DsThemes>
      <DsNote className="mt-3">{f("note")}</DsNote>
    </DsBlock>
  );
}

/* --------------------------------------------------------------- motion -- */

async function MotionBlock({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "DesignSystem.foundations.motion" });
  const steps = [
    ["0ms", t("step1")],
    ["+120ms", t("step2")],
    ["+240ms", t("step3")],
  ] as const;
  return (
    <DsBlock title={t("title")}>
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map(([at, text]) => (
          <li key={at} className="border-t-2 border-rule p-3.5">
            <DsCode>{at}</DsCode>
            <p className="type-small">{text}</p>
          </li>
        ))}
      </ol>
      <DsNote className="mt-3">{t("note")}</DsNote>
    </DsBlock>
  );
}
