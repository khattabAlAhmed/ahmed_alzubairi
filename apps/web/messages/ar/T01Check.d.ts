import type messages from "./T01Check.json";

declare global {
  interface MessageNamespaces {
    T01Check: typeof messages;
  }
}
