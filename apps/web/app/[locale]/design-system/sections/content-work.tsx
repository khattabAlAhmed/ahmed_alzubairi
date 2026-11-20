import type { Locale, TiptapDoc } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { CheckIcon } from "@/components/icons";
import { ArticleLedger } from "@/components/public/blog/article-page";
import { formatDate } from "@/components/public/home/format";
import { ArticleCard, ArticleList } from "@/components/public/listing/article-card";
import { CourseCard, CourseSchedule } from "@/components/public/listing/course-card";
import { MediaCard, MediaLog } from "@/components/public/listing/media-card";
import { ContactSheet, VideoFacade } from "@/components/public/listing/media-frame";
import { Figure, PhotoMissing } from "@/components/public/listing/parts";
import { RESOURCE_ACTION, RESOURCE_BELOW, ResourceCard, ResourceList } from "@/components/public/listing/resource-card";
import { ShareButtons } from "@/components/public/listing/share-buttons";
import {
  ProjectStoryFeatured,
  ProjectStoryList,
  ProjectStoryRow,
  type ProjectStoryData,
} from "@/components/public/project-story";
import { ActivityList, ProjectFacts, ResultFigures } from "@/components/public/projects/project-detail";
import { EmailGate, ResourceDownload } from "@/components/public/resources/resource-download";
import { ARTICLE_PROSE, RichText } from "@/components/public/rich-text/rich-text";
import { ButtonLink } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { RegistrationFrame, RegistrationPanel } from "@/components/training/registration-panel";
import type { Faq } from "@/lib/content";
import { DocumentsList, type ListedDocument } from "../../(public)/documents/documents-list";
import { FaqList } from "../../(public)/faq/faq-list";
import { DsBlock, DsNote, DsSection } from "../parts";

/*
 * components.md group 5, second half: the components of the work and reading
 * pages, each in the states its board shows, with sample text from messages.
 * Links point back to this page; nothing here reads Supabase.
 */

type Props = { locale: Locale };
type T = Awaited<ReturnType<typeof getTranslations<"DesignSystemContentWork">>>;

const HERE = "/design-system#content-work";
const PHOTOS = {
  table: "/images/the-table.webp",
  notes: "/images/hands-notes.webp",
  window: "/images/window-light.webp",
};
const SAMPLE_EMBED = "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ";
// Far enough ahead that the sample courses stay upcoming.
const STARTS = { first: "2031-04-14T06:00:00Z", second: "2031-05-03T15:00:00Z" };
/** A fixed "now" for the panel's states: the page is prerendered, so it can't read the clock. */
const NOW = new Date("2031-01-01T00:00:00Z");

export async function ContentWorkSection({ locale }: Props) {
  const ds = await getTranslations({ locale, namespace: "DesignSystem" });
  const t = await getTranslations({ locale, namespace: "DesignSystemContentWork" });
  // Client parts read these on the browser: the email form and the register button.
  const { Resources, Training, DocumentRequestDialog } = await getMessages({ locale });

  return (
    <DsSection id="content-work" title={ds("contentWork.title")} intro={t("intro")}>
      <DsNote>{t("draftNote")}</DsNote>
      <ProjectStoryBlock t={t} />
      <ProjectPageBlock t={t} locale={locale} />
      <ArticleItemBlock t={t} />
      <ArticleBodyBlock t={t} locale={locale} />
      <NextIntlClientProvider locale={locale} messages={{ Resources, Training, DocumentRequestDialog }}>
        <ResourceBlock t={t} locale={locale} />
        <MediaBlock t={t} locale={locale} />
        <FrameBlock t={t} locale={locale} />
        <CourseBlock t={t} locale={locale} />
        <RegistrationBlock t={t} locale={locale} />
        <DocumentBlock t={t} />
      </NextIntlClientProvider>
      <FaqBlock t={t} />
    </DsSection>
  );
}

/** A sample with its state named above it. */
function State({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-3", className)}>
      <p className="text-ink-2 type-caption">{label}</p>
      {children}
    </div>
  );
}

