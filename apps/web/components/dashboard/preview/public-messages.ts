import type { Locale } from "@repo/shared";
import type { AbstractIntlMessages } from "next-intl";

/**
 * The public site's messages for one language, loaded in the browser only
 * when the preview opens, so the dashboard doesn't ship them up front. The
 * public components read the base namespaces (Nav, Common…) and these files.
 */
const LOADERS: Record<Locale, () => Promise<AbstractIntlMessages>> = {
  ar: async () => {
    const [base, pages, catalog, home, contact] = await Promise.all([
      import("@/messages/ar.json"),
      import("@/messages/ar/Pages.json"),
      import("@/messages/ar/Catalog.json"),
      import("@/messages/ar/Home.json"),
      import("@/messages/ar/Contact.json"),
    ]);
    return {
      ...base.default,
      Pages: pages.default,
      Catalog: catalog.default,
      Home: home.default,
      Contact: contact.default,
    };
  },
  en: async () => {
    const [base, pages, catalog, home, contact] = await Promise.all([
      import("@/messages/en.json"),
      import("@/messages/en/Pages.json"),
      import("@/messages/en/Catalog.json"),
      import("@/messages/en/Home.json"),
      import("@/messages/en/Contact.json"),
    ]);
    return {
      ...base.default,
      Pages: pages.default,
      Catalog: catalog.default,
      Home: home.default,
      Contact: contact.default,
    };
  },
};

const cache = new Map<Locale, Promise<AbstractIntlMessages>>();

export function loadPublicMessages(locale: Locale): Promise<AbstractIntlMessages> {
  let pending = cache.get(locale);
  if (!pending) {
    pending = LOADERS[locale]();
    // A failed load can be tried again.
    pending.catch(() => cache.delete(locale));
    cache.set(locale, pending);
  }
  return pending;
}
