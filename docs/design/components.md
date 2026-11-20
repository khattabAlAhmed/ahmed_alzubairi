# Design system: what it must contain

The design system comes before any page. Claude Design builds every item below, the team builds it in code, and only then do pages get composed from it. A page that needs something not on this list waits until the item is added here and to the system.

Paths under "Code today" are relative to `apps/web/components` unless they start with `apps/web/`. Each item is designed in **Arabic first, then English**, in **light and dark**, at **375 px and 1440 px**, with every state listed. "Code today" names the files the Foundation task restyles; it's for the team, not for Claude Design.

`SOUL.md` sets the feeling for all of it. Its "What breaks the soul" list applies to every component.

## 1. Foundations

| Item | Must define | Code today |
| --- | --- | --- |
| Color | One neutral scale, one accent used rarely, text and surface roles, status colors (success, warning, danger, info). Both themes. Every text pair passes WCAG AA. | `apps/web/app/globals.css` |
| Type: Arabic | Families, weights (few), a scale from caption to display, line heights. Arabic sits larger and looser than English. | `apps/web/app/[locale]/layout.tsx` (`next/font`) |
| Type: English | The same roles as Arabic, with their own sizes. | same |
| Numbers | Arabic-Indic or Western digits per locale, tabular figures for stats and tables, how dates and times read. | `public/home/format.ts`, `workspace/format.ts` |
| Spacing and layout | A spacing scale, the page grid at 375 / 768 / 1280 / 1440, content widths (reading width for long text), section rhythm. | `public/parts.tsx` (`CONTAINER`) |
| Shape | Radius scale, borders. Hierarchy comes from type and space, so borders and shadows stay rare. | `ui/card.tsx`, `public/parts.tsx` (`CARD`) |
| Elevation | Only what dialogs, menus and sticky bars need. | — |
| Motion | Durations, easing, the one orchestrated moment a page may have, what "reduce motion" turns into. | `public/home/stat-number.tsx` |
| Iconography | One line style, sizes, which icons mirror in RTL. No icons in circles. | `ui/icons.tsx`, `icons.tsx`, `public/listing/icons.tsx`, `workspace/icons.tsx` |
| Photography | Crops (4:5, 3:2, 1:1, 16:9), treatment, captions, what a missing photo looks like. | `public/listing/parts.tsx` (`CardCover`) |
| Focus | One visible focus ring that works on every surface, both themes. | `public/parts.tsx` (`RING_ON_NAVY`) |

## 2. Primitives

| Component | Variants and states | Code today |
| --- | --- | --- |
| Button | Primary, secondary, quiet (text). Sizes. Default, hover, focus, pressed, disabled, loading. With a directional icon that mirrors. | `ui/button.tsx` |
| Link | Inline in text, navigation, "more" link with a directional arrow. Visited where it helps. | `nav-link.tsx`, `public/parts.tsx` (`MoreLink`) |
| Badge | Neutral, status, "قريباً", "مسودة". Never the only signal: always text. | `ui/badge.tsx` |
| Status pill | Every consultation status (§6.17) and document status (§6.18), with their Arabic labels. | `workspace/status-pill.tsx` |
| Text field, textarea, select | Label, hint, required mark, error, disabled. Phone and email fields read LTR inside Arabic forms. | `ui/form-field.tsx` |
| Checkbox, radio, switch | Including the consent checkbox with a link in its label. | `ui/form-field.tsx`, `account/notify-switch.tsx` |
| File input | Allowed types and limit shown before upload, a refused file with its reason, progress, a failed upload. | `consultations/use-files.ts`, `workspace/file-chip.tsx` |
| Search field | Empty, typing, with results count, no results. | `public/listing/search-field.tsx` |
| Filter chips | Selected, unselected, focus, wrapping on mobile. | `public/listing/filter-chips.tsx` |
| Tabs | Including the Arabic / English language tabs of the dashboard. | `ui/language-tabs.tsx` |
| Pagination | First, middle, last page; mirrored in RTL. | `public/listing/pagination.tsx` |
| Divider | The one way sections and items are separated when space alone isn't enough. | — |
| Skeleton | Text lines, an image, a list item. | `ui/skeleton.tsx` |

## 3. Site shell