type Row = Record<string, string>;
const rows = (t: T, key: Parameters<T["raw"]>[0]) => t.raw(key) as Row[];

/* -------------------------------------------------------- project story -- */

function ProjectStoryBlock({ t }: { t: T }) {
  const featured: ProjectStoryData = {
    href: HERE,
    title: t("project.featured.title"),
    meta: [t("project.featured.org"), t("project.featured.area"), t("project.featured.years")],
    situation: t("project.featured.situation"),
    whatIDid: t("project.featured.did"),
    whatChanged: t("project.featured.changed"),
    cover: { src: PHOTOS.table, alt: t("project.featured.caption") },
    caption: `${t("project.featured.caption")} · ${t("placeholderPhoto")}`,
  };
  return (
    <DsBlock title={t("project.title")} intro={t("project.intro")}>
      <div className="flex flex-col gap-10">
        <State label={t("states.featured")}>
          <ProjectStoryFeatured story={featured} headingLevel={3} />
        </State>
        <State label={t("states.rows")}>
          <ProjectStoryList>
            {rows(t, "project.rows").map((row) => (
              <ProjectStoryRow
                key={row.title}
                headingLevel={3}
                story={{ href: HERE, title: row.title, meta: [row.meta], whatChanged: row.changed, area: row.area }}
              />
            ))}
          </ProjectStoryList>
        </State>
        <DsNote>{t("project.note")}</DsNote>
      </div>
    </DsBlock>
  );
}

/* --------------------------------------------------------- project page -- */

async function ProjectPageBlock({ t, locale }: { t: T; locale: Locale }) {
  const tg = await getTranslations({ locale, namespace: "ContentWork.gallery" });
  const images = [PHOTOS.table, PHOTOS.notes, PHOTOS.window].map((src, index) => ({
    src,
    alt: t.raw("frame.captions")[index] as string,
    caption: t.raw("frame.captions")[index] as string,
  }));
  return (
    <DsBlock title={t("projectPage.title")} intro={t("projectPage.intro")}>
      <div className="flex flex-col gap-9">
        <ProjectFacts
          facts={[
            { label: t("projectPage.goal"), value: t("projectPage.goalValue") },
            { label: t("projectPage.org"), value: t("projectPage.orgValue") },
            { label: t("projectPage.role"), value: t("projectPage.roleValue") },
            { label: t("projectPage.duration"), value: t("projectPage.durationValue") },
          ]}
        />
        <div className="grid gap-9 lg:grid-cols-2 lg:gap-8">
          <State label={t("projectPage.activities")}>
            <ActivityList rows={rows(t, "projectPage.acts").map((row) => ({ label: row.label, text: row.text }))} />
          </State>
          <State label={t("projectPage.results")}>
            <ResultFigures figures={rows(t, "projectPage.figures").map((row) => ({ value: row.value, text: row.text, from: row.from }))} />
          </State>
        </div>
        <State label={t("states.sheet")}>
          <ContactSheet
            images={[...images, null]}
            labels={{
              open: [1, 2, 3, 4].map((n) => tg("open", { n })),
              close: tg("close"),
              previous: tg("previous"),
              next: tg("next"),
              position: [1, 2, 3].map((n) => tg("position", { n, total: 3 })),
              missing: tg("missing"),
            }}
          />
        </State>
      </div>
    </DsBlock>
  );
}

/* --------------------------------------------------------- article item -- */

