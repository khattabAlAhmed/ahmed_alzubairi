---
name: "Ahmed · The record"
version: 1
source: "https://claude.ai/artifact/SzbYLxMUnJ5HRR2m6UXqNs"
themes: [light, dark]
colors:
  light:
    bg: "#FFFFFF"
    surface: "#F3F4F4"
    surface-hover: "#EEF0F0"
    accent-wash: "#E6F0F0"
    ink: "#1A1C1E"
    ink-2: "#50555A"
    line: "#D5D8DA"
    line-strong: "#7A8086"
    rule: "{colors.light.ink}"
    accent: "#0E5C61"
    on-accent: "#FFFFFF"
    focus: "{colors.light.accent}"
    success: "#2F6B45"
    warning: "#8A5A00"
    danger: "#A3322A"
    info: "#2C5A8A"
    scrim: "rgba(16, 18, 19, 0.55)"
  dark:
    bg: "#101213"
    surface: "#181B1C"
    surface-hover: "#1F2324"
    accent-wash: "#142A2B"
    ink: "#E6E8E9"
    ink-2: "#9DA3A7"
    line: "#2A2E30"
    line-strong: "#6B7377"
    rule: "{colors.dark.ink}"
    accent: "#74C7C7"
    on-accent: "#101213"
    focus: "{colors.dark.accent}"
    success: "#7FC19A"
    warning: "#E0B45C"
    danger: "#F0928A"
    info: "#8DB8E6"
    scrim: "rgba(0, 0, 0, 0.66)"
typography:
  families:
    sans: "\"Alexandria\", \"Noto Sans Arabic\", system-ui, sans-serif"
    mono: "\"IBM Plex Mono\", ui-monospace, \"SFMono-Regular\", monospace"
  arabic:
    ar-display: { fontFamily: sans, fontSize: 56px, lineHeight: 1.45, fontWeight: 500 }
    ar-display-sm: { fontFamily: sans, fontSize: 34px, lineHeight: 1.5, fontWeight: 500 }
    ar-h1: { fontFamily: sans, fontSize: 40px, lineHeight: 1.5, fontWeight: 500 }
    ar-h2: { fontFamily: sans, fontSize: 28px, lineHeight: 1.55, fontWeight: 500 }
    ar-h3: { fontFamily: sans, fontSize: 21px, lineHeight: 1.6, fontWeight: 600 }
    ar-body: { fontFamily: sans, fontSize: 17px, lineHeight: 1.95, fontWeight: 400 }
    ar-small: { fontFamily: sans, fontSize: 15px, lineHeight: 1.85, fontWeight: 400 }
    ar-caption: { fontFamily: sans, fontSize: 13px, lineHeight: 1.8, fontWeight: 400 }
  english:
    en-display: { fontFamily: sans, fontSize: 50px, lineHeight: 1.1, fontWeight: 500 }
    en-display-sm: { fontFamily: sans, fontSize: 32px, lineHeight: 1.15, fontWeight: 500 }
    en-h1: { fontFamily: sans, fontSize: 36px, lineHeight: 1.15, fontWeight: 500 }
    en-h2: { fontFamily: sans, fontSize: 26px, lineHeight: 1.25, fontWeight: 500 }
    en-h3: { fontFamily: sans, fontSize: 20px, lineHeight: 1.35, fontWeight: 600 }
    en-body: { fontFamily: sans, fontSize: 16px, lineHeight: 1.6, fontWeight: 400 }
    en-small: { fontFamily: sans, fontSize: 14px, lineHeight: 1.5, fontWeight: 400 }
    en-caption: { fontFamily: sans, fontSize: 13px, lineHeight: 1.45, fontWeight: 400 }
  data:
    mono-meta: { fontFamily: mono, fontSize: 12px, lineHeight: 1.5, fontWeight: 400 }
    mono-figure: { fontFamily: mono, fontSize: 15px, lineHeight: 1.4, fontWeight: 500 }
rounded:
  radius-0: "0"
  radius-round: "999px"
