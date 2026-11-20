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

import type { Formats } from "next-intl";

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

/** The glob keys of one locale's namespace files. */
export function pathsForLocale(
  paths: readonly string[],
  locale: string,
): string[] {
  return paths.filter((path) => path.includes(`/messages/${locale}/`));
}

/*
 * Arabic digits inside messages (DESIGN.md "Numbers"). next-intl formats a
 * message's numbers with its locale, `ar`, and some engines (Node's ICU, for
 * one) give Western digits for that. The routing locale has to stay `ar`, so
 * instead the Arabic messages point their numbers at a named format that sets
 * the numbering system: `{n, number}` and a plural's `#` become
 * `{n, number, arab}`, and `request.ts` defines `arab`. A plain `{n}` is left
 * alone: ICU can't tell a number from text there, and callers pass both.
 */

/** The global number format the rewritten Arabic messages use. */
export const ARABIC_DIGITS_FORMAT = "arab";

/** next-intl's global formats: `arab` is what the rewritten Arabic messages name. */
export const MESSAGE_FORMATS = {
  number: { [ARABIC_DIGITS_FORMAT]: { numberingSystem: "arab" } },
} satisfies Formats;

const isSpace = (char: string | undefined) => char !== undefined && /\s/.test(char);

/**
 * One ICU message with its unstyled numbers and plural `#` pointed at the
 * `arab` format. Everything else is copied as written: text, quoted text,
 * plain and styled arguments, selects and dates. A `#` under a plural with an
 * `offset` is left alone (its value is the count minus the offset).
 * A string that isn't valid ICU is returned unchanged: `ar.json` also holds
 * Clerk's strings, which use `{{name}}`.
 */
export function withArabicDigits(message: string): string {
  try {
    return rewriteNumbers(message);
  } catch {
    return message;
  }
}

class MalformedMessage extends Error {}

function rewriteNumbers(message: string): string {
  let at = 0;
  const fail = (): never => {
    throw new MalformedMessage(message);
  };

  // A quote starts literal text before a syntax character (and `#` in a plural).
  function quoted(inPlural: boolean): string | null {
    if (message[at] !== "'") return null;
    const next = message[at + 1];
    if (next === "'") {
      at += 2;
      return "''";
    }
    if (next !== "{" && next !== "}" && !(inPlural && next === "#")) {
      at += 1;
      return "'";
    }
    const start = at;
    at += 1;
    while (at < message.length) {
      if (message[at] === "'" && message[at + 1] === "'") at += 2;
      else if (message[at] === "'") {
        at += 1;
        return message.slice(start, at);
      } else at += 1;
    }
    return message.slice(start);
  }

  function text(pluralVar: string | null, inPlural: boolean): string {
    let out = "";
    while (at < message.length && message[at] !== "}") {
      const literal = quoted(inPlural);
      if (literal !== null) out += literal;
      else if (message[at] === "{") out += argument(pluralVar, inPlural);
      else if (message[at] === "#" && inPlural && pluralVar !== null) {
        out += `{${pluralVar}, number, ${ARABIC_DIGITS_FORMAT}}`;
        at += 1;
      } else out += message[at++];
    }
    return out;
  }

  // From a `{` to its `}`, copied as written (styles, skeletons, dates).
  function verbatim(start: number): string {
    let depth = 0;
    while (at < message.length) {
      const char = message[at];
      if (char === "'" && quoted(false) !== null) continue;
      at += 1;
      if (char === "{") depth += 1;
      else if (char === "}" && --depth === 0) return message.slice(start, at);
    }
    return fail();
  }

  function word(): string {
    const start = at;
    while (at < message.length && !/[\s,{}]/.test(message[at] ?? "")) at += 1;
    return message.slice(start, at);
  }

  function spaces(): string {
    const start = at;
    while (isSpace(message[at])) at += 1;
    return message.slice(start, at);
  }

  function argument(pluralVar: string | null, inPlural: boolean): string {
    const start = at;
    at += 1; // {
    const nameStart = at;
    while (at < message.length && message[at] !== "," && message[at] !== "}") at += 1;
    const name = message.slice(nameStart, at).trim();
    if (message[at] === "}") {
      at += 1;
      return message.slice(start, at);
    }
    if (message[at] !== ",") return fail();
    at += 1;
    const typeStart = at;
    while (at < message.length && message[at] !== "," && message[at] !== "}") at += 1;
    const type = message.slice(typeStart, at).trim();

    if (type === "number" && message[at] === "}") {
      at += 1;
      return `{${name}, number, ${ARABIC_DIGITS_FORMAT}}`;
    }
    const cases = type === "plural" || type === "selectordinal" ? "plural" : type === "select" ? "select" : null;
    if (cases === null || message[at] !== ",") {
      at = start;
      return verbatim(start);
    }

    let out = message.slice(start, at + 1);
    at += 1; // ,
    let offset = false;
    for (;;) {
      out += spaces();
      if (message[at] === "}") {
        at += 1;
        return `${out}}`;
      }
      const selector = word();
      if (selector === "") return fail();
      out += selector;
      if (selector.startsWith("offset:")) {
        offset = true;
        continue;
      }
      out += spaces();
      if (message[at] !== "{") return fail();
      at += 1;
      const inner =
        cases === "plural" ? text(offset ? null : name, true) : text(pluralVar, inPlural);
      if (message[at] !== "}") return fail();
      at += 1;
      out += `{${inner}}`;
    }
  }

  const out = text(null, false);
  if (at !== message.length) fail();
  return out;
}

/** Every message string in a tree, rewritten by `withArabicDigits`. Pure. */
export function arabicDigitMessages<Tree>(messages: Tree): Tree {
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return withArabicDigits(node);
    if (Array.isArray(node)) return node.map(walk);
    if (isPlainObject(node)) return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, walk(child)]));
    return node;
  };
  return walk(messages) as Tree;
}
