# Mockups

The approved design, as static HTML. These are copies of the Claude Design canvas (https://claude.ai/artifact/CPd8qYyTAYhdEeRYBfeZXr) and the design system (https://claude.ai/artifact/SzbYLxMUnJ5HRR2m6UXqNs).

| Folder | Holds |
|---|---|
| `pages/` | Every public page: 22 in Arabic, 22 in English. `Main.html` is the Arabic home, `Home-en.html` the English one. |
| `components/` | Every component board from the design system, in every state. |
| `index.html` | A list of both, with links to the screenshots. |
| `../screens/` | Screenshots: every page at 1440 px light and dark and at 375 px, every board light and dark. |

## How to use them

- Open any file in a browser. Add `?theme=dark` to the URL for dark.
- They load `../system/tokens.css`, `components.css` and `pages.css`, so they always show the current system.
- Use the markup for structure, classes and states. Build it as React components from `apps/web/components`, never by pasting this HTML.
- The `.r-*` classes are the design system's components. The `.p-*` classes in `pages.css` are page layout.
- Copy: the voice is approved and goes into `messages/{ar,en}.json`. Facts (years, counts, names, quotes, contact details) are placeholders. They come from Ahmed's content in the dashboard.
- Photos are dev placeholders from `../images/`. See `../images/README.md`.
