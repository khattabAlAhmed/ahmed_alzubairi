/**
 * Namespace files: `messages/<locale>/<Namespace>.json` holds one namespace,
 * named after the file. Each Phase 2 task adds its own files, so no two lanes
 * edit the same one. Lane A owns dashboard namespaces, Lane B public ones.
 *
 * To add `ContactForm`:
 * 1. `messages/ar/ContactForm.json` and `messages/en/ContactForm.json`, with the same keys.
 * 2. `messages/ar/ContactForm.d.ts`, so its keys are type-checked:
 *
 *        import type messages from "./ContactForm.json";
 *        declare global {
 *          interface MessageNamespaces {
 *            ContactForm: typeof messages;
 *          }
 *        }
 *
 * `request.ts` finds the files by glob, so nothing else changes.
 */

type Messages = Record<string, unknown>;

/** PascalCase, like the namespaces in `messages/{ar,en}.json`. */
const NAMESPACE_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

/** `../messages/ar/ContactForm.json` → `ContactForm`. */
export function namespaceFromPath(path: string): string {
  const match = /([^/]+)\.json$/.exec(path);
  if (!match || !NAMESPACE_PATTERN.test(match[1])) {
    throw new Error(
      `Message file ${path} must be named <Namespace>.json, in PascalCase`,
    );
  }
  return match[1];
}

function isPlainObject(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Adds each namespace file to the base messages, under its file name. Throws
 * when a namespace is already taken, by the base file or another file, or
 * when a file isn't a JSON object. Pure: the inputs are left as they are.
 */
export function mergeMessages(
  base: Messages,
  files: Readonly<Record<string, unknown>>,
): Messages {
  const merged: Messages = { ...base };
  const sources = new Map<string, string>(
    Object.keys(base).map((namespace) => [namespace, "the base file"]),
  );

  for (const [path, content] of Object.entries(files)) {
    const namespace = namespaceFromPath(path);
    const taken = sources.get(namespace);
    if (taken) {
      throw new Error(
        `Message namespace "${namespace}" in ${path} is already defined in ${taken}`,
      );
    }
    if (!isPlainObject(content)) {
      throw new Error(`Message file ${path} must hold a JSON object`);
    }
    sources.set(namespace, path);
    merged[namespace] = content;
  }
  return merged;
}

/** The glob keys of one locale's namespace files: `…/messages/<locale>/<file>.json`. */
export function pathsForLocale(
  paths: readonly string[],
  locale: string,
): string[] {
  return paths.filter((path) => {
    const parts = path.split("/");
    return (
      parts.length >= 3 &&
      parts[parts.length - 3] === "messages" &&
      parts[parts.length - 2] === locale &&
      parts[parts.length - 1].endsWith(".json")
    );
  });
}
