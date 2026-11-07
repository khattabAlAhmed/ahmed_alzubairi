import type { Locale } from "@repo/shared";
import type messages from "../messages/ar.json";

declare global {
  /**
   * The namespace files under `messages/ar/`. Each one adds itself here from a
   * `.d.ts` next to it (see `messages.ts`), so no shared file lists them.
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- filled by declaration merging
  interface MessageNamespaces {}

  interface ImportMeta {
    /** Turbopack's and Vite's glob import. */
    glob<Module = unknown>(
      pattern: string | readonly string[],
      options: { import: "default"; eager?: false },
    ): Record<string, () => Promise<Module>>;
    glob<Module = unknown>(
      pattern: string | readonly string[],
      options: { import: "default"; eager: true },
    ): Record<string, Module>;
  }
}

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages & MessageNamespaces;
  }
}
