import type messages from "./DocumentOpenErrors.json";

declare global {
  interface MessageNamespaces {
    DocumentOpenErrors: typeof messages;
  }
}
