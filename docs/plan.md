# Plan

The build order for the Ahmed Alzubairi website. `docs/project.md` describes each feature in detail.

The PRD's four stages map to these phases: stage 1 is Phases 1–2, stage 2 is Phases 3–4, stage 3 is Phases 5–6. Stage 4 (recorded courses and trainee certificates) is out of scope until its own document exists.

## Rules

- Build phases in the order they appear in this file. Don't add, remove, or reorder phases. Phase 8 was added later by the product owner: it runs after Phase 6 and before Phase 7, so the site launches with the new design.
- Every phase after Phase 0 has two parallel lanes, one per developer, so nobody waits.
- The designer owns no lane. Design tasks run before a lane, when developers need their tokens or components, or after a lane merges, as polish on those pages. A design task never runs at the same time as a task on the same paths.
- Each phase is one board in JSM HQ. The lead creates the board and its tasks there, with the product owner, before the phase starts. The next phase can be broken down while the current one is being built.
- Tasks and their status live only in JSM HQ. This file never lists tasks.
- A phase is done when all its tasks are merged, its "Done when" checks pass on the latest Vercel preview, it was tested on mobile and desktop, in both languages and both themes, and Ahmed has reviewed and approved it. Production goes live only once, in Phase 7.
- Each phase lists the keys it needs. When an agent reaches a step that needs one, it stops and asks (see `CLAUDE.md`), and the product owner adds it. Agents never create accounts or handle raw keys in chat.
- Keep JSM HQ's "Export plan to docs/plan.md" off. It would overwrite this file.

---

## Phase 0 — Setup

**Goal:** an empty app that builds and deploys. This is the only phase with one lane, because everything else builds on it.

**Lanes:** one. The lead plans it like any other phase, and gives every task to one developer.

**Keys needed:** none at the start. The product owner connects Vercel during this phase, before its last task: imports the repo (automatic promotion off), allows `*.vercel.app` in each developer's sandbox, and adds `VERCEL_AUTOMATION_BYPASS_SECRET` to each developer's env file (Vercel → Deployment Protection → Protection Bypass for Automation). The lead plans the Vercel check as the last task.

| Includes | project.md |
| --- | --- |
| Monorepo with `apps/web`, `packages/shared`, `packages/db` | §10 |
| Next.js app with TypeScript and Tailwind | §3 |
| Vercel project: a preview per PR, production from `main` (automatic promotion off) | §3, §4 |
| `.env.example` with every variable | §11 |
| `.nvmrc`, and a GitHub Actions CI workflow that runs `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` on every PR and on `main` | §10 |

**Done when:** a PR gets a Vercel preview URL, and the home page loads on it; CI runs on that PR and passes.

---

## Phase 1 — Foundation

**Goal:** the shared contract, the database, sign-in, and the empty shells in both languages.