spacing:
  space-1: 4px
  space-2: 8px
  space-3: 12px
  space-4: 16px
  space-5: 24px
  space-6: 32px
  space-7: 48px
  space-8: 64px
  space-9: 112px
borders:
  rule-hair: 1px
  rule-heavy: 2px
layout:
  measure-ar: 34em
  measure-en: 36em
  container: 1312px
  label-col: 120px
shadows:
  shadow-overlay: { light: "0 16px 40px rgba(16, 18, 19, 0.16)", dark: "0 16px 40px rgba(0, 0, 0, 0.55)" }
motion:
  settle: { duration: 600ms, easing: "cubic-bezier(0.2, 0, 0, 1)", distance: 8px, oncePerPage: true }
  state: { duration: 200ms, property: color }
  reducedMotion: none
components:
  foundations:
    FocusAndMotion: "One focus ring everywhere, and one settling moment per page."
    Grid: "The page grid: 12 columns, a fixed label column, reading measures."
    Icons: "One line icon set: 1.5 stroke, square caps, 20 or 24px."
    Numbers: "How digits, dates and times read in each language."
    Photography: "Documentary photos at four crops, with a data line underneath."
  primitives:
    Button: "Actions: primary, secondary, quiet and danger, square-cornered."
    Choice: "Checkbox, radio and switch, plus the consent checkbox."
    Divider: "The heavy rule that opens, the hairline that separates, the dated rule."
    FileInput: "The drop zone and file rows: uploading, attached, refused, failed."
    FilterChips: "Multi-select filters with a square check and a count."
    Link: "Inline links, navigation links and \"more\" links."
    Pagination: "Page navigation: previous, numbers, next; mirrored in RTL."
    SearchField: "Search with a live result count and an honest no-results line."
    Skeleton: "Loading placeholders shaped like the content they stand for."
    StatusPill: "Every consultation and document status as glyph plus word."
    Tabs: "Single-choice tabs with an accent underline."
    Tag: "Small outlined labels for categories and types."
    TextField: "Text, email, phone, select and textarea fields with label, hint and error."
  site-shell:
    ConsultationCta: "The closing invitation on public pages."
    Footer: "Footer: a short line in his voice, the index, newsletter, channels, legal."
    Header: "Site header: name and fields, navigation, language, theme, sign in, \"اطلب استشارة\"."
    LanguageAndTheme: "The language switch (with the untranslated case) and the three-way theme switch."
    MobileMenu: "The phone menu: a numbered index of sections, opened over the page."
    PageHeader: "The top of every main page: title, one sentence of his, the page's facts."
    QuickContact: "Quick contact: WhatsApp and email always within reach."
    SectionShell: "The frame every home section uses: rule, title, his intro, \"see all\"."
    SkipAndConsent: "Skip link, and the analytics consent bar."
  his-voice:
    HisSentence: "One sentence of his, large between sections, or inline in a record."
    Letter: "A short letter from Ahmed on the home page, signed by hand."
    Signature: "The scanned signature, one file per theme."
    WhyITookIt: "A margin note on a project page: why he took it on."
  content:
    ArticleBody: "Long-form typography for articles in both languages."
    ArticleItem: "Articles as a journal index: date column, title, one line, time to read."
    Audience: "Who I work with: three rows read across, each with a real example."
    CareerTimeline: "The career on a spine: years, role, one line."
    CourseItem: "Training as a schedule: date block, title, type, place, seats left."
    DocumentItem: "The public document list: title and category, select several, request access."
    ExpertiseArea: "The three areas as chapters: title, his line, what it covers, real counts."
    FAQ: "Questions grouped by category, opened one at a time."
    Hero: "The home opening as a dossier: name, statement, actions, portrait and quiet ledger."
    MediaFrame: "Image with caption, the contact-sheet gallery, and video before it loads."
    MediaItem: "Media and events as a press log, with one featured video."
    OrganizationLogos: "Approved organization logos as a calm register, low on the page."
    ProjectPage: "Project page parts: facts, activities, results in numbers, gallery."
    ProjectStory: "The record: the system's signature item for projects."
    Qualifications: "Qualifications as a table, values as definitions, the CV link."
    QuietStat: "Numbers as evidence: a band, inside a sentence, or a side ledger."
    RegistrationPanel: "The course page's registration panel in its four states."
    ResourceItem: "Free resources: file type glyph, title, line, area; direct download or for an email."
    ServiceList: "Services as an index, one row opened as featured."
    ServicePage: "Service page parts: who it suits, what you get, the stages, request this service."
    Testimonial: "Quotes from real thank-you letters: one in full, others as excerpts."
  forms:
    ConsultationRequest: "The new consultation form and the filed request."
    ContactForm: "Contact form without an account, channels beside it, and the sent state."
    CustomTrainingRequest: "Custom training request: trainees, topic, date, place."
    DocumentRequestDialog: "The document request dialog: the chosen documents and the purpose."
    NewsletterSignup: "Newsletter signup: home block, inline after articles, and the double opt-in state."
    Onboarding: "Onboarding after sign-up: phone, optional details, consent, then back to where they were."
    SignIn: "Clerk sign-in and sign-up themed with the tokens, beside the reason to sign in."
  feedback:
    Dialog: "Dialogs: confirm, and the double confirmation for deletes."
    EmptyState: "Empty lists as an empty record, with the reason and a next step."
    ErrorState: "Errors at three sizes: field, section, page."
    NotFound: "The 404: one sentence in the system's language, a search, and four ways back."
    Notice: "Inline notices: success, info, warning, error."
  workspace:
    AppShell: "The account and dashboard frame: index sidebar and top bar."
    ChatThread: "A consultation as correspondence: status on top, messages by day, the composer."
    ContentEditor: "The content editor: Arabic and English tabs, draft or published, preview."
    DataTable: "Dashboard tables: sort, filter, select, row actions; stacked on phones."
    DocumentViewer: "The client's documents and the viewer around a watermarked page."
    MeetingCard: "A meeting: day block, title, local time with the zone named, platform link."
    StatTile: "Dashboard home: what needs attention first, then the monthly chart."
