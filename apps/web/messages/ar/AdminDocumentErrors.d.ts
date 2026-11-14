import type messages from "./AdminDocumentErrors.json";

declare global {
  interface MessageNamespaces {
    AdminDocumentErrors: typeof messages;
  }
}