**Keys needed:** the Supabase dev project (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`), the Supabase MCP connected to each developer and scoped to the dev project, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`, and Clerk set up as a third-party auth provider in Supabase

| Lane | Includes | project.md |
| --- | --- | --- |
| **A — Contract + database** | Supabase migrations for all tables, Storage buckets, RLS policies and grants, seeded roles, `has_permission`, the user and service clients, generated types. `PERMISSIONS`, limits and shared types for every API route. | §5, §7, §8 |
| **B — Auth + shells** | Clerk sign in / sign up with `arSA`, onboarding page, `profiles` row, middleware, return path. `next-intl` routing, RTL, theme switch. Public header and footer, empty account and dashboard layouts. | §6.1, §6.16, §13 |

The designer builds the design tokens and fonts first. Lane B builds on them.

Lane B also checks the two items in §14 "To verify in Phase 1" and reports the result.

**Done when:** migrations run on dev; a new user signs up, completes onboarding and lands on an empty account page; `/ar` and `/en` show the shell, mirrored, in both themes.

---

## Phase 2 — Public site + content dashboard

**Goal:** the public site reads from the database, and the team can edit all of it.

**Keys needed:** `ARCJET_KEY`

| Lane | Includes | project.md |
| --- | --- | --- |
| **A — Content dashboard** | Content editors with Arabic and English fields, draft/published, preview, Tiptap, image upload. Home sections (edit, hide, reorder), quick stats, testimonials and logos with consent and admin approval, site settings. Cache revalidation on publish. | §6.2, §6.11, §6.20 |
| **B — Public pages** | `lib/content`. Home, about, expertise, services, projects with filters and hidden names, clients and testimonials, public document list, FAQ, legal pages. Contact form with Arcjet, saved to `contact_messages`. Missing-translation behavior. | §6.2–6.6, §6.11–6.14, §6.25 |

Lane B builds against made-up seed content until Lane A is merged.

**Done when:** an edit in the dashboard appears on the public page after publishing; a section hidden there disappears; a testimonial without consent or admin approval never appears; a project with a hidden name doesn't send the name to the browser; an English-only item is absent from `/ar`.

---

## Phase 3 — Team + email

**Goal:** the team signs in with the right permissions, and the site sends email.

**Keys needed:** `RESEND_API_KEY`, `EMAIL_FROM`, a domain verified in Resend with SPF and DKIM, `CRON_SECRET`, `CLERK_WEBHOOK_SIGNING_SECRET`, and a Clerk webhook to `/api/clerk/webhook`. A verified domain is required: Resend won't send to real recipients without one. Any domain the product owner controls works until the final one is chosen.

| Lane | Includes | project.md |
| --- | --- | --- |
| **A — Team + clients** | Team and role management, invitations, permission editing, `audit_log`, disabling members. Clients section. Client disable and reactivate with Clerk ban. Profile page and account disable. Dashboard sections limited by permission. | §5, §6.16, §6.19, §6.20 |
| **B — Email + notifications** | `email_outbox`, React Email templates in Arabic and English, template editor, notification preferences, dashboard counter, messages section, contact email, `POST /api/cron/hourly` with Vercel Schedules, Clerk webhook. | §6.14, §6.21, §8 |

Lane A writes `email_outbox` rows through a stub until Lane B is merged.

**Done when:** each of the four roles sees only what §5 allows; a role edited in the dashboard takes effect without a deploy; a disabled member can't sign in; the contact form delivers an email to the admin's inbox that passes SPF and DKIM.

---

## Phase 4 — Consultations + documents

**Goal:** the two core client systems work end to end.

**Keys needed:** none new

| Lane | Includes | project.md |
| --- | --- | --- |
| **A — Consultations** | Request form with service preselected, attachments, chat, statuses, assignment, meetings with time zones, `.ics`, 24-hour reminder, closing, deleting with double confirmation. Client and dashboard views. | §6.17, §6.22 |
| **B — Protected documents** | Document upload, `request_document` with merging, recommendations, grant, contact first, expiry, withdraw, watermark pipeline, in-site viewer, access log. Client "وثائقي المتاحة" page. | §6.12, §6.18 |

Lane B needs the chat for "التواصل أولاً". It creates the `document_request` consultation first, and links it to the chat UI once Lane A is merged.

**Done when:** steps 3 to 10 of the core flow (§2) pass; an Arabic client name is correctly shaped in the watermark; a 4.5 MB+ PDF opens on the Vercel preview; a document URL fails when opened by another account; there is no reject button anywhere.

---

## Phase 5 — Audience + training

**Goal:** the blog, resources, media, newsletter and training are live.

**Keys needed:** `RESEND_AUDIENCE_ID`, `RESEND_WEBHOOK_SECRET`, and a Resend webhook to `/api/resend/webhook`

| Lane | Includes | project.md |
| --- | --- | --- |
| **A — Publishing** | Blog with search, categories, sharing and related articles. Resource library with direct and email-gated downloads. Media and events. | §6.8–6.10 |
| **B — Newsletter + training** | Double opt-in, Resend audience sync, unsubscribe webhook, subscriber list and export. Courses, registration with seat limit, "قريباً" badge, "اكتملت المقاعد", custom training requests, "دوراتي", training section of the dashboard. | §6.7, §6.15 |

Lane A adds a newsletter checkbox to the email gate after Lane B is merged.

**Done when:** an article in one language shows only in that language; an email-gated resource downloads only after the email is given; a subscriber gets nothing before confirming; unsubscribing updates the dashboard; two people can't take the last seat.

---

## Phase 6 — Analytics + SEO

**Goal:** we can measure the site and search engines can read it.

**Keys needed:** `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`. The wizard needs a browser sign-in, so the product owner runs it in the developer's sandbox (HQ's Bash tab). The developer then reviews its changes and builds the rest of the lane.

