import type messages from "./DocumentRequestErrors.json";

declare global {
  interface MessageNamespaces {
    DocumentRequestErrors: typeof messages;
  }
}
