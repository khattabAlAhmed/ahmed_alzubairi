# The record — exported files

Copied from the design system (https://claude.ai/artifact/SzbYLxMUnJ5HRR2m6UXqNs). Don't edit them here: change the design system, then copy them again.

| File | What it is |
| --- | --- |
| `tokens.json` | Every token: colors for light and dark, Arabic, English and data type styles, spacing, radius, rule widths, shadow, layout |
| `tokens.css` | The same tokens compiled to CSS custom properties, plus one class per type style |
| `components.css` | The reference stylesheet the component previews use. Port each class into its React component in `apps/web/components` (see `../components.md` for the file of each item) |

The Foundation task moves the tokens into `apps/web/app/globals.css` and Tailwind v4 `@theme`. It does not import these files at runtime.
