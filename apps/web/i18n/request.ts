import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { mergeMessages, pathsForLocale } from "./messages";
import { routing } from "./routing";

// Every namespace file, found at build time. See `messages.ts`.
const namespaceFiles = import.meta.glob<unknown>("../messages/*/*.json", {
  import: "default",
});

async function loadNamespaces(locale: string) {
  const paths = pathsForLocale(Object.keys(namespaceFiles), locale);
  const contents = await Promise.all(paths.map((path) => namespaceFiles[path]()));
  return Object.fromEntries(paths.map((path, i) => [path, contents[i]]));
}

export default getRequestConfig(async ({ locale }) => {
  // Root params keep pages static: the fallback, request headers, would not.
  const resolved = locale ?? (await rootParams.locale());
  if (!hasLocale(routing.locales, resolved)) {
    notFound();
  }

  const [base, namespaces] = await Promise.all([
    import(`../messages/${resolved}.json`),
    loadNamespaces(resolved),
  ]);

  return {
    locale: resolved,
    messages: mergeMessages(base.default, namespaces),
  };
});