---

# DESIGN.md: The record

Ahmed chose this direction ("The record") on 2026-11-20. The live design system, with a preview and guidelines for every component in light and dark, is the source: https://claude.ai/artifact/SzbYLxMUnJ5HRR2m6UXqNs. The reference stylesheet and compiled tokens are in `docs/design/system/`. `docs/design/SOUL.md` sets the feeling; this file sets the look. Where they seem to disagree, `SOUL.md` wins and you ask the product owner.

The site of Ahmed Alzubairi, a consultant in management, governance, humanitarian work and development. Its soul, from `docs/design/SOUL.md`: **sitting across the table from someone who has seen a great deal, and is calm because of it.** This system says how that looks: the serenity of a well-kept institutional record. Precise grid, dates, places, documents, and his own voice. Arabic is the original; English is a careful translation.

Every page passes one test: would a minister and a displaced mother both feel respected here?

## Voice

- Write in Ahmed's first person: "أعمل مع…", "I work with…". Never "Ahmed is a leading…".
- Use short, measured sentences with no superlatives ("الأفضل", "الرائد", "world-class") and no urgency ("الآن!", exclamation marks).
- Say what happened and what changed, then stop. Numbers always come with a sentence that says what they mean.
- Use "أخبرني بما تواجهه" in place of "Request a consultation now!". Button labels named in `project.md` ("اطلب استشارة", "تعرّف على خبرتي", "طلب الاطلاع", "اطلب هذه الخدمة") stay exactly as written.
- Errors explain what went wrong and what to do, never blame, and never apologise at length.
- Never promise a response time.
- Mark draft copy as draft. Ahmed writes or approves every sentence in his voice before launch.

## Colour

