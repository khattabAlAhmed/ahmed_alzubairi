import type messages from "./DeleteErrors.json";

declare global {
  interface MessageNamespaces {
    DeleteErrors: typeof messages;
  }
}