function ArticleItemBlock({ t }: { t: T }) {
  const [first, second] = rows(t, "article.rows");
  return (
    <DsBlock title={t("article.title")} intro={t("article.intro")}>
      <div className="flex flex-col gap-3">
        <p className="text-ink-2 type-caption">{`${t("states.withImage")} · ${t("states.withoutImage")} · ${t("states.otherLanguage")}`}</p>
        <ArticleList>
          <ArticleCard
            href={HERE}
            title={first.title}
            excerpt={first.excerpt}
            category={first.area}
            cover={{ src: PHOTOS.notes, alt: "" }}
            publishedAt="2026-03-12T09:00:00Z"
            readingMinutes={7}
            headingLevel={3}
          />
          <ArticleCard
            href={HERE}
            title={second.title}
            excerpt={second.excerpt}
            category={second.area}
            cover={null}
            publishedAt="2026-02-28T09:00:00Z"
            readingMinutes={5}
            headingLevel={3}
          />
          <ArticleCard
            href={HERE}
            title={t("article.otherTitle")}
            excerpt={t("article.otherExcerpt")}
            category={first.area}
            cover={null}
            publishedAt="2026-01-09T09:00:00Z"
            readingMinutes={6}
            headingLevel={3}
            lang={t("article.otherTitle").match(/[؀-ۿ]/) ? "ar" : "en"}
          />
        </ArticleList>
        <DsNote>{t("article.note")}</DsNote>
      </div>
    </DsBlock>
  );
}

/* --------------------------------------------------------- article body -- */

function ArticleBodyBlock({ t, locale }: { t: T; locale: Locale }) {
  const text = (value: string) => ({ type: "text", text: value });
  const doc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [text(t("body.p1"))] },
      { type: "heading", attrs: { level: 2 }, content: [text(t("body.h2"))] },
      {
        type: "orderedList",
        content: [t("body.li1"), t("body.li2"), t("body.li3")].map((item) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: [text(item)] }],
        })),
      },
      { type: "blockquote", content: [{ type: "paragraph", content: [text(t("body.quote"))] }] },
      {
        type: "paragraph",
        content: [
          text(`${t("body.p2")} `),
          { type: "text", text: t("body.link"), marks: [{ type: "link", attrs: { href: "https://example.org/" } }] },
          text(` ${t("body.p3")}`),
        ],
      },
    ],
  } as TiptapDoc;

  return (
    <DsBlock title={t("body.title")} intro={t("body.intro")}>
      <div className="grid gap-8 lg:grid-cols-12">
        <SampleLedger t={t} locale={locale} />
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-6">
          <h4 className="type-h1">{t("body.heading")}</h4>
          <RichText doc={doc} className={ARTICLE_PROSE} />
        </div>
        <ShareButtons url="https://example.org/blog/sample-article" title={t("body.heading")} className="lg:col-span-3 lg:self-start" />
      </div>
      <DsNote className="mt-4">{t("body.note")}</DsNote>
    </DsBlock>
  );
}

async function SampleLedger({ t, locale }: { t: T; locale: Locale }) {
  const tw = await getTranslations({ locale, namespace: "ContentWork.article" });
  const tl = await getTranslations({ locale, namespace: "PublicListing" });
  const published = "2026-03-12T09:00:00Z";
  return (
    <ArticleLedger
      className="lg:col-span-3 lg:self-start"
      rows={[
        { label: tw("published"), value: <time dateTime={published}>{formatDate(published, locale)}</time> },
        { label: tw("reading"), value: tl("readingTime", { minutes: 7 }) },
        { label: tw("area"), value: t("body.area") },
      ]}
    />
  );
}

/* ------------------------------------------------------------ resources -- */