| Component | Variants and states | Code today |
| --- | --- | --- |
| Header | Desktop and mobile. Logo (text logo until §14 decision 1), navigation, the always-visible "اطلب استشارة", language switch, theme switch. Signed out and signed in. Sticky behaviour. | `site-header.tsx`, `compact-header.tsx`, `site-logo.tsx`, `nav-items.ts` |
| Mobile menu | Open, closed, focus trapped, current page marked. | `mobile-menu.tsx` |
| Language switch | Including the case where the page has no translation (goes to the section's list, §6.1). | `language-switch.tsx` |
| Theme switch | Device default, light, dark. | `theme-switch.tsx` |
| Quick contact | WhatsApp and email, always reachable (§6.1). | `public/home/contact.tsx`, `public/contact/channels.tsx` |
| Footer | Section links, contact channels, newsletter signup, privacy and terms. | `site-footer.tsx` |
| Skip link | Visible on focus. | `skip-link.tsx` |
| Consent banner | Analytics consent: accept, decline. Calm, not a wall. | `consent-banner.tsx`, `analytics/consent-choice.tsx` |
| Page header | Page title plus **one sentence of his** (`SOUL.md` principle 1), optional photo. Replaces the centered hero pattern. | `public/parts.tsx` (`PageHero`), `ui/card.tsx` (`PageHeader`) |
| Section shell | Title, optional intro in his voice, content, optional "see all". Works for every home section, alone or reordered (§6.2). | `public/home/section.tsx`, `public/parts.tsx` (`PageSection`), `ui/card.tsx` (`SectionHeading`) |
| Consultation call to action | The closing invitation on public pages: an invitation to talk, not a sales banner. | `public/parts.tsx` (`ConsultationCta`), `consultation-button.tsx` |

## 4. His voice

These carry the soul. Design them with care; they are what visitors remember.

| Component | What it is | Code today |
| --- | --- | --- |
| The letter | A short letter from Ahmed on the home page, with his scanned signature. Only if Ahmed keeps it (`plan.md` Phase 8 step 3). | — (new) |
| His sentence | One sentence of his, at the top of a main page or between sections. | — (new) |
| Why I took it on | One line of his on a project page. | — (new) |
| Signature | How the scanned signature sits in both themes (dark theme needs a light version). | — (new) |

## 5. Content

| Component | Variants and states | Code today |
| --- | --- | --- |
| Hero | Photo (4:5), name, title, one-line value statement, "تعرّف على خبرتي" and "اطلب استشارة". Not centered title-plus-two-buttons. | `public/home/hero.tsx` |
| Quiet stat | A number as evidence in context, with its label. Static and (if Ahmed chooses) a calm count. Tabular figures. | `public/home/stats.tsx`, `public/home/stat-number.tsx`, `public/home/stat-value.ts` |
| Expertise area | Name, short description, link. The three areas of §6.4. | `public/home/expertise.tsx`, `public/pages/expertise.tsx` |
| Audience | Government, humanitarian, private (§6.2 "لمن أعمل"). | `public/home/audiences.tsx` |
| Service | List item and featured item. Service page parts: who it suits, what you get, stages, FAQs, "اطلب هذه الخدمة". | `public/home/services.tsx`, `public/pages/services.tsx`, `public/pages/request-service-button.tsx` |
| Project story | List item (situation, what he did, what changed, one key result) and featured item. Hidden organization shows a general label (§6.6). | `public/home/projects.tsx`, `public/parts.tsx` (`ProjectCards`), `public/projects/projects-list.tsx` |
| Project page parts | Goal, organization, role, duration, activities, results in numbers, image gallery. | `public/projects/project-detail.tsx` |
| Result in numbers | One result, its number and what it means. | same |
| Testimonial | From a real thank-you letter: quote, person's role, organization. | `public/clients/clients-page.tsx` |
| Organization logos | Approved logos, set calmly, never a wall high on the page. Grayscale or tone treatment, both themes. | `public/home/partners.tsx` |
| Career timeline | About page (§6.3). | `public/pages/about.tsx` |
| Qualifications and values | About page lists. CV download link. | same |
| Article item | Title, date, reading time, area. With and without image. | `public/listing/article-card.tsx` |
| Article body | Long-form typography in both languages: headings, lists, quotes, images, links, tables. | `public/rich-text/rich-text.tsx`, `public/blog/article-page.tsx` |
| Share and copy link | Article page. | `public/listing/share-buttons.tsx`, `public/listing/copy-link-button.tsx` |
| Resource item | Type (PDF, Word, Excel), area, direct download or download for an email (with the consent checkbox). | `public/listing/resource-card.tsx`, `public/resources/resource-download.tsx` |
| Media item | Interview, conference, event: outlet, date, image, link or embedded video. | `public/listing/media-card.tsx`, `public/home/media.tsx` |
| Course item | Type (in person, live online, recorded with "قريباً", custom), date and place, seats left, "اكتملت المقاعد". | `public/listing/course-card.tsx`, `training/course-list.tsx` |
| Course registration panel | Signed out, signed in, registered, full. | `training/registration-panel.tsx`, `training/register-button.tsx` |
| Public document item | Title and category only, "طلب الاطلاع" (§6.12). Selected for a multi-document request. | `documents/request-card.tsx` |
| FAQ | Question and answer, grouped by category, open and closed. | `apps/web/app/[locale]/(public)/faq/faq-list.tsx` |
| Image with caption, gallery, video embed | Including a missing image and a video that hasn't loaded. | `public/listing/parts.tsx` |

## 6. Forms and flows

| Component | States | Code today |
| --- | --- | --- |
| Contact form | Empty, errors, sending, sent (no response-time promise, §6.14). | `public/contact/contact-form.tsx` |
| Newsletter signup | Inline (home, blog) and footer. Sent: "check your email" (double opt-in). | `newsletter/newsletter-form.tsx`, `newsletter/newsletter-signup.tsx` |
| Consultation request | Service selected or not, attachments, errors, sent. | `consultations/new-consultation-form.tsx` |
| Document request dialog | One or several documents, purpose, sent. | `documents/request-dialog.tsx` |
| Custom training request | §6.7 fields. | `training/custom-request-form.tsx` |
| Sign in and sign up | Clerk's components themed with the tokens, `arSA` in Arabic. | `auth-forms.tsx`, `clerk/*` |
| Onboarding | Phone, optional fields, consent. | `onboarding-form.tsx` |

## 7. Feedback

| Component | States | Code today |
| --- | --- | --- |
| Empty state | For every list: no projects, no articles, no results for a filter, nothing in an account section. In his voice where it fits. | `empty-state.tsx`, `public/parts.tsx` (`EmptyNote`) |
| Loading | Skeletons per list type. | `ui/skeleton.tsx` |
| Error | Inline (a field), section (a list failed to load), page. With a way to retry. | — |
| Notice | Success, info, warning, error. | `account/notice.tsx` |
| Dialog | Default, with a form, destructive confirm. Double confirmation for deletes (§6.17). | `documents/request-dialog.tsx`, `workspace/confirm-twice.tsx` |
| 404 | In his voice, with a way back. | `not-found-content.tsx` |

## 8. Account and dashboard

These pages get the new tokens and these components, not a page redesign (`plan.md` Phase 8). They still belong in the system so they stay consistent and readable.

| Component | States | Code today |
| --- | --- | --- |
| App shell | Side navigation, top bar, mobile. Sections hidden by permission. | `app-shell.tsx` |
| Chat message | Mine, theirs, with attachments, sender and local time. | `workspace/chat-message.tsx` |
| Composer | Empty, typing, attaching, sending, failed. | `workspace/composer.tsx` |
| File chip | Uploading, done, refused, failed. | `workspace/file-chip.tsx` |
| Meeting card | Platform, link, date, time with the time zone named, duration. | `workspace/meeting-card.tsx` |
| Document card and viewer | View only, view and download, expired. Viewer chrome around the watermarked file. | `workspace/document-card.tsx`, `documents/viewer.tsx` |
| Table | Sorting, filters, empty, loading, row actions, mobile layout. | dashboard pages |
| Stat tile and monthly chart | Dashboard home and statistics. | `ui/stat-tile.tsx`, `ui/monthly-chart.tsx` |
| Content editor | Arabic and English fields, draft and published, preview. | `dashboard/content/*` |