| Lane | Includes | project.md |
| --- | --- | --- |
| **A — Analytics** | PostHog wizard, events, funnel, error tracking, session replay on public pages only, cookie banner, dashboard home summary, statistics page. | §6.20, §6.23, §6.25 |
| **B — SEO + performance** | Metadata per page and language, `hreflang`, sitemap, robots, Open Graph, `noindex` rules. Image and bundle work to reach the 3-second target. Accessibility pass. | §6.24, §13 |

**Done when:** PostHog shows the events with no personal data; no replay exists for account or dashboard pages; `hreflang` appears only where a translation exists; the home page loads in under 3 seconds on a throttled mobile network.

---

## Phase 8 — Design refresh

**Runs after Phase 6, before Phase 7.**

**Goal:** the public site has a soul. A visitor feels calm, earned trust, and leaves feeling they met Ahmed, in his own voice, not that they browsed a consultant's website. A new identity, approved by Ahmed, built on every public page before launch.

**Why:** the current pages follow the default AI pattern: a gold bar over a heading, two buttons and a framed photo, then grids of identical cards on every section. Its palette (ivory, serif, gold) is the most common "premium" cliché of generated sites. §13 fixed colors and fonts but said nothing about feeling, voice, layout or what to avoid, and the designer had no design skills and no way to see its own work.

**Source of truth:** `docs/design/SOUL.md` (what it must feel like, and why), `docs/design/components.md` (every component the design system must contain) and, once approved, `docs/design/DESIGN.md` (how it looks). Read `SOUL.md` before any Phase 8 work.

**Order:** the design system comes first, then pages. Claude Design builds every component before it designs a page, and the team builds every component in code before a page is restyled.

### Already in place

- Every agent has three design skills, committed in `.claude/skills` and `.agents/skills`: Anthropic's `frontend-design`, `impeccable` (critique, polish, audit, and the `detect` scanner), and Vercel's `web-design-guidelines`. HQ never replaces skills the repo tracks.
- Every developer sandbox can download Playwright's browser, and has Chromium at `/usr/bin/chromium`.
- No Figma. Claude Design is the design tool.

### Before the board (product owner and Ahmed)

Agents don't start Phase 8 until these are done. The lead plans the board after step 6.

**Status (2026-11-20): every step below is done. The lead can plan the board.**

- Steps 1–3: Ahmed chose the foundation "The record", and Ahmed and the product owner approved the design system: https://claude.ai/artifact/SzbYLxMUnJ5HRR2m6UXqNs. `docs/design/DESIGN.md` is generated from it, and `docs/design/system/` holds its tokens and stylesheets.
- Step 4: every public page is designed and approved at https://claude.ai/artifact/CPd8qYyTAYhdEeRYBfeZXr, in Arabic and English, at 1440 px and 375 px, light and dark. Ahmed's decisions: the home page **keeps the letter** (so the contract change below applies), the quick stats are **static** (no count-up; this replaces "Numbers animate calmly on view" in `project.md` §6.2), and the hero is the **dossier**: statement on the start side, portrait on the end with the stats ledger beside it.
- Step 5: Ahmed gave the product owner his approval for the design and its decisions. The voice of the page copy is approved: headings, intros, buttons, and empty, loading and error states go into `messages/` as written in the mockups. **Facts are not approved copy.** Years, counts, career, qualifications, quotes, testimonials, organization names and contact details in the mockups are placeholders; they come from Ahmed's content in the dashboard. The letter ships with placeholder text and a placeholder signature (`docs/design/letter-placeholder.md`, `docs/design/images/signature-placeholder*.svg`), marked as placeholders on the page. The product owner replaces them with Ahmed's words and signature scan before launch.
- Step 6: the handoff is in `docs/design/`: `DESIGN.md`, `system/` (tokens, `components.css`, `pages.css`), `mockups/` (a static copy of every page and every component board; open `mockups/index.html`) and `screens/` (screenshots of every page at 1440 px light and dark and 375 px, and of every board light and dark).
- Step 7: DaVinci's role in HQ already makes `SOUL.md` and `DESIGN.md` its source of truth, and now points to the mockups.

