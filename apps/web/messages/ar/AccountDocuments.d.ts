import type messages from "./AccountDocuments.json";

declare global {
  interface MessageNamespaces {
    AccountDocuments: typeof messages;
  }
}