- Pages sit on `bg`. `surface` is the only raised ground: the letter's margin, a featured row, side panels, disabled controls. It is not a card behind every item.
- Text is `ink`; metadata, hints and captions are `ink-2`. Both pass 6:1 or better on `bg` and `surface` in both themes.
- `accent` (deep teal, light cyan in dark mode) is rare by rule. Use it for the primary action, links, the current item, focus, and the "ما تغيّر" line of a record. If a screen has more than a few accent marks, remove some. Text on an accent fill is `on-accent`.
- `rule` (= `ink`) draws the 2px line that opens a section, a record, the header and a dialog. `line` draws hairlines between rows. `line-strong` draws edges that carry meaning (inputs, checkboxes, the drop zone).
- `accent-wash` marks a selected row or chosen filter. `surface-hover` is row hover.
- Status colours (`success`, `warning`, `danger`, `info`) always come with a word and a glyph. `success` and `danger` share lightness, so colour alone never tells them apart.
- Overlays use `scrim` behind and `shadow-overlay` on the floating element. Nothing on the page itself casts a shadow.

## Type

- One family covers both scripts: **Alexandria** (400, 500, 600), from Google Fonts. Load it with `next/font/google` (subsets `arabic` and `latin`). **IBM Plex Mono** (400, 500) is only for Latin data: file types, sizes, codes, Latin dates and times, phone numbers. Plex Mono has no Arabic.
- Arabic has its own scale (`ar-display` … `ar-caption`), larger and looser than English (`en-display` … `en-caption`). Never set Arabic with English sizes.
- Hierarchy comes from size, weight and space, not boxes. Headings use weight 500 (600 at `h3`), never bold-everything. No italics in Arabic. No all-caps labels. Never colour one word of a headline.
- Running text stops at `measure-ar` (34em) and `measure-en` (36em). Headings get `text-wrap: balance`.
- Use tabular figures wherever digits line up. Arabic pages use Arabic-Indic digits in prose; emails, phones and URLs stay LTR with Western digits (`.r-input--ltr`, `dir="ltr"`).

## Space and layout

