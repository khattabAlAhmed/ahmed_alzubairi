import type messages from "./AdminErrors.json";

declare global {
  interface MessageNamespaces {
    AdminErrors: typeof messages;
  }
}
