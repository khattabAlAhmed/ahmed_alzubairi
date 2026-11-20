# Scripts

## `pnpm screenshots`

Full-page screenshots of `/[locale]/design-system` and every public page, at 375 and 1280 px, in Arabic and English, light and dark. Phase 8 UI PRs attach them next to the mockup.

### How to use

1. Start the app (`pnpm dev`), or pick a preview URL from the Deploy workflow's comment on the PR.
2. Run from the repo root:

| Command | Does |
|---|---|
| `pnpm screenshots` | Every page, 8 shots each, from http://localhost:3000 |
| `pnpm screenshots --only home,projects` | Only these pages (`--help` lists the names) |
| `pnpm screenshots --mockups --only home` | Also shoots `docs/design/mockups/pages/Main.html` and `Home-en.html` at the same widths and themes |
| `pnpm screenshots --mockups --only design-system` | Also shoots every board in `docs/design/mockups/components/` |
| `pnpm screenshots --base-url https://<preview>.vercel.app` | Shoots a preview |
| `pnpm screenshots --out ./shots` | Writes somewhere else (relative to where you ran it) |
| `pnpm screenshots --show-consent` | Keeps the cookie banner (by default the choice is set to "denied", so the fixed banner doesn't sit over the page and PostHog stays off) |

3. Find the files in `apps/web/screenshots/` (gitignored).

### File names

- App: `<page>-<locale>-<width>-<theme>.png`, e.g. `home-ar-375-dark.png`.
- Mockup: the same name plus `-mockup`, e.g. `home-ar-375-dark-mockup.png`, so it sorts next to the app shot.
- Component boards: `design-system-board-<Board>-<width>-<theme>-mockup.png`.

### What it does

- Uses Playwright (`playwright-core`) with the sandbox's Chromium at `/usr/bin/chromium` (set `CHROMIUM_PATH` to use another).
- Sets the theme the way the theme switch stores it (`localStorage.theme`) before the page loads, and checks the page really is dark or light and `rtl` or `ltr`. A mismatch prints `warn`.
- Detail pages (one expertise area, service, project, course and article) take the first detail link on their list page, per locale. If a list has none, the page is skipped with a warning.
- The 404 shot opens `/<locale>/screenshots-no-such-page`.
- Waits for `document.fonts.ready`, scrolls once to load lazy images, and runs with `reducedMotion: "reduce"`.
- Previews: when `VERCEL_AUTOMATION_BYPASS_SECRET` is set and the base URL is an `https://*.vercel.app` host, it sends `x-vercel-protection-bypass` and `x-vercel-set-bypass-cookie: true` to that host only, through a route on that host. One request gets the bypass cookie, then the route is removed. The secret never goes to another host.
- Before shooting, it opens `/robots.txt` once. If the app isn't running, or a preview redirects to Vercel's login (no secret), it stops with a clear message. A page that leaves the base host prints `warn`.
- Exits with code 1 if any shot failed.