- The grid has 12 columns on `container` (1312px), with 32px gutters (`space-6`). It drops to 8 columns at 768px and 4 at 375px, with 16px phone margins.
- Leave `space-9` (112px) between sections, 64px on phones.
- **The label column** (`label-col`, 120px) is the system's spine. Records, ledgers, testimonials, the letter's margin and chat senders all start with it. It is what makes every page read as one record.
- Corners are square everywhere (`radius-0`). `radius-round` is only for true circles: radio buttons, status dots, dashboard initials.
- Lay sibling groups out with grid or flex and `gap`. Use logical properties only (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`), so RTL and LTR share one stylesheet.

## The record: the signature pattern

A record is a 2px `rule`, then a meta line (organization · area · years), then a title, then label rows: **الحال / ما فعلتُ / ما تغيّر** (situation, what I did, what changed). The "what changed" label is the one accent. Projects, filed consultation requests and the course schedule are all records. The pattern bends for other content (ledgers for numbers, journal rows for articles, a press log for media, a register grid for logos, a spine for the career), so lists never become the same card grid.

## Imagery

- Use documentary photos in natural light: people working, talking, listening, deciding, shown with dignity, never as objects of pity. Show their true colours, with no filters, frames, rounded corners or shadows.
- There are four crops: 4:5 for Ahmed, 3:2 for work, 1:1 for detail, 16:9 for quiet backgrounds. A caption line in `ar-caption` sits underneath. A missing photo shows the hatched `.r-photo-missing`, never a broken image.
- The photos uploaded in this system are AI-generated **dev placeholders**. Real photos, with consent, replace every person before launch.
- Heritage shows only through Arabic typography and the dignity of people. Use no flags, landmarks or national motifs.

## Iconography

- Icons are inline SVG: 1.5 stroke, square caps, mitred joins, `currentColor`, 20 or 24px. The set is in the Icons card. There is no icon font and no emoji.
- An icon sits next to a word. Icon-only buttons (menu, close, theme, notifications) carry an `aria-label`.
- Directional icons (next, external link, the "more" arrow) take `.dir-icon`, so they mirror in LTR.

## Motion

- A page gets at most one orchestrated moment: it settles on load in 600ms (opacity plus an 8px rise, the rule first, then the title, then the rest).
- Hover and state changes take 200ms colour transitions. Nothing moves on scroll. Nothing loops, bounces or counts up unless Ahmed chooses a single calm count for the quick stats.
- `prefers-reduced-motion: reduce` removes all of it (the stylesheet already does).

## States

Every list has empty, loading and error states (the EmptyState, Skeleton and ErrorState cards). Every control has default, hover, focus, pressed, disabled and loading states where they apply (Button, TextField, Choice). Focus is always the 2px `focus` ring with a 3px offset, solid, at 3:1 or better on every surface.

## Banned patterns

These break the soul. They are not allowed anywhere, in any theme:

- A centred hero with a title, a subtitle and two buttons. A photo in a gold (or any) frame.
- The same card grid on every section. Icons in circles. A short accent bar above headings. Coloured left-border cards.
- Gradient blobs, glass, glow, decorative shadows. Fade-and-slide on every block. Scroll-triggered reveals.
- Bouncy, fast or looping counters. Logo walls high on the home page. "Trusted by" strips.
- The two "premium" clichés: cream/ivory with a serif and a clay or gold accent; navy with gold.
- One word of a headline in another colour or in italics. All-caps eyebrow labels over sections.
- Stock handshakes. AI-generated faces after launch.
- Added by this system: rounded corners anywhere except true circles; pill buttons; zebra-striped tables; chat bubbles; a coloured banner as the closing call to action; a status shown by colour alone; a heavy rule used to box or close something.

## Using it in the codebase

- Tokens go into `apps/web/app/globals.css` as CSS custom properties for both themes (`[data-theme="dark"]` plus `prefers-color-scheme`), exposed to Tailwind v4 through `@theme`. Names stay as they are here (`--bg`, `--ink`, `--accent`, `--rule`, …).
- The reference stylesheet is `components/bundle.css` here, exported to the repo as `docs/design/system/components.css`. Port each class into the matching React component in `apps/web/components`. `docs/design/components.md` names the file for each item.
- Every UI string comes from `apps/web/messages/{ar,en}.json`.

## Components

Every item in `docs/design/components.md` has a card in the design system. Each card shows its states in Arabic (and English where the layout changes). The card's guidelines say what the consumer provides and what not to do.

### Foundations

- **FocusAndMotion**: One focus ring everywhere, and one settling moment per page.
- **Grid**: The page grid: 12 columns, a fixed label column, reading measures.
- **Icons**: One line icon set: 1.5 stroke, square caps, 20 or 24px.
- **Numbers**: How digits, dates and times read in each language.
- **Photography**: Documentary photos at four crops, with a data line underneath.

### Primitives

- **Button**: Actions: primary, secondary, quiet and danger, square-cornered.
- **Choice**: Checkbox, radio and switch, plus the consent checkbox.
- **Divider**: The heavy rule that opens, the hairline that separates, the dated rule.
- **FileInput**: The drop zone and file rows: uploading, attached, refused, failed.
- **FilterChips**: Multi-select filters with a square check and a count.
- **Link**: Inline links, navigation links and "more" links.
- **Pagination**: Page navigation: previous, numbers, next; mirrored in RTL.
- **SearchField**: Search with a live result count and an honest no-results line.
- **Skeleton**: Loading placeholders shaped like the content they stand for.
- **StatusPill**: Every consultation and document status as glyph plus word.
- **Tabs**: Single-choice tabs with an accent underline.
- **Tag**: Small outlined labels for categories and types.
- **TextField**: Text, email, phone, select and textarea fields with label, hint and error.

### Site shell

- **ConsultationCta**: The closing invitation on public pages.
- **Footer**: Footer: a short line in his voice, the index, newsletter, channels, legal.
- **Header**: Site header: name and fields, navigation, language, theme, sign in, "اطلب استشارة".
- **LanguageAndTheme**: The language switch (with the untranslated case) and the three-way theme switch.
- **MobileMenu**: The phone menu: a numbered index of sections, opened over the page.
- **PageHeader**: The top of every main page: title, one sentence of his, the page's facts.
- **QuickContact**: Quick contact: WhatsApp and email always within reach.
- **SectionShell**: The frame every home section uses: rule, title, his intro, "see all".
- **SkipAndConsent**: Skip link, and the analytics consent bar.

### His voice

- **HisSentence**: One sentence of his, large between sections, or inline in a record.
- **Letter**: A short letter from Ahmed on the home page, signed by hand.
- **Signature**: The scanned signature, one file per theme.
- **WhyITookIt**: A margin note on a project page: why he took it on.

### Content

- **ArticleBody**: Long-form typography for articles in both languages.
- **ArticleItem**: Articles as a journal index: date column, title, one line, time to read.
- **Audience**: Who I work with: three rows read across, each with a real example.
- **CareerTimeline**: The career on a spine: years, role, one line.
- **CourseItem**: Training as a schedule: date block, title, type, place, seats left.
- **DocumentItem**: The public document list: title and category, select several, request access.
- **ExpertiseArea**: The three areas as chapters: title, his line, what it covers, real counts.
- **FAQ**: Questions grouped by category, opened one at a time.
- **Hero**: The home opening as a dossier: name, statement, actions, portrait and quiet ledger.
- **MediaFrame**: Image with caption, the contact-sheet gallery, and video before it loads.
- **MediaItem**: Media and events as a press log, with one featured video.
- **OrganizationLogos**: Approved organization logos as a calm register, low on the page.
- **ProjectPage**: Project page parts: facts, activities, results in numbers, gallery.
- **ProjectStory**: The record: the system's signature item for projects.
- **Qualifications**: Qualifications as a table, values as definitions, the CV link.
- **QuietStat**: Numbers as evidence: a band, inside a sentence, or a side ledger.
- **RegistrationPanel**: The course page's registration panel in its four states.
- **ResourceItem**: Free resources: file type glyph, title, line, area; direct download or for an email.
- **ServiceList**: Services as an index, one row opened as featured.
- **ServicePage**: Service page parts: who it suits, what you get, the stages, request this service.
- **Testimonial**: Quotes from real thank-you letters: one in full, others as excerpts.

### Forms

- **ConsultationRequest**: The new consultation form and the filed request.
- **ContactForm**: Contact form without an account, channels beside it, and the sent state.
- **CustomTrainingRequest**: Custom training request: trainees, topic, date, place.
- **DocumentRequestDialog**: The document request dialog: the chosen documents and the purpose.
- **NewsletterSignup**: Newsletter signup: home block, inline after articles, and the double opt-in state.
- **Onboarding**: Onboarding after sign-up: phone, optional details, consent, then back to where they were.
- **SignIn**: Clerk sign-in and sign-up themed with the tokens, beside the reason to sign in.

### Feedback

- **Dialog**: Dialogs: confirm, and the double confirmation for deletes.
- **EmptyState**: Empty lists as an empty record, with the reason and a next step.
- **ErrorState**: Errors at three sizes: field, section, page.
- **NotFound**: The 404: one sentence in the system's language, a search, and four ways back.
- **Notice**: Inline notices: success, info, warning, error.

### Workspace

- **AppShell**: The account and dashboard frame: index sidebar and top bar.
- **ChatThread**: A consultation as correspondence: status on top, messages by day, the composer.
- **ContentEditor**: The content editor: Arabic and English tabs, draft or published, preview.
- **DataTable**: Dashboard tables: sort, filter, select, row actions; stacked on phones.
- **DocumentViewer**: The client's documents and the viewer around a watermarked page.
- **MeetingCard**: A meeting: day block, title, local time with the zone named, platform link.
- **StatTile**: Dashboard home: what needs attention first, then the monthly chart.
