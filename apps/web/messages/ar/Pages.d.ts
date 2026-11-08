import type messages from "./Pages.json";

declare global {
  interface MessageNamespaces {
    Pages: typeof messages;
  }
}
