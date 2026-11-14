import type messages from "./DocumentRequestDialog.json";

declare global {
  interface MessageNamespaces {
    DocumentRequestDialog: typeof messages;
  }
}