async function ResourceBlock({ t, locale }: { t: T; locale: Locale }) {
  const tr = await getTranslations({ locale, namespace: "Resources" });
  const [guide, template, paper] = rows(t, "resource.rows");
  return (
    <DsBlock title={t("resource.title")} intro={t("resource.intro")}>
      <div className="flex flex-col gap-3">
        <p className="text-ink-2 type-caption">{`${t("states.direct")} · ${t("states.gate")} · ${t("states.sent")}`}</p>
        <ResourceList>
          <ResourceCard
            kind="guide"
            fileType="pdf"
            title={guide.title}
            description={guide.text}
            tags={[guide.area]}
            size="1.1 MB"
            headingLevel={3}
            action={<ResourceDownload id="00000000-0000-4000-8000-000000000001" title={guide.title} access="direct" />}
          />
          <ResourceCard
            kind="template"
            fileType="excel"
            title={template.title}
            description={template.text}
            tags={[template.area]}
            size="86 KB"
            headingLevel={3}
            action={
              <div className="contents">
                <span className={cx(RESOURCE_ACTION, "border border-line-strong px-2 py-px text-xs leading-[1.8] text-ink-2")}>
                  {tr("downloadByEmail")}
                </span>
                {/* Opened, as after a click on "Download by email". */}
                <EmailGate
                  id="00000000-0000-4000-8000-000000000002"
                  title={template.title}
                  autoFocus={false}
                  className={RESOURCE_BELOW}
                />
              </div>
            }
          />
          <ResourceCard
            kind="working_paper"
            fileType="word"
            title={paper.title}
            description={paper.text || null}
            size="240 KB"
            headingLevel={3}
            action={
              <p role="status" className={cx(RESOURCE_ACTION, "flex items-center gap-1.5 text-sm text-success")}>
                <CheckIcon aria-hidden="true" className="size-3.5" />
                {tr("started")}
              </p>
            }
          />
        </ResourceList>
      </div>
    </DsBlock>
  );
}

/* ---------------------------------------------------------------- media -- */

async function MediaBlock({ t, locale }: { t: T; locale: Locale }) {
  const tm = await getTranslations({ locale, namespace: "ContentWork.media" });
  const poster = { src: PHOTOS.table, alt: "" };
  return (
    <DsBlock title={t("media.title")} intro={t("media.intro")}>
      <div className="grid gap-8 lg:grid-cols-12">
        <State label={t("states.featured")} className="lg:col-span-5">
          <MediaCard
            variant="featured"
            headingLevel={3}
            category="media"
            title={t("media.featuredTitle")}
            outlet={t("media.featuredOutlet")}
            date="2026-02-10"
            image={poster}
            media={
              <VideoFacade
                src={SAMPLE_EMBED}
                title={tm("videoTitle", { title: t("media.featuredTitle") })}
                poster={poster}
                playLabel={tm("play")}
              />
            }
          />
        </State>
        <State label={t("states.log")} className="lg:col-span-7">
          <MediaLog>
            {rows(t, "media.rows").map((row, index) => (
              <MediaCard
                key={row.title}
                headingLevel={3}
                category={(["conferences", "events", "media"] as const)[index]}
                title={row.title}
                outlet={row.outlet}
                detail={row.detail}
                date={["2025-11-20", "2025-06-12", "2025-03-04"][index]}
                image={null}
              />
            ))}
          </MediaLog>
        </State>
      </div>
    </DsBlock>
  );
}

/* --------------------------------------------------- image, gallery, video -- */

