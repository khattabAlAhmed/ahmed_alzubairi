# Project: Ahmed Alzubairi — Professional Website

A bilingual (Arabic / English) professional website that presents Ahmed as a consultant and expert in management, governance, humanitarian work and development. It is the **only official front door** where organizations learn about his expertise, request his services, follow their consultations, and review proof of his experience.

**Main visitor path:** learns the expertise → trusts the credibility → creates an account → requests a consultation and follows it from the account.

This file is the source of truth for **what** we build. `docs/plan.md` says **in what order**. Tasks, owners and status live in JSM HQ.

Arabic text in this file is exact UI copy or a domain term. Use it as written. Don't translate it back from the English next to it.

---

## 1. Users

| User | What they do | Where |
| --- | --- | --- |
| **Visitor** | Reads the public site, sends the contact form, subscribes to the newsletter, downloads resources | Public site |
| **Client** | Signs up, requests consultations, chats, attaches files, requests protected documents, registers for courses | Account |
| **Admin (المدير, Ahmed)** | Full access, including the final decision on documents | Dashboard |
| **Assistant consultant (مستشار مساعد)** | Replies to consultations assigned to them | Dashboard |
| **Content editor (محرر محتوى)** | Manages articles, projects, resources and pages | Dashboard |
| **Training coordinator (منسق تدريب)** | Manages courses, registrations and custom training requests | Dashboard |

| Audience | Examples | Looking for | Must find |
| --- | --- | --- | --- |
| Government | الوزارات والمؤسسات الحكومية | A trusted consultant with institutional experience | Work with government bodies, governance, official documents |
| Humanitarian and non-profit | Local and international organizations | Experience in protection and الدبلوماسية الإنسانية | Projects and results, partner organizations |
| Private sector | Companies | Governance and management consulting | Clear services, measurable results |
| Individuals and trainees | Youth, sector workers | Training and professional growth | Courses, free resources, articles |

---

## 2. Core flow

The whole product in one flow. When this works end to end, the product is done.

1. Open `/ar`. The home page reads right to left. Switch to `/en` and to dark mode. Both work.
2. In the dashboard, the admin changes a quick stat and reorders a home section. The public page shows it.
3. On a service page, press "اطلب هذه الخدمة" while signed out. Sign up, verify the email, complete the profile.
4. Land back on the consultation form with the service already selected. Attach a file and submit. The client and the admin each get an email.
5. The admin assigns it to an assistant consultant, who sees only that consultation and replies. The client gets an email.
6. The consultant adds a Zoom meeting. The client sees it in their own time zone and gets an email with an `.ics` file.
7. The consultation is closed and stays in both histories.
8. The client presses "طلب الاطلاع" on a document. A team member adds a recommendation. The admin picks "التواصل أولاً", they talk, then the admin picks "إتاحة".
9. The client opens the document inside the site, with a watermark of their name and the date. The view is logged.
10. The admin withdraws access. The document disappears from "وثائقي المتاحة".

---

## 3. Stack

