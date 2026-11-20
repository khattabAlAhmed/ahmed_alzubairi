# Prompts for Claude Design

We build the **design system first**, then pages from it. Three stages, one Claude Design project, each stage a message you paste. Don't skip ahead: a page is designed only from components that already exist in the system.

| Stage | You get | Who decides |
| --- | --- | --- |
| 1. Foundations | Three foundation options, each on one specimen board | Ahmed picks one |
| 2. The design system | Every component in `components.md`, every state, plus `DESIGN.md` | Ahmed and the product owner approve it |
| 3. Pages | Home, a project page, then every public page, built only from the system | Ahmed approves them |

## Before you start

1. Open claude.ai → Design → new project.
2. Attach from the repo: `docs/design/SOUL.md`, `docs/design/components.md`, `docs/project.md` (Claude Design reads §1, §6.1–6.16 and §13), and the photos you have in `docs/design/images/`.
3. If Claude Design offers to build a design system from the repo or the live site, **say no**. That's the look we're replacing. We build a new one from `SOUL.md`.
4. Paste stage 1 below as your first message.

When stage 2 is approved, and if your plan shows the option (onboarding or organization settings), save it as your design system in Claude Design, so every later project starts from it.

---

## Stage 1: Foundations

```text
You are building the design system for the personal professional website of
Ahmed, a consultant in management, governance, humanitarian work and
development. His clients are ministries, international and local humanitarian
organizations, companies, and individual trainees. The site is bilingual:
Arabic first (RTL), then English. We build the design system first. No pages
yet.

THE SOUL. Read SOUL.md, attached. In one line:
"Sitting across the table from someone who has seen a great deal, and is calm
because of it." Visitors should leave feeling they met Ahmed, not that they
browsed a consultant's website. The feeling is calm, earned trust. What they
remember is his voice: he speaks to them in the first person.

THIS IS A FULL REFRESH. Colors, fonts and shapes are all open. Do NOT return to
either of these. They are what we're escaping:
- cream/ivory background + serif headings + gold or clay accent
- navy + gold "executive consultant"
Also banned: centered hero with title + subtitle + two buttons; photo in a gold
frame; the same card grid on every section; icons in circles; a short accent bar
above headings; gradient blobs, glass, glow; fade-and-slide on every block;
all-caps eyebrow labels; one word of a headline in another color; logo walls high
on the page; stock handshakes.

UNIVERSAL, NOT LOCAL: no country motifs, flags or landmarks. Heritage shows only
through Arabic typography and the dignity of people in photos.

HARD CONSTRAINTS (the code must be able to honor these):
- WCAG AA contrast in both themes. Keyboard and screen-reader friendly.
- RTL is native, not mirrored English: Arabic gets its own type sizes and line
  heights. Directional icons mirror.
- Fonts cover Arabic and Latin (one family with both, or a deliberate pair),
  are licensed for the web, and load with Next.js next/font. Few weights.
- Motion is slow and rare: at most one orchestrated moment per page. Everything
  works with reduced motion.
- Mobile first, works at 375 px. The home page must load in under 3 seconds on
  a weak mobile network.

WHAT TO MAKE NOW: three distinct FOUNDATION options, each one honest to the soul.
Push each further, or replace one if you find a better one:
  A. "The letter": typographic and editorial. Near-monochrome, one ink-like
     accent. His words lead.
  B. "The room": warm natural light, photography-led. The visitor feels
     invited to sit down.
  C. "The record": a precise grid, dates, places, documents. The serenity of a
     well-kept institutional record.

For EACH option, make ONE specimen board, in light and dark, with:
  1. Color: neutrals, the one accent, text and surface roles, status colors,
     with contrast ratios.
  2. Type: the Arabic scale and the English scale, from caption to display,
     shown with realistic long Arabic text (no lorem ipsum). Arabic first.
  3. Spacing, radius, the focus ring, the icon style, the photo treatment.
  4. A small set of sample components so the feel is visible: a primary and a
     secondary button, a text field with an error, a page header with one
     sentence of his, one quiet stat, one project story item (situation, what
     he did, what changed), a testimonial from a thank-you letter, and the
     header bar at 375 px and 1440 px.
Write the sample copy in his first-person voice: measured, short sentences, no
superlatives, no hype. Mark all copy as draft.

For each option, explain in three sentences: what the visitor feels, what makes
it unmistakably Ahmed's, and the biggest risk.
```

---

## Stage 2: The design system

Paste this once Ahmed has picked an option. Replace `[A/B/C]` and add his notes.

```text
Ahmed chose option [A/B/C]. His notes: [his notes, or "none"].

Now build the complete design system from that option. components.md (attached)
lists every item it must contain, grouped as foundations, primitives, site
shell, his voice, content, forms and flows, feedback, and account and
dashboard. Build every item on that list. Ignore its "Code today" column, it's
for the developers.

For every component:
- Arabic first, then English. Light and dark. 375 px and 1440 px where the
  layout changes.
- Every state named in components.md (default, hover, focus, pressed,
  disabled, loading, empty, error, success, as they apply).
- Realistic Arabic and English content, never lorem ipsum. First-person voice
  where he speaks. Mark copy as draft.
- A short usage note: when to use it, when not to, and which banned pattern it
  could slide into if misused.

Keep the soul in the system, not only in the pages:
- Hierarchy comes from type and space. Borders, boxes and shadows stay rare.
- The accent appears rarely, so it means something.
- "His voice" components (the letter, his sentence, why I took it on, the
  signature) get the most care. They are what visitors remember.
- Lists (projects, articles, services) must not all become the same card grid.
  Give each list type its own form.

Then write DESIGN.md in Google's DESIGN.md format: YAML front matter with
colors (light and dark), typography (Arabic and English scales), rounded,
spacing, motion and components; then prose on why each choice serves the
soul, how each component is used, a motion section, and a "Banned patterns"
section that repeats the bans from my first message plus any this system adds.

Show the whole system on organized boards (foundations, then each group in the
order of components.md), so it can be reviewed in one pass.
```

---

## Stage 3: Pages, from the system only

Paste this once the design system is approved.

```text
The design system is approved. From now on, use only its tokens and components.
If a page needs something the system doesn't have, stop and propose the new
component first, as an addition to the system, before using it.

First, two pages, Arabic first, then English, at 1440 px and 375 px, light and
dark:
  1. Home. Sections in this default order (the team can hide or reorder each
     one, so each must stand on its own): hero (photo, name, title, one-line
     value statement, primary action "تعرّف على خبرتي", secondary
     "اطلب استشارة") · quick stats (years, projects, organizations, trainees)
     · expertise (3 areas) · who I work with (government, humanitarian,
     private) · featured services · selected projects (3, each with one key
     result) · approved organization logos · testimonials from thank-you
     letters · latest media appearance · latest articles and resources ·
     newsletter · quick contact. Site-wide: an always-visible "اطلب استشارة",
     language switch, theme switch.
     [Add Ahmed's decisions here: the letter yes/no, stats animate yes/no,
     hero composition.]
  2. One project page, told as a short story: situation, what he did, what
     changed.

When I approve those two, extend to: about, services list and one service,
expertise, contact, the projects list, the blog list and one article,
resources, media, training list and one course, clients and testimonials, the
public documents list, FAQ, a 404, and the sign-in screen. Every list shows its
empty, loading and error states.

Then package the handoff for Claude Code: DESIGN.md (updated with any
components added in this stage), tokens, component specs, assets, and a
screenshot of every component board and every page, in Arabic and English,
light and dark.
```
