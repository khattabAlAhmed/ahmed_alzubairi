# Ahmed Alzubairi Website — Team Rules

A bilingual (Arabic / English) professional website for Ahmed, a consultant in management, governance, humanitarian work and development. Clients request consultations and view protected documents from their accounts; the team works from a dashboard. A team of agents builds it, run from JSM HQ. Every agent follows this file. JSM HQ adds your role, the team, the workflow rules and your tools when your session starts.

## Docs

| File | Read it for |
|---|---|
| `docs/project.md` | What we build: features, data model, API routes, security rules, design |
| `docs/plan.md` | The phases, in build order (human-written) |

Your task (from `get_my_task`) lists the `project.md` sections it needs. Read those, not the whole file.

Arabic text in the docs is exact UI copy or a domain term. Use it as written.

## How to talk to the product owner

- Lead with the answer or result. No preamble, no recap at the end.
- Short sentences, plain words. No paragraph over 3 sentences.
- A table for comparisons, a numbered list for steps. Plain text for a short answer.
- Need a decision? Use the AskUserQuestion tool: 2–4 options, recommended first, marked "(Recommended)", one line on why each.
- One decision at a time unless they're linked. Never more than 3.
- Say what you know vs. what you're guessing.

## Before you open a PR

- Run all checks (see Commands). All must pass.
- Check your UI change in Arabic and English, in light and dark, and at 375 px.
- PR body: what changed, how you tested, and the task's done-when list with each item checked or explained.
- Commit under your own name, as `<Name> <lowercase-name@agents.jsmhq.invalid>`.
- The Deploy workflow deploys a preview of every PR. Check your change on it, and put the preview URL in the PR. If the Deploy workflow can't run yet (early Phase 0), say so in the PR and skip this check.

## Checking your change on a Vercel preview

- Get the preview URL from the Deploy workflow's comment on your PR (`gh pr view <n> --comments`), never from the branch name. Wait until the Deploy workflow passes.
- Previews are protected. Send the header `x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET` on every request to the preview host, and never to any other host. In browser tests, scope it to that host: a setting that applies to all hosts leaks the secret. For browser tests, also send `x-vercel-set-bypass-cookie: true` on the first request.
- If a preview URL is blocked by your sandbox, call `request_access` for `*.vercel.app` (all previews) rather than the single URL.

## When you must stop and ask

| Situation | Do |
|---|---|
| You need to change `packages/shared`, or change or drop an existing table or column | Stop. That's a contract change. The lead plans it; the product owner approves it. |
| The task is unclear or conflicts with `project.md` | Stop. Ask. Don't guess. |
| The task depends on an open decision in `project.md` §14 | Stop. Ask. Don't pick for them. |
| You need an account, a key, or a sign-in | Stop. Say exactly what you need and where it goes (e.g. your env file). Accounts and sign-ins are the product owner's job. |

## Reviews and your next task

- Fix every valid CodeRabbit or lead comment on the same branch. If a comment is wrong, reply on the PR with the reason. Answer every thread.
- Once your PR is open, the lead may give you your next task. Take it on a new branch from `main`.
- When review comments arrive on an earlier PR, switch back to that branch, fix, push, and return. Don't call `set_my_status` for the earlier task: it would update your current one. HQ tracks the earlier PR by itself.
- Never start a task that needs code from one of your open PRs. If nothing independent is ready, say so.
- Never merge your own PR, never push to `main`, never force-push a branch under review.

## Database rules

- The app reaches the database only through `supabase-js`: `createUserClient()` (the user's Clerk token, RLS applies) and `createServiceClient()` (secret key, server only), both in `apps/web/lib/supabase`.
- Public pages read content only through `apps/web/lib/content`.
- Migrations are SQL files in `supabase/migrations`, named `<UTC timestamp>_<name>.sql`, newer than the latest one on `main`. Never edit a merged migration.
- Every new table or function ships with its RLS policies and grants in the same migration (see `project.md` §7 and §9). Add a new table or column only if your task says so.
- Test migrations, policies and functions on pglite (`packages/db/supabase-pglite.ts`). Never run a local Supabase stack or a Docker database.
- The Supabase dev project is shared by every developer and every preview. Its data is throwaway, but never apply an unmerged migration to it. After your PR merges, apply it to dev through the Supabase MCP, recording the file's version, then regenerate the types (the MCP's type generator) and confirm there's no diff.
- The Supabase MCP is scoped to the dev project. Never touch the production database. The product owner applies migrations to production before promoting the build.
- Migrations are additive: the live version must keep working while one runs. Dropping or renaming a table or column happens in a later PR, once no deployed code uses it.
- Never put real client data, names, letters or certificates in dev or in fixtures.

## Security rules

`docs/project.md` §9 lists every rule. The ones you must never break:

- Check the permission on the server in every gated action, using keys from `PERMISSIONS`. Never trust the client, and never check a role name.
- User reads go through the user client, so RLS scopes them. Never use the service client with a manual user filter; use it only after the route has checked identity and permission.
- Protected documents are never public. Every open checks the grant, writes the log, adds the watermark, and uses a signed URL that lasts 60 seconds.
- Only the admin's `document_requests.decide` permission grants or withdraws a document. Never add a reject action.
- No testimonial or logo reaches the public unless consent is confirmed, the admin approved it, and it is published. A hidden organization name never reaches the browser.
- Render chat messages and form input as text, never HTML. Never pass stored HTML to `dangerouslySetInnerHTML`.
- Never send personal data or message text to PostHog.
- No secret in `NEXT_PUBLIC_*` or a commit. Never remove `.env` from `.gitignore`.

## Code conventions

| Area | Rule |
|---|---|
| Types | TypeScript `strict`. No `any`. Import API types from `packages/shared`; never redefine them. |
| API input | A zod schema per route, next to its type in `packages/shared` |
| API errors | `{ error: { code, message } }` with the right HTTP status. Error text shown to users comes from `messages/`, in their language. |
| Tests | Vitest. At least one test per route and per pure function. Every permission gets a refused-case test. |
| New dependency | Allowed. Name it and the reason in the PR body. |
| UI | Follow `project.md` §13 Design. Reuse components in `apps/web/components`. |
| UI text | Every string lives in `apps/web/messages/{ar,en}.json`. Never hardcode text. |
| RTL | Logical Tailwind utilities only (`ms-`, `pe-`, `start-`). Never `ml-`, `pr-`, `left-`. |
| Dates and times | Stored in UTC. Shown with `Intl` in the user's locale and time zone. |
| Site name | `SITE_NAME` from `packages/shared`. Never hardcode it. |

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | Run the app locally |
| `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` | Checks. All must pass before a PR. |
| `pnpm db:types` | Regenerate `packages/db/types.ts` from the dev project (needs `SUPABASE_ACCESS_TOKEN`; agents use the MCP's type generator instead) |