| Layer | Tool | Notes |
| --- | --- | --- |
| App | Next.js (App Router) + TypeScript + Tailwind | Public site, account and dashboard under `/[locale]/*`, API routes under `/api/*` |
| Languages | `next-intl` | `/ar` (default, RTL) and `/en` (LTR). UI strings in `apps/web/messages/{ar,en}.json`. |
| Theme | `next-themes` | Follows the device by default and saves the visitor's choice |
| Database | Supabase Postgres | Two projects: dev (shared by developers and Vercel previews) and production. The app talks to it only through `supabase-js` and the Data API (§7). |
| Data access | `supabase-js`, Postgres functions (`rpc()`) | User client (the user's Clerk token, RLS applies) and a server-only service client (secret key). Rules that must hold under concurrency run inside Postgres functions. |
| Migrations + types | Supabase CLI | SQL files in `supabase/migrations`; types generated into `packages/db/types.ts` (`pnpm db:types`). Tests run on pglite with Supabase's roles stubbed, never a local Supabase stack. |
| File storage | Supabase Storage (`supabase-js`) | Buckets in §7, created by migrations. The browser uploads straight to Storage with a one-time signed URL. |
| Hosting | Vercel | Preview deployment per PR; production from `main`. GitHub Actions deploys both with the Vercel CLI; Vercel's Git integration is not used. Bodies are capped at 4.5 MB, so files never pass through our routes, in either direction. |
| Auth | Clerk | Sign in / sign up UI (`arSA` localization from `@clerk/localizations`), sessions, middleware. Supabase accepts Clerk session tokens (third-party auth), so RLS reads the user ID from `auth.jwt()->>'sub'`. |
| Email | Resend + React Email | All transactional email, sent from the site's domain with SPF and DKIM. Newsletters use Resend Broadcasts. |
| Security | Arcjet | On every public form and download gate: a fixed-window rate limit per route + IP, bot detection and Shield. Fails open: an Arcjet error or timeout lets the request through and is logged. |
| Analytics | PostHog | Product analytics, error tracking, funnels. Session replay on the public site only. |
| Rich text | Tiptap | Article and long-page editor. Stored as JSON (§9 XSS). |
| Watermarks | `pdf-lib`, `sharp`, `@napi-rs/canvas` | See §6.18 |
| Document viewer | `pdfjs-dist` | Renders PDFs inside the site |
| Calendar file | `ics` | The meeting invitation attachment |
| Scheduled jobs | Vercel Schedules | Hourly call to `POST /api/cron/hourly` (§8) |
| Backups | GitHub Actions + Cloudflare R2 | See §6.26 |

**Not used from the base template:** OpenAI, pgvector, Clerk Billing and the embeddable widget. This product has no AI feature, no online payment and no widget.

**Constraint:** every tool must work on its free tier for the whole build. Don't add a paid service or a paid-only feature. Production is different: see §14.

---

## 4. Environments

| Environment | What it is | Who deploys |
| --- | --- | --- |
| Production | Vercel production (from `main`) + the Supabase prod project + a Clerk production instance | Product owner only: merges to `main`, runs any migration, then promotes the build |
| Preview | A Vercel preview deployment per PR + the Supabase dev project | Automatic on every push to a same-repo PR: the Deploy workflow deploys it with the Vercel CLI and comments the URL on the PR. CLI deploys carry no Vercel system variables at build time. |
| Local | `pnpm dev` + the Supabase dev project | Each developer |

| Rule | Detail |
| --- | --- |
| Shared dev database | Every developer agent and every preview share the dev project. Never apply an unmerged migration to it. Test new migrations on pglite (`packages/db/supabase-pglite.ts`). No local Supabase or Docker database. |
| Migrations | Run only after their PR merges: agents apply them to dev through the Supabase MCP (scoped to the dev project), recording the file's version. The product owner applies all of them to prod when production goes live. Every migration is additive ("expand and contract"): the live version keeps working while it runs. Drops and renames come in a later PR, once no deployed code uses the old shape. |
| Production rollout | Production goes live once, in Phase 7, following `docs/launch.md`: the product owner creates the Supabase prod project and the Clerk production instance, applies every migration, sets Vercel's production variables, and promotes the build. Until then, a merge to `main` makes a staged production build (the Deploy workflow runs `vercel deploy --prod --skip-domain`) and nothing is promoted. CLI deploys carry no Vercel system variables at build time. |
| Dev data is throwaway | Only migration files reach production. Never copy data from dev. Real content is entered in production at launch. |
| Never deploy production | Only the product owner merges to `main` and promotes production |
| Real client data | Never put real client names, letters or certificates in dev or in test fixtures. Use made-up data. |
| Clerk instances | Dev and previews use Clerk's development instance with test keys. Production holds real client accounts, so it uses its own Clerk production instance on the site's domain. Never launch on the development instance. Connect the production instance to the Supabase prod project as a third-party auth provider. |
| CI | GitHub Actions runs `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` on every PR and on `main`. |

---

## 5. Roles and permissions

Roles are data, not code. An admin can change which permissions a role has, or add a role, without a deploy. Permission keys live in one place: `PERMISSIONS` in `packages/shared`. Every gated action checks a permission on the server, never a role name.

| Permission key | What it allows | المدير | مستشار مساعد | محرر محتوى | منسق تدريب |
| --- | --- | :-: | :-: | :-: | :-: |
| `consultations.view_all` | See every consultation | ✅ | ❌ | ❌ | ❌ |
| `consultations.reply` | Reply to consultations assigned to you | ✅ | ✅ | ❌ | ❌ |
| `consultations.assign` | Assign consultations | ✅ | ❌ | ❌ | ❌ |
| `document_requests.recommend` | See document requests and add a recommendation | ✅ | ✅ | ✅ | ✅ |
| `documents.view` | Open the protected documents themselves | ✅ | ✅ | ✅ | ✅ |
| `document_requests.decide` | Final decision on document access | ✅ | ❌ | ❌ | ❌ |
| `documents.manage` | Upload and edit documents | ✅ | ❌ | ❌ | ❌ |
| `content.manage` | Edit pages, articles, projects, resources | ✅ | ❌ | ✅ | ❌ |
| `testimonials.approve` | Give the admin approval on testimonials and logos | ✅ | ❌ | ❌ | ❌ |
| `training.manage` | Manage courses and registrations | ✅ | ❌ | ❌ | ✅ |
| `messages.view` | Read contact form messages | ✅ | ✅ | ❌ | ❌ |
| `clients.view_all` | See all client data | ✅ | ❌ | ❌ | ❌ |
| `data.delete` | Delete any data | ✅ | ❌ | ❌ | ❌ |
| `team.manage` | Manage the team and settings | ✅ | ❌ | ❌ | ❌ |

**Scoped client data:** without `clients.view_all`, an assistant consultant sees only clients assigned to them, and a training coordinator sees only clients registered in courses.

**Testimonials and logos:** an editor may publish one only after the admin has approved it (§6.11).

**Name:** the site's name lives in one constant, `SITE_NAME` in `packages/shared`. Its value is a placeholder until the final brand is chosen (§14). Pages, emails and titles read it from there.

---

## 6. Features

Priority marks from the PRD: 🔴 required for launch, 🟡 important, 🟢 extra.

### 6.1 Site-wide elements 🔴

| Item | Detail |
| --- | --- |
| Always present | "اطلب استشارة" button, quick contact (WhatsApp / email), language switch, dark/light switch |
| Footer | Section links, contact channels, newsletter signup, privacy policy, terms of use |
| Languages | `/ar/...` and `/en/...`, with full mirroring of layout and directional icons |
| Missing translation | Content not translated is hidden in that language. Never show an empty page. The language switch on such a page goes to the section's list page. |
| Dark mode | A visible switch in the top bar. Default follows the device; the choice is saved. Covers the public site, the account and the dashboard. |
| Done when | Every page works in both languages and both themes, with no layout break in RTL |

### 6.2 Home page 🔴

Goal: show the expertise first, then direct the visitor. Sections in default order:

| # | Section | Content |
| --- | --- | --- |
| 1 | Hero | Personal photo, name and brand, professional title, one-line value statement. Primary button "تعرّف على خبرتي", secondary button "اطلب استشارة". |
| 2 | Quick stats | Years of experience, projects, organizations, trainees. Numbers animate calmly on view. |
| 3 | Expertise | Three cards |
| 4 | Who I work with (لمن أعمل) | Government, humanitarian, private |
| 5 | Featured services | |
| 6 | Selected projects | Three projects, each with one key result |
| 7 | Organization logos | Approved only |
| 8 | Testimonials | From real thank-you letters, approved only |
| 9 | Media | Latest appearance or event |
| 10 | Latest articles and resources | |
| 11 | Newsletter signup | |
| 12 | Quick contact | |

| Done when |
| --- |
| Every section can be edited, hidden and reordered from the dashboard |
| Quick stats are edited in the dashboard, never written in code |
| The page works in both languages and both themes |

### 6.3 About (من أنا) 🔴

Short and long bio, career timeline, qualifications, values and working method, CV download link (shown or hidden from the dashboard).

### 6.4 Expertise (مجالات الخبرة) 🔴

One page per area: description, experience, related services, related projects, organizations served.

| Area | Covers |
| --- | --- |
| الإدارة والحوكمة (Management and governance) | Management consulting, institutional governance, work with ministries and companies |
| العمل الإنساني (Humanitarian work) | الدبلوماسية الإنسانية, الحماية الإنسانية, work with organizations |
| التنمية (Development) | Preparing youth for the job market, economic empowerment of families in need |

### 6.5 Services (الخدمات) 🔴

Starting list, editable from the dashboard: الاستشارات الإدارية, الحوكمة المؤسسية, استشارات الحماية الإنسانية, الدبلوماسية الإنسانية, إدارة المشاريع التنموية, التدريب وبناء القدرات.

| Item | Detail |
| --- | --- |
| Service page | Description, who it suits, what the client gets, work stages, related projects, service FAQs, "اطلب هذه الخدمة" button |
| Done when | The button opens a consultation request with the service selected. A signed-out visitor signs up, then returns to the same request. |

### 6.6 Projects (المشاريع السابقة) 🔴

| Item | Detail |
| --- | --- |
| List | Filter by expertise area and organization type |
| Project page | Goal, organization, role, duration, activities, results in numbers, images |
| Hide organization | Per-project "إخفاء اسم الجهة" option shows a general label instead, such as "منظمة دولية". The real name never reaches the browser. |

### 6.7 Training (التدريب) 🟡

Initial scope. Registration details are limited to what is listed here.

| Item | Detail |
| --- | --- |
| Types | حضورية (in person), أونلاين مباشرة (live online via Zoom/Meet), مسجلة (recorded), تدريب مخصص (custom for organizations) |
| Recorded courses | Shown with a "قريباً" badge. Nothing else this release. |
| Course page | Title, description, audience, type, date and place or link, seats left, register button |
| Registration | Signed-in clients only. Seats are checked inside `register_for_course`. |
| Full course | The button becomes "اكتملت المقاعد" |
| Custom training | Request form: number of trainees, topic, suggested date, place |
| Account | "دوراتي" lists the client's registrations |

### 6.8 Blog (المدونة) 🟡

| Item | Detail |
| --- | --- |
| Articles | Arabic, English, or both, categorized by expertise area. A single-language article appears only in that language. |
| List | Search, categories |
| Article page | Title, date, reading time, content, share buttons, related articles, consultation call to action |

### 6.9 Free resources (مكتبة الموارد المجانية) 🟡

| Item | Detail |
| --- | --- |
| Files | Guides, templates and working papers: PDF, Word, Excel |
| Filters | Expertise area, resource type |
| Access | Per resource: direct download, or download in exchange for an email. The email joins the newsletter only with explicit consent. |

### 6.10 Media and events (الظهور الإعلامي والفعاليات) 🟡

Interviews, conferences, speaking and workshops. Each item: title, outlet or organization, date, image, link or embedded video. Categories: إعلام / فعاليات / مؤتمرات.

### 6.11 Clients and testimonials (الجهات وآراء العملاء) 🔴

Testimonials come from **real thank-you letters**, rewritten in the site's voice, and published with the organization's consent.

| Item | Detail |
| --- | --- |
| Consent | "تمت الموافقة على النشر" (`consent_confirmed`) records that the organization agreed |
| Admin approval | `admin_approved`, set only with `testimonials.approve` |
| Source letter | Each testimonial links to its original letter: an internal file, never shown to visitors |
| Done when | No testimonial or logo appears unless consent is confirmed, the admin has approved it, and it is published |

### 6.12 Documents and certificates, public list (الوثائق والشهادات) 🔴

Titles and categories only, never the content. Each has a "طلب الاطلاع" button that needs sign-in. See §6.18.

### 6.13 FAQ (الأسئلة الشائعة) 🟡

Categories: consultations, training, documents, account. Managed from the dashboard. A question may also link to a service (§6.5).

### 6.14 Contact (تواصل معي) 🔴

| Item | Detail |
| --- | --- |
| Direct channels | Email, WhatsApp, LinkedIn, others set in the dashboard |
| Form | **No account needed.** Name, email, organization type, subject, message. |
| After sending | A confirmation message to the visitor |
| Rule | **Never show a response-time commitment.** |

### 6.15 Newsletter (النشرة البريدية) 🟡

| Item | Detail |
| --- | --- |
| Signup | Footer, home page, blog |
| Double opt-in | Confirmation email. Nothing is sent before it is confirmed. |
| Sending | Resend Broadcasts. Confirmed subscribers sync to a Resend audience. |
| Unsubscribe | A link in every message. Resend's webhook updates `newsletter_subscribers`. |
| Dashboard | Subscriber list and CSV export |

### 6.16 Accounts 🔴

| Field | Required |
| --- | --- |
| Full name (الاسم الكامل) | ✅ |
| Email (البريد الإلكتروني) | ✅ |
| Phone (رقم الهاتف) | ✅ |
| Password (كلمة المرور) | ✅ |
| Organization type: حكومية / منظمة / شركة / فرد | Optional |
| Organization name and job title | Optional |
| Preferred language | Optional |
| Accept the terms and privacy policy | ✅ |

| Item | Detail |
| --- | --- |
| Provider | Clerk. Email and password only. |
| Sign up | Clerk collects name, email, password and email verification. Then `/[locale]/onboarding` collects phone, the optional fields and consent, and creates the `profiles` row. The browser's time zone is saved there too. |
| Why phone is ours | Clerk's phone identifier needs paid SMS. Phone is a plain profile field and isn't verified. |
| Return path | The original destination is carried through sign-up and onboarding, so "اطلب استشارة" returns to the form |
| Gate | Consultations and document requests need a verified email and a complete profile |
| Password reset | Clerk. The link reaches the email and expires. |
| Protection | Clerk middleware on `/[locale]/account/*`, `/[locale]/dashboard/*`, and user and team API routes |
| Deleting an account | The account is **disabled, never deleted**: the client can't sign in (Clerk ban) and the data stays in the dashboard. An admin can reactivate it (Clerk unban). |
| Open consultations on disable | Closed automatically and kept |
| Errors | Clear messages in the selected language (email in use, weak password, and so on) |
| Clerk settings | Password minimum 12 characters. Name: Clerk's sign-up form doesn't ask for it, so onboarding asks for first and last name when Clerk has none and saves them to Clerk. New-device email verification on. Application name = `SITE_NAME`. The product owner decided these on 2026-11-07; the production instance must match at launch. |

Account pages:

| Page | Content |
| --- | --- |
| استشاراتي | Consultations, statuses, chats, meetings |
| وثائقي المتاحة | Documents opened to the client |
| دوراتي 🟡 | Course registrations |
| الملف الشخصي | Edit details, password, language, notification preferences |

### 6.17 Consultations (نظام الاستشارات) 🔴

Requires sign-in. No payment on the site.

**Flow**

1. The client opens "استشاراتي" and presses "بدء استشارة جديدة".
2. They fill in service type, title, description of the need, organization (optional) and attachments.
3. The request appears with status `new`.
4. Ahmed or the assigned assistant replies. The consultation becomes a written chat with messages and attachments on both sides.
5. When needed, a video meeting is added with an external link (Zoom, Google Meet or other), date and time.
6. The consultation is closed when done, and stays in both histories.

**Statuses** (in order)

| Key | Label |
| --- | --- |
| `new` | جديد |
| `in_review` | قيد المراجعة |
| `in_progress` | قيد المتابعة |
| `scheduled` | موعد مجدول |
| `closed` | مغلق |

| Item | Detail |
| --- | --- |
| Attachments | Several files per message: PDF, DOCX, XLSX, JPG, PNG. Max 10 MB each, 5 per message (`MAX_ATTACHMENT_BYTES`, `MAX_ATTACHMENTS_PER_MESSAGE`). This limit is a default until confirmed (§14). |
| Upload | 1. `upload-url` checks the type and size and returns a one-time signed URL. 2. The browser uploads straight to Storage. 3. `finalize` checks the real size and file bytes, then attaches the file. A refused file is deleted. |
| Before upload | The limit is shown. A file over the limit or of a wrong type is refused before upload, with the reason. |
| Failed upload | A clear message. Everything else typed stays in the form. |
| Chat | Messages in time order, with sender name and time. The status is always visible at the top of the page. |
| Refresh | Manual refresh. No realtime. |
| Meeting fields | Platform, link, date, time, duration |
| Time zones | Stored in UTC. Shown in the client's local time, with the time zone named. Emails use the zone saved on the recipient's profile. |
| Calendar file 🟡 | `.ics` attached to the meeting email |
| Reminder 🟡 | Email 24 hours before the meeting, sent by the hourly job |
| Changed link | Editing a meeting sends a new email with the updated details |
| Assignment | From the dashboard. The assistant gets a notification and sees only assigned consultations. |
| No client reply | The status stays. The admin may close it by hand. |
| Retention | Chats and attachments are **kept forever** until an admin deletes them. Deleting needs a double confirmation and is written to `audit_log`. |

### 6.18 Protected documents (نظام الوثائق المحمية) 🔴

Covers course and qualification certificates, thank-you and recommendation letters, experience certificates, and project and event photos. Files are PDF, JPG or PNG.

**Flow.** There is no rejection.

1. A signed-in client presses "طلب الاطلاع" on one or more documents and gives the purpose.
2. The request appears in the dashboard as `pending_review`, one row per document.
3. A team member may see the request and add a recommendation: موافقة (approve) or تحتاج توضيح (needs clarification). **The final decision is Ahmed's alone.**
4. Ahmed picks one:
   - **إتاحة (grant):** the document appears in "وثائقي المتاحة", with an optional expiry.
   - **التواصل أولاً (contact first):** the request opens a chat with the client (a `document_request` consultation, reusing §6.17) to understand the purpose. Ahmed decides later.
5. Ahmed can withdraw access at any time.

**Statuses**

| Key | Label |
| --- | --- |
| `pending_review` | بانتظار المراجعة |
| `in_contact` | قيد التواصل |
| `granted` | متاحة |
| `expired` | منتهية |
| `revoked` | مسحوبة |

| Item | Detail |
| --- | --- |
| No reject button | The only alternative to "إتاحة" is "التواصل أولاً" |
| Access mode | Per document: عرض فقط (view only) or عرض وتحميل (view and download) |
| Opening a document | 1. The route checks the signed-in client has a live grant. 2. It writes `document_access_log`. 3. It creates the watermarked copy in `document-views`. 4. It returns a signed URL valid for 60 seconds. The copy goes through a signed URL because Vercel caps responses at 4.5 MB. The hourly job deletes copies older than an hour. |
| Watermark | The client's name and the view date on every page or image, repeated diagonally. Render the text to a transparent PNG with `@napi-rs/canvas` and a bundled Arabic font, then stamp it with `pdf-lib` (PDF) or `sharp` (images). `pdf-lib` can't shape Arabic text, so never draw the text with it directly. |
| View only | The viewer shows no download button. This limits casual saving; it can't stop a determined user. The watermark is the real control. |
| Duplicate request | Merged into the open request for the same client and document, never a new one |
| Expired | The document leaves the client's account. They may request it again. |
| Logged | Every view and download: who, when, which document |

### 6.19 Team and permissions 🔴

| Item | Detail |
| --- | --- |
| Roles | المدير, مستشار مساعد, محرر محتوى, منسق تدريب. Editable (§5). |
| Accounts | Each member signs in with their own account |
| Invite | The admin invites by email (Clerk invitation), with a role |
| Disable | The admin can disable a member at once |
| Audit log | Who did what and when: reply, status change, publish, delete, document view |
| First admin | The person signs up normally, then one SQL statement in Supabase sets `profiles.role_id` to the admin role. No code path grants admin. Same step at launch, and `docs/launch.md` must include it. |
| 2FA 🟡 | Required for team accounts. Clerk's free plan doesn't include MFA, so it stays behind `REQUIRE_TEAM_2FA` until §14 is decided. |

### 6.20 Dashboard (لوحة التحكم) 🔴

| Section | Functions |
| --- | --- |
| Home | Summary: new requests, active consultations, document requests, messages, registrations, new subscribers |
| Consultations | View, filter, search, reply with attachments, change status, assign, add a meeting, close |
| Document requests | Recommendations, grant, contact first, expiry, withdraw, access log |
| Documents | Upload, categorize, edit |
| Content | Home, about, expertise, services, projects, articles, resources, media and events, FAQ |
| Clients and testimonials | Logos and testimonials, with letter link and consent |
| Training | Courses, registrations, custom training requests |
| Messages | Contact form messages |
| Clients | Accounts, their data and history, disable and reactivate |
| Newsletter | Subscribers, export |
| Team | Members, roles, permissions, audit log |
| Settings | Contact details, social links, email templates, notification settings |
| Statistics 🟡 | The KPIs in §6.23 |

| General rules |
| --- |
| All content has Arabic and English fields, with a preview before publishing |
| All content has `draft` (مسودة) and `published` (منشور) |
| The dashboard works on mobile |
| Each member sees only the sections their permissions allow |

### 6.21 Notifications 🔴

Email, with a tag in the subject for sorting, plus an unread counter in the dashboard.

| Event | Recipient | Arabic subject |
| --- | --- | --- |
| New consultation request | Admin | [طلب استشارة جديد] العنوان |
| Consultation received | Client | [تم استلام طلبك] العنوان |
| Consultation assigned | Assistant consultant | [استشارة مسندة إليك] العنوان |
| New reply | The other side | [رد جديد] العنوان |
| Meeting | Client | [موعد اجتماع] التاريخ والرابط |
| Meeting reminder 🟡 | Client and consultant | [تذكير] موعد غداً |
| Document request | Admin and team | [طلب وثيقة] اسم الوثيقة |
| Team recommendation | Admin | [توصية وثيقة] اسم الوثيقة |
| Document granted | Client | [وثيقة متاحة] اسم الوثيقة |
| Course registration | Coordinator and trainee | [تسجيل دورة] اسم الدورة |
| Custom training request | Admin and coordinator | [طلب تدريب مخصص] اسم الجهة |
| Contact message | Admin | [رسالة تواصل] الموضوع |
| New account | Admin | [حساب جديد] اسم العميل |

| Item | Detail |
| --- | --- |
| Language | Each email uses the recipient's language. Arabic emails are RTL. |
| Templates | Arabic and English, editable from the dashboard, with default copies in `apps/web/emails` |
| Preferences | Users can turn off non-essential notifications from their profile |
| Delivery | Sent through `email_outbox`. A failed send never fails the action; the hourly job retries it. |
| Domain | SPF and DKIM on the site's domain |

### 6.22 Edge cases

| Case | Required behavior |
| --- | --- |
| Signed-out visitor presses "اطلب استشارة" | Sent to sign up or sign in, then back to the form automatically |
| Attachment upload fails | Clear message; other typed data stays |
| File too large or wrong type | Refused before upload, with the reason |
| Client stops replying | Status stays; the admin may close it by hand |
| Document access expires | Leaves the account; the client may request it again |
| Disabling an account with open consultations | They close automatically and stay saved |
| Duplicate document request | Merged with the open one |
| Untranslated content | Hidden in the other language; no empty page |
| Course is full | Button shows "اكتملت المقاعد" |
| Spam on forms | Arcjet bot detection and rate limits |
| Meeting link changes | A new email with the updated link |

### 6.23 Analytics and KPIs 🟡

| Item | Detail |
| --- | --- |
| Setup | PostHog wizard (`npx @posthog/wizard`) on the Next.js app |
| Events | `signed_up`, `consultation_requested`, `document_requested`, `course_registered`, `newsletter_confirmed`, `resource_downloaded`, `contact_sent` |
| Funnel | Home → service → sign up → consultation requested |
| Session replay | Public pages only. Never in the account or dashboard. |
| Privacy | No message text, file name or client name in any event. Without cookie consent, PostHog runs in memory only, with no cookies. |
| Error tracking | Client + server errors |

Statistics page, read from our own database and PostHog:

| KPI | Measures |
| --- | --- |
| Monthly consultation requests | Main conversion |
| Share of visitors who create an account | Site appeal |
| Document requests | Client seriousness |
| Course registrations | Training performance |
| Newsletter subscribers and resource downloads | Audience growth |
| Average time to first reply | Team performance. Internal, never shown to clients. |

### 6.24 SEO 🟡

Titles and descriptions per page and per language, `hreflang` only for languages the page really has, `sitemap.xml`, `robots.txt`, Open Graph images. Drafts, previews, account and dashboard are `noindex`.

### 6.25 Legal pages 🔴

| Item | Detail |
| --- | --- |
| Privacy policy | Arabic and English: data collected, purpose, retention (kept until an admin deletes it), user rights |
| Terms of use | Nature of consultations, confidentiality of chats, no sharing of granted documents, financial agreements happen outside the site |
| Consent | Explicit acceptance at sign-up, stored with its time |
| Cookies | A banner, because PostHog is used. Declining keeps PostHog cookie-free. |

### 6.26 Backups 🔴

| Item | Detail |
| --- | --- |
| Job | A nightly GitHub Action runs `pg_dump` and copies every Storage bucket to a private Cloudflare R2 bucket. Dumps are encrypted before upload. |
| Retention | 30 daily copies |
| Restore test | Restored into a throwaway project before launch, then every three months |

Supabase's free plan has no downloadable backups, so this job doesn't depend on the Supabase plan.

---

## 7. Data model

All content tables also have `id`, `created_at`, `updated_at`. `*_ar` / `*_en` means one column per language. A row is available in a language when its required fields for that language are filled.

**People and permissions**

| Table | Columns | Notes |
| --- | --- | --- |
| `profiles` | `clerk_user_id` (PK), `full_name`, `email`, `phone`, `org_type`, `org_name`, `job_title`, `locale`, `timezone`, `notify_optional`, `terms_accepted_at`, `status` (`active`/`disabled`), `role_id` → roles (null for clients), `created_at` | One per Clerk user |
| `roles` | `id`, `key`, `name_ar`, `name_en`, `is_system` | Seeded with the four roles in §5 |
| `role_permissions` | `role_id`, `permission` | Composite PK. `permission` is a key from `PERMISSIONS`. |
| `audit_log` | `id`, `actor_id`, `action`, `entity`, `entity_id`, `metadata`, `created_at` | Append only |
| `notifications` | `id`, `user_id`, `type`, `entity`, `entity_id`, `read_at`, `created_at` | Dashboard counter |

**Public content** (each has `status` `draft`/`published` unless noted)

| Table | Columns | Notes |
| --- | --- | --- |
| `site_settings` | `key` (PK), `value` | Contact details, social links, CV visibility. No status. |
| `home_sections` | `key` (PK), `position`, `is_visible`, `content_ar`, `content_en` | The 12 sections in §6.2 |
| `home_stats` | `label_ar`, `label_en`, `value`, `position` | Quick stats |
| `pages` | `key`, `title_*`, `body_*` | About, privacy, terms |
| `timeline_items` | `kind` (`career`/`qualification`), `title_*`, `description_*`, `period`, `position` | |
| `expertise_areas` | `slug`, `title_*`, `summary_*`, `body_*`, `position` | |
| `services` | `slug`, `expertise_id`, `title_*`, `summary_*`, `audience_*`, `deliverables_*`, `stages_*`, `is_featured`, `position` | |
| `projects` | `slug`, `expertise_id`, `org_type`, `title_*`, `org_name_*`, `org_label_*`, `hide_org_name`, `goal_*`, `role_*`, `duration_*`, `activities_*`, `results_*`, `key_result_*`, `is_featured` | |
| `project_images` | `project_id`, `path`, `alt_*`, `position` | |
| `project_services` | `project_id`, `service_id` | Composite PK |
| `faqs` | `category`, `service_id` (nullable), `question_*`, `answer_*`, `position` | |
| `partners` | `name_*`, `logo_path`, `consent_confirmed`, `admin_approved`, `approved_by`, `position` | Logos |
| `testimonials` | `quote_*`, `author_*`, `partner_id`, `letter_path`, `consent_confirmed`, `admin_approved`, `approved_by`, `position` | `letter_path` is never returned to the public |
| `posts` | `slug_*`, `expertise_id`, `title_*`, `excerpt_*`, `body_*`, `cover_path`, `reading_minutes_*`, `published_at` | |
| `resources` | `expertise_id`, `kind`, `title_*`, `description_*`, `storage_key`, `access` (`direct`/`email`) | |
| `media_items` | `category`, `title_*`, `outlet_*`, `date`, `image_path`, `url`, `video_url` | |
| `courses` | `slug`, `type` (`in_person`/`online_live`/`recorded`/`custom`), `title_*`, `description_*`, `audience_*`, `starts_at`, `place_*`, `online_url`, `seats` | |

**Client work**

| Table | Columns | Notes |
| --- | --- | --- |
| `consultations` | `id`, `kind` (`consultation`/`document_request`), `client_id`, `service_id`, `title`, `description`, `organization`, `status`, `assigned_to`, `first_reply_at`, `closed_at`, `created_at` | |
| `consultation_messages` | `id`, `consultation_id`, `sender_id`, `body`, `created_at` | |
| `consultation_attachments` | `id`, `consultation_id`, `message_id`, `storage_key`, `file_name`, `mime`, `size_bytes`, `status` (`uploading`/`ready`), `uploaded_by`, `created_at` | |
| `meetings` | `id`, `consultation_id`, `platform`, `url`, `starts_at`, `duration_minutes`, `reminder_sent_at`, `created_at` | |
| `documents` | `id`, `category`, `title_*`, `storage_key`, `mime`, `access_mode` (`view`/`view_download`), `status` | `category`: `course_certificate`, `qualification_certificate`, `thank_you_letter`, `recommendation_letter`, `experience_certificate`, `project_photo`, `event_photo` |
| `document_requests` | `id`, `client_id`, `document_id`, `purpose`, `status`, `consultation_id`, `decided_by`, `granted_at`, `expires_at`, `revoked_at`, `created_at` | Partial unique index on (`client_id`, `document_id`) while open or granted |
| `document_recommendations` | `id`, `request_id`, `member_id`, `recommendation` (`approve`/`needs_clarification`), `note`, `created_at` | |
| `document_access_log` | `id`, `request_id`, `document_id`, `client_id`, `action` (`view`/`download`), `created_at` | Append only |
| `course_registrations` | `id`, `course_id`, `client_id`, `created_at` | Unique (`course_id`, `client_id`) |
| `custom_training_requests` | `id`, `client_id` (nullable), `org_name`, `trainee_count`, `topic`, `suggested_date`, `place`, `contact_email`, `created_at` | |
| `contact_messages` | `id`, `name`, `email`, `org_type`, `subject`, `message`, `read_at`, `created_at` | |
| `newsletter_subscribers` | `id`, `email`, `locale`, `status` (`pending`/`confirmed`/`unsubscribed`), `confirm_token_hash`, `source`, `consented_at`, `created_at` | `email` unique |
| `email_templates` | `event` (PK), `subject_ar`, `subject_en`, `body_ar`, `body_en` | |
| `email_outbox` | `id`, `event`, `to_email`, `locale`, `payload`, `status` (`pending`/`sent`/`failed`), `attempts`, `last_error`, `created_at`, `sent_at` | |

**Storage buckets**

| Bucket | Access | Holds |
| --- | --- | --- |
| `public-media` | Public read | Images and the CV of published content, approved logos |
| `resources` | Private | Resource files, served by signed URL through the download route |
| `attachments` | Private | Consultation files |
| `documents` | Private | Original protected documents |
| `document-views` | Private | Short-lived watermarked copies |
| `internal` | Private | Thank-you letters behind testimonials |

**Access control:** Postgres RLS. The Data API is public, so RLS and grants are the boundary.

| Role | May |
| --- | --- |
| `anon` | Nothing: no table, no function. Visitors never get data from the browser. |
| `authenticated` (the user's Clerk token) | SELECT only: own profile; consultations, messages, attachments and meetings that are theirs or assigned to them, or all with `consultations.view_all`; own document requests, recommendations if they hold `document_requests.recommend`; other tables per the permission that covers them (§5). Nothing else. |
| `service_role` (the server's secret key) | Everything. Used only on the server: public content reads, public forms, and every write, always after the route checks identity and permission. |

**Public content reads** go through `apps/web/lib/content` only. It runs on the server with the service client, selects explicit columns, returns published rows only, replaces the organization name with `org_label_*` when `hide_org_name` is on, and applies the consent rule in §6.11. Pages are cached and revalidated by tag when content is published.

RLS helpers (SECURITY DEFINER): `has_permission(key)`, `visible_consultation_ids()`.

Rules that must hold under concurrency run in Postgres functions only `service_role` may execute, under a row lock or in one statement: `register_for_course` (seats), `request_document` (merges duplicates), `decide_document_request`, `disable_client` (closes open consultations).

**Schema changes:** a migration in `supabase/migrations` in the same PR, with its RLS policies and grants, plus regenerated `packages/db/types.ts`. Changing an existing table needs approval first (see `CLAUDE.md`).

---

## 8. API routes

### Public (no account, rate limited by Arcjet)

| Route | Input | Output |
| --- | --- | --- |
| `POST /api/contact` | `name`, `email`, `orgType`, `subject`, `message` | `ok` |
| `POST /api/newsletter/subscribe` | `email`, `locale`, `source` | `ok` (same answer whether or not the email exists) |
| `GET /api/newsletter/confirm` | `token` | Redirect to a confirmation page |
| `POST /api/resources/:id/download` | `email?`, `consent?` | Signed URL |
| `POST /api/training/custom-requests` | Form fields | `ok` |

### Client (Clerk session required)

| Route | Purpose |
| --- | --- |
| `POST /api/profile`, `PATCH /api/profile` | Onboarding, edit profile |
| `POST /api/account/disable` | Disable own account |
| `GET/POST /api/consultations`, `GET /api/consultations/:id` | List, create, read. Team members use the same read routes; RLS scopes them. |
| `POST /api/consultations/:id/messages` | Send a message |
| `POST /api/consultations/:id/attachments/upload-url` | Check a file → signed upload URL |
| `POST /api/consultations/:id/attachments/finalize` | Check the uploaded file → attach |
| `GET /api/attachments/:id` | Signed download URL, after an access check |
| `POST /api/document-requests` | Request one or more documents |
| `GET /api/documents/:id/open` | Grant check → log → watermark → signed URL. Optional query `action`: `view` (default) or `download`. `download` is refused when `access_mode` is `view`. |
| `POST /api/courses/:id/register` | Register |
| `POST /api/notifications/read` | Mark the caller's own notifications read. Body `{ ids? }`: no `ids` means all of them. Returns the unread count. |

### Team (Clerk session + permission)

| Route | Permission |
| --- | --- |
| `PATCH /api/admin/consultations/:id` | Status: reply permission on an assigned one. Assign: `consultations.assign`. |
| `POST/PATCH /api/admin/consultations/:id/meetings` | `consultations.reply` |
| `GET/POST/PATCH /api/admin/content/:type` | `content.manage` |
| `PATCH /api/admin/testimonials/:id/approve` | `testimonials.approve` |
| `PATCH /api/admin/partners/:id/approve` | `testimonials.approve`. Body `{ approved: boolean }`. The server sets `approved_by`. |
| `POST /api/admin/document-requests/:id/recommend` | `document_requests.recommend` |
| `POST /api/admin/document-requests/:id/decide` | `document_requests.decide` |
| `GET/POST/PATCH /api/admin/documents` | `documents.manage` |
| `POST /api/admin/uploads/upload-url` | `documents.manage` for target `document`, `content.manage` for the others. Body: `target`, `fileName`, `mime`, `sizeBytes`. Returns the one-time URL and a key. Targets map to buckets: `document` → `documents`, `resource` → `resources`, `media` → `public-media`, `letter` → `internal`. |
| `POST /api/admin/uploads/finalize` | Same as `upload-url`. Body: `target`, `key`. Checks the real size and file bytes (§9). Later content and document bodies carry the key. |
| `GET/POST/PATCH /api/admin/courses` | `training.manage` |
| `GET /api/admin/clients` | `clients.view_all`, or the scoped rule in §5 |
| `PATCH /api/admin/clients` | `clients.view_all` only. Scoped access lets a team member see a client, never disable one. |
| `GET/POST/PATCH /api/admin/team`, `/api/admin/roles` | `team.manage` |
| `PATCH /api/admin/settings`, `/api/admin/email-templates` | `team.manage` |
| `PATCH /api/admin/messages` | `messages.view`. Body `{ id, read: boolean }`: marks a contact message read or unread. |
| `GET /api/admin/newsletter/export` | `content.manage` |
| `DELETE /api/admin/:type/:id` | `data.delete`. Body `{ confirm: <row id> }`, checked against `:id`. The dashboard asks twice, and the second step needs a typed word. There is no token route. `:type` is a shared list: the content types except `home_sections` and `pages`, plus `documents`, `courses`, `consultations`. Never a log table, `profiles`, `email_outbox` or `roles`. Writes `audit_log`. |

### System

| Route | Purpose |
| --- | --- |
| `POST /api/clerk/webhook` | Signature verified. Keeps `profiles.email` and `full_name` in sync. |
| `POST /api/resend/webhook` | Signature verified. Records unsubscribes. |
| `POST /api/cron/hourly` | `CRON_SECRET` required. Sends reminders, expires document grants, deletes old watermarked copies and unfinished uploads, retries `email_outbox`. Safe to run twice. |
| `GET /api/posthog-config` | PostHog's public project key and host, read at request time |

Request and response types for every route live in `packages/shared`.

---

## 9. Security rules

Every PR must follow these.

| Risk | Rule |
| --- | --- |
| Permission bypass | Permissions are read on the server in every gated action. Never from the client. |
| Client data leak | User reads use the user client, so RLS scopes them. Never the service client with a manual user filter. Service-client writes happen only after the route checks identity and permission. |
| Public content leak | Public reads go only through `lib/content`, with explicit columns. `letter_path`, `org_name_*` of a hidden project, and unapproved testimonials and logos must never reach the browser. |
| Database API | The Data API is public. Every table has RLS on, with policies and grants in its migration; `anon` gets nothing; TRUNCATE is revoked from API roles. Functions: SECURITY INVOKER (DEFINER only for the RLS helpers), `search_path = ''`, EXECUTE revoked from `PUBLIC`/`anon`/`authenticated` unless a role needs it. Never turn on PostgREST aggregates project-wide. |
| Protected documents | Never a public URL. Originals are never sent to clients. Every open goes through the grant check, the log and the watermark. Signed URLs last 60 seconds. |
| Document decisions | Only `document_requests.decide` may grant or withdraw. Never add a reject action. |
| File upload | Check type and size on the server: declared size and extension at `upload-url`, real size and file bytes at `finalize`. Allow-listed types only; macro formats such as `.docm` are refused. Private buckets with their own size and type limits; one-time signed upload URLs. Client attachments download as files, never render inline. Malware scanning: see §14. |
| XSS | Chat messages and form input render as text, never HTML. Rich text is stored as Tiptap JSON and rendered through an allow-listed renderer; never pass stored HTML to `dangerouslySetInnerHTML`. |
| Spam and brute force | Arcjet on every public route. Sign-in protection comes from Clerk. Same response whether or not an email exists on newsletter routes. |
| CORS | Our routes are same-origin. No route allows other origins. |
| Clickjacking | Every page sends `frame-ancestors 'self'` |
| Webhooks and cron | Signature or `CRON_SECRET` verified before any work |
| Audit | Replies, status changes, publishing, deleting and document views all write `audit_log` |
| Deletion | Only with `data.delete`, a double confirmation, and an audit entry |
| Analytics privacy | No personal data or message text in PostHog events. No session replay in the account or dashboard. |
| Secrets | No secret keys in `NEXT_PUBLIC_*`. `SUPABASE_SECRET_KEY` is read only by `lib/supabase/service.ts` (`import "server-only"`). Test keys only until Phase 7. |

---

## 10. Repo layout

```
apps/
  web/            # Next.js: public site, account, dashboard, /api
    messages/     # ar.json, en.json
    emails/       # React Email templates
packages/
  shared/         # contract: types, API shapes, PERMISSIONS, limits, SITE_NAME
  db/             # generated Supabase types (types.ts) + pglite test helper
supabase/
  migrations/     # SQL migrations (Supabase CLI)
.github/
  workflows/      # CI, deploys (Vercel CLI), nightly backup
docs/
  project.md      # this file
  plan.md         # phases (human-written)
  launch.md       # production runbook, written in Phase 7
.nvmrc            # Node version for CI and developers
```

---

## 11. Environment variables

| Variable | Used by | Public? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (public by design: RLS is the boundary) | Client + server | Yes |
| `SUPABASE_SECRET_KEY` (acts as `service_role`, skips RLS) | Server only | No |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Client | Yes |
| `CLERK_SECRET_KEY` | Server | No |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Server | No |
| `REQUIRE_TEAM_2FA` (`true`/`false`) | Server | No |
| `RESEND_API_KEY` | Server | No |
| `RESEND_AUDIENCE_ID` | Server | No |
| `RESEND_WEBHOOK_SECRET` | Server | No |
| `EMAIL_FROM` | Server | No |
| `ARCJET_KEY` | Server | No |
| `CRON_SECRET` | Server | No |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Client + server | Yes |
| `NEXT_PUBLIC_APP_URL` | Client + server | Yes |

GitHub Actions secrets, not app variables: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `BACKUP_DATABASE_URL`, `BACKUP_ENCRYPTION_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `BACKUP_STORAGE_ACCESS_KEY_ID`, `BACKUP_STORAGE_SECRET_ACCESS_KEY`.

`.env.example` lists every app variable with no values. `.env` is never committed.

Each Vercel environment gets its own Supabase and Clerk values: Production → the prod project and the Clerk production instance, Preview and Development → the dev project and the Clerk development instance.

Until Phase 7, Vercel's Production environment holds the dev Supabase values and Clerk test keys, so staged builds keep working. Builds stay staged, so nothing goes live. `docs/launch.md` must replace them before promoting.

---

## 12. Out of scope

| Feature | Reason |
| --- | --- |
| Online payment | Financial agreements happen outside the site |
| Trainee certificates | A later document will define them |
| Recorded-course platform | Same. This release shows the "قريباً" badge only. |
| Built-in video rooms | Meetings run on Zoom or Google Meet |
| Realtime chat | Manual refresh is enough |
| Rejecting a document request | "التواصل أولاً" is the only alternative, by design |
| Response-time promises | Never shown to visitors |
| Sign-in with Google | Not requested; organizations use email |
| SMS or phone verification | Needs paid SMS |
| AI features | Not requested |

---

## 13. Design

Every screen follows this. Agents don't pick their own style.

**Overall:** one identity (logo, colors, fonts) with a character for each section. Formal, premium and trustworthy, fit for ministries and international organizations.

| Role | Light | Dark |
| --- | --- | --- |
| Primary, navy (كحلي) | `#0B1F3A` | `#0B1F3A` for deep backgrounds |
| Accent, gold (ذهبي) | `#C9A24D` | `#D4B062` |
| Background | `#F7F3EA` (ivory, عاجي) | `#08162A` |
| Surfaces and cards | `#FFFFFF` | `#11274A` |
| Main text | `#0B1F3A` | `#F7F3EA` |
| Secondary text | `#4A5568` | `#A9B4C6` |

| Area | Look |
| --- | --- |
| Home, about, governance, services | Deep navy and gold, formal and premium |
| Humanitarian work, projects | Light ivory backgrounds, large field photos, warmer feel |
| Training, blog, resources | Wide white space, easy reading |
| Account and dashboard | Practical, focused on function |
| Sign-in / sign-up | Clerk's components, themed with these tokens, `arSA` in Arabic |

| Rule | Detail |
| --- | --- |
| Gold | For accents only: buttons, dividers, icons. Never long text. Never gold text on ivory or white; it fails contrast. Text on gold is navy. |
| Contrast | WCAG AA at least |
| Fonts | Arabic: Amiri for headings, IBM Plex Sans Arabic for text. English: Playfair Display for headings, Inter for text. Loaded with `next/font`. |
| Images | Real photos from the work (field, workshops, meetings) plus illustrations and icons in the same identity |
| Motion | Light and calm: gradual reveal on scroll, animated home stats. Respect "reduce motion". |
| RTL | Use logical Tailwind utilities (`ms-`, `pe-`, `start-`), never `ml-` or `left-`. Mirror directional icons. |
| Tokens | One set of design tokens (colors, radius, shadows) shared by every page, in both themes |
| States | Empty, loading and error states on every screen |
| Responsive | Mobile first. Works down to 375 px wide. |
| Performance | Under 3 seconds on mobile on a weak network. Compressed, lazy-loaded images. Public pages stay cached: don't read the session in public layouts. |
| Accessibility | Good contrast, alt text on images, keyboard navigation |

**Reference sites**, for ideas and structure only. Never copy them.

| Site | Useful for |
| --- | --- |
| [drrmohh.com](https://drrmohh.com/) | Organizing course types, organization requests and consultations |
| [almostshar.com](https://almostshar.com/) | The consultation path after sign-up |
| [worldarabi.com](https://www.worldarabi.com/) | Certificate checks and request forms |
| [marshallgoldsmith.com](https://marshallgoldsmith.com/) | Free resource library |
| [simonsinek.com](https://simonsinek.com/) | Personal site as a brand, courses |
| [alanweiss.com](https://alanweiss.com/) | Showing organizations, the bio and newsletters |

---

## 14. Open decisions

Don't guess these. If a task depends on one, stop and ask.

| # | Decision | Owner | Until then |
| --- | --- | --- | --- |
| 1 | Final brand name and logo | Ahmed | `SITE_NAME` placeholder, text logo |
| 2 | Domain | Ahmed | Any domain the product owner controls, for email in Phase 3 |
| 3 | Exact fonts and color values | Developer | §13 values |
| 4 | Attachment size limit | Developer with Ahmed | 10 MB, 5 per message |
| 5 | Training details and trainee certificates | Later document | §6.7 only |
| 6 | Real content: bio, photos, services, projects, documents, FAQ | Ahmed | Made-up placeholder content in dev |
| 7 | Organizations' consent for logos and testimonials | Ahmed | Nothing published |
| 8 | Privacy policy and terms text, reviewed by Ahmed | Ahmed | Draft text in dev |
| 9 | Timeline and budget | Ahmed and product owner | — |
| 10 | Malware scanning of uploads. The PRD requires it (🔴), and no free option fits: Vercel can't run ClamAV, and public scanners share files with third parties, which breaks client confidentiality. | Product owner | §9 file rules only. Must be settled before launch. |
| 11 | Production plans (table below) | Product owner | Free tiers during the build |
| 12 | Clerk's auth emails in Arabic. They arrive in English only (Phase 1 check below). The likely fix is one bilingual template, if the plan allows editing it. | Product owner | English Clerk emails |

**Paid plans production may need.** Prices were read in November 2026; confirm them before buying.

| Service | Why | Cost |
| --- | --- | --- |
| Vercel Pro | Hobby is for non-commercial, personal use. This is a business site. | About $20/month per seat |
| Clerk Pro | Required for team 2FA (§6.19). The free plan doesn't appear to include MFA. | About $25/month |
| Supabase Pro | Free projects pause after a quiet week, with 500 MB of database and 1 GB of files. Pro removes the pause and raises the limits. | About $25/month |
| Resend Pro | Only if volume passes the free 100 emails a day or 3,000 a month | About $20/month |

**Verified in Phase 1 (PR #8):**

| Check | Result |
| --- | --- |
| Clerk's components in RTL | The layout mirrors correctly at 375 px on sign-up, sign-in, password, email code, new-device code, forgot password and the error states. Fixed in the app: `arSA` gaps in placeholders and errors (filled from `messages/`), code boxes reversed (now LTR), long emails losing their start (direction follows the content), gold links on white (now the text color). Not fixable: the "Secured by" badge stays in English, and forgot-password's email-code button cuts off the address (Clerk's text, minor). |
| Clerk's emails in Arabic | English only. The verification and password reset emails arrived entirely in English, the same from `/ar` and `/en`; the new-device code email wasn't checked. Clerk sends one template per instance, with no language logic. Whether the free plan allows editing it is unconfirmed. See decision 12. |