async function FrameBlock({ t, locale }: { t: T; locale: Locale }) {
  const tg = await getTranslations({ locale, namespace: "ContentWork.gallery" });
  const tm = await getTranslations({ locale, namespace: "ContentWork.media" });
  return (
    <DsBlock title={t("frame.title")} intro={t("frame.intro")}>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <State label={t("states.caption")}>
          <Figure
            image={{ src: PHOTOS.notes, alt: t("frame.figureCaption") }}
            caption={t("frame.figureCaption")}
            note={t("placeholderPhoto")}
          />
        </State>
        <State label={t("states.beforeLoad")}>
          <VideoFacade
            src={SAMPLE_EMBED}
            title={tm("videoTitle", { title: t("media.featuredTitle") })}
            poster={{ src: PHOTOS.window, alt: "" }}
            playLabel={tm("play")}
            fallback={{ href: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", label: tm("watchOnSite") }}
          />
        </State>
        <State label={t("states.missing")}>
          <PhotoMissing crop="work" label={tg("missing")} />
        </State>
      </div>
      <DsNote className="mt-4">{t("frame.note")}</DsNote>
    </DsBlock>
  );
}

/* --------------------------------------------------------------- course -- */

async function CourseBlock({ t, locale }: { t: T; locale: Locale }) {
  const tt = await getTranslations({ locale, namespace: "Training" });
  const [first, second, third, custom] = rows(t, "course.rows");
  const register = (
    <ButtonLink href={HERE} size="sm">
      {t("course.action")}
    </ButtonLink>
  );
  return (
    <DsBlock title={t("course.title")} intro={t("course.intro")}>
      <CourseSchedule>
        <CourseCard
          href={HERE}
          type="in_person"
          title={first.title}
          description={null}
          startsAt={STARTS.first}
          place={first.place}
          seats={{ left: 8, total: 20 }}
          action={register}
          headingLevel={3}
        />
        <CourseCard
          href={HERE}
          type="online_live"
          title={second.title}
          description={null}
          startsAt={STARTS.second}
          place={null}
          seats={{ left: 0, total: 20 }}
          action={register}
          headingLevel={3}
        />
        <CourseCard href={HERE} type="recorded" title={third.title} description={null} startsAt={null} place={null} seats={null} headingLevel={3} />
        <CourseCard
          href={HERE}
          type="custom"
          title={custom.title}
          description={custom.text}
          startsAt={null}
          place={null}
          seats={null}
          action={
            <ButtonLink href={HERE} variant="secondary" size="sm">
              {tt("custom.linkFromCourse")}
            </ButtonLink>
          }
          headingLevel={3}
        />
      </CourseSchedule>
    </DsBlock>
  );
}

/* --------------------------------------------------------- registration -- */

function RegistrationBlock({ t, locale }: { t: T; locale: Locale }) {
  const course = { id: "00000000-0000-4000-8000-000000000003", slug: "sample", type: "in_person" as const, startsAt: STARTS.first };
  const facts = (full: boolean) => [
    { label: t("registration.date"), value: t("registration.dateValue") },
    { label: t("registration.seats"), value: t(full ? "registration.seatsFull" : "registration.seatsValue") },
  ];
  const states = [
    { label: t("states.signedOut"), seatsLeft: 8, viewer: { kind: "signed_out" as const } },
    { label: t("states.signedIn"), seatsLeft: 8, viewer: { kind: "client" as const, registered: false, onlineUrl: null } },
    { label: t("states.registered"), seatsLeft: 8, viewer: { kind: "client" as const, registered: true, onlineUrl: null } },
    { label: t("states.full"), seatsLeft: 0, viewer: { kind: "client" as const, registered: false, onlineUrl: null } },
  ];
  return (
    <DsBlock title={t("registration.title")} intro={t("registration.intro")}>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {states.map((state) => (
          <State key={state.label} label={state.label}>
            <RegistrationFrame facts={state.viewer.kind === "client" && state.viewer.registered ? [] : facts(state.seatsLeft === 0)}>
              <RegistrationPanel course={{ ...course, seatsLeft: state.seatsLeft }} locale={locale} viewer={state.viewer} now={NOW} />
            </RegistrationFrame>
          </State>
        ))}
      </div>
    </DsBlock>
  );
}

/* ------------------------------------------------------------- document -- */

function DocumentBlock({ t }: { t: T }) {
  const documents = rows(t, "document.samples").map((row, index) => ({
    id: `00000000-0000-4000-8000-00000000001${index}`,
    title: row.title,
    category: row.category,
  })) as ListedDocument[];
  return (
    <DsBlock title={t("document.title")} intro={t("document.intro")}>
      <DocumentsList documents={documents} bare />
      <DsNote className="mt-4">{t("document.hint")}</DsNote>
    </DsBlock>
  );
}

/* ------------------------------------------------------------------ faq -- */

function FaqBlock({ t }: { t: T }) {
  const categories = ["consultations", "consultations", "documents", "training"] as const;
  const faqs: Faq[] = rows(t, "faq.items").map((item, index) => ({
    id: `sample-${index}`,
    category: categories[index],
    serviceId: null,
    question: item.q,
    answer: item.a,
  }));
  return (
    <DsBlock title={t("faq.title")} intro={t("faq.intro")}>
      <FaqList faqs={faqs} bare />
    </DsBlock>
  );
}