1. **Placeholder photos.** Generate the images listed in `docs/design/images/README.md` with the prompts there, and save them in that folder under the names given. They are dev placeholders.
2. **Foundations in Claude Design** (claude.ai → Design, included in the Claude Pro/Max plan). Attach `SOUL.md`, `components.md`, `project.md` and the photos, and paste stage 1 of `docs/design/claude-design-prompt.md`. It produces three foundation options, each on one specimen board, Arabic first. **Ahmed picks one.** With it he settles §14 decision 3 (fonts and colors), and decision 1 (name and logo) if he's ready.
3. **The design system in Claude Design.** Paste stage 2. Claude Design builds every component in `components.md`, in every state, Arabic and English, light and dark, and writes `DESIGN.md`. **Ahmed and the product owner approve the system** before any page is designed. If the plan allows it, save it as the design system in Claude Design.
4. **Pages in Claude Design.** Paste stage 3: home and one project page first, then every public page, built only from the system. Before the home page, Ahmed settles three points where the soul meets §6.2: whether the quick stats animate, how the hero is composed, and whether the home page gets a short letter in his voice. **Ahmed approves the pages.**
5. **Ahmed's voice.** Ahmed writes, or approves, the words the design depends on: the letter (if kept), one sentence of his for each main page, and a first-person rewrite of the hero and section intros. A scan of his real signature if the letter is kept. Draft copy from Claude Design is never shipped as his words.
6. **Hand off.** Ask Claude Design for the handoff. Put `DESIGN.md`, the bundle, and a screenshot of every component board and every page (Arabic and English, light and dark) in `docs/design/`.
7. **DaVinci's role in HQ** (Settings → Team → DaVinci → role). Replace its first bullet with: "`docs/design/SOUL.md` and `docs/design/DESIGN.md` are your source of truth; §13 keeps the rules that aren't style. Don't invent a new style, colors or fonts. If you think the design should change, ask the product owner."

**Keys needed:** none. The inputs above are the product owner's and Ahmed's job.

**Contract change (Ahmed kept the letter):** a new home section (the letter text in both languages, and the signature image) is a contract change. The lead plans it as the first task of the phase, and the product owner approves it, as `CLAUDE.md` requires.

### Rules for this phase

- `DESIGN.md` replaces §13's look. §13 keeps the rules that aren't style: contrast, RTL, states, responsive, performance, accessibility. Where they disagree with `SOUL.md`, ask the product owner.
- Pages are composed only from the design system's components. If a page needs one the system doesn't have, add it to `components.md` and the system first (with DaVinci and the product owner), then use it. Never a one-off style inside a page.
- Build to the approved mockups in `docs/design/mockups/` (pages and component boards; add `?theme=dark` for dark). If a screen has no mockup, follow `SOUL.md` and `DESIGN.md` and ask DaVinci, never the model's defaults.
- Nothing from "What breaks the soul" in `SOUL.md`, and nothing `DESIGN.md` bans.
- UI copy in `messages/` follows the voice in `SOUL.md`: first person, measured, no hype. Copy that changes meaning, and any button label named in `project.md`, needs the product owner's approval.
- Look at your work. Every UI PR shows before and after screenshots at 375 px and 1280 px, in Arabic and English, light and dark, next to the matching mockup.
- The 3-second mobile target from Phase 6 still holds. Fonts and motion count toward it.

| Lane | Includes | project.md |
| --- | --- | --- |
| **Foundation — the design system in code, before the lanes** | Every item in `components.md`, built to the approved component boards in `docs/design/mockups/components/`. Tokens for both themes in `globals.css`, the chosen fonts with `next/font`, an Arabic and an English type scale (Arabic sits larger, with more line height), spacing, radius, motion. Then the primitives, the site shell, his voice, content, forms and feedback components, restyling the files listed under "Code today". A design-system page at `/[locale]/design-system` that shows every component in every state: not linked, `noindex`, and a 404 in production. Optimize the **design** images into `apps/web/public/images/`. A `pnpm screenshots` script (Playwright, using the sandbox's Chromium) that captures the design-system page and the public pages at both widths, both languages, both themes. Update §13 and §14 in `project.md` to point to `docs/design/`. | §13, §14 |
| **A — Identity pages** | Header, footer, mobile menu. Home, every section, including the letter if approved. About, expertise, services. | §6.1–6.5, §6.11 |
| **B — Work and reading pages** | Projects as short stories, clients and testimonials, the public document list, training, blog, resources, media, FAQ, contact, legal pages, 404. Empty, loading and error states on all of them. Clerk sign-in and sign-up themed with the new tokens. | §6.6–6.14, §6.25 |

Foundation is too large for one PR. The lead splits it into tasks by the groups in `components.md` (foundations and primitives first, then the shell, then the rest). DaVinci owns it; the lead may give later groups to a developer. Each task's PR shows its components on the design-system page next to the matching board. Both lanes wait until every Foundation task has merged. The product owner uploads the **content** placeholder photos to the dev project through the dashboard (hero photo, project galleries) once Foundation is merged.

After each lane merges, DaVinci runs a polish task on those pages: `impeccable` critique and polish against the mockups and `SOUL.md`, and Vercel's guidelines check.

The account and dashboard pages get the new tokens only, not a redesign. Lane B checks they still pass contrast and read well in both themes.

**Done when:** Ahmed approved the foundations, the design system and the pages, and `SOUL.md`, `components.md`, `DESIGN.md` and the handoff are in `docs/design/`; every component in `components.md` is on the design-system page and matches its board; every public page matches its mockup on the latest preview, in Arabic and English, light and dark, at 375 px; `impeccable detect`, run against the running app (`detect http://localhost:3000/ar` and `/en`, every public page), finds no anti-patterns; contrast is WCAG AA in both themes; the home page still loads in under 3 seconds on a throttled mobile network; "reduce motion" turns motion off; account and dashboard pages still read correctly; **the soul check passes:** Ahmed and one person outside the team each look at the home page for a minute, then say in their own words what they felt, and it matches the one line in `SOUL.md`; Ahmed approved the preview.

**Before launch (Phase 7):** every placeholder photo of a person is replaced by a real one, with consent. `docs/design/images/README.md` lists the order. The placeholder letter and signature are replaced with Ahmed's own, and the placeholder tag beside the letter is removed.

---

## Phase 7 — Harden + launch

**Goal:** the core flow works on production, with no open security issues.

**Keys needed:** the Cloudflare R2 bucket and the GitHub Actions secrets in §11. At the end, the product owner creates the Supabase prod project and a Clerk production instance on the site's domain, and sets Vercel's production variables. Before this phase starts, §14 decisions 1, 2, 6, 7, 8, 10 and 11 must be settled.

| Lane | Includes | project.md |
| --- | --- | --- |
| **A — Security** | Fix open review findings, security headers, final pass on every rule in §9, the malware scanning decision, team 2FA if chosen. | §9, §14 |
| **B — Backups + launch** | Nightly backup job, one tested restore, responsive and empty-state polish, `docs/launch.md` runbook, run the full core flow on `main`. | §2, §4, §6.26 |

**Done when:** the product owner follows `docs/launch.md`: creates the Supabase prod project and the Clerk production instance, applies every migration, sets Vercel's production variables and promotes the build; Ahmed's real content and the approved legal text are entered; a first backup is verified; then all ten steps of the core flow (§2) pass on the production URL.
