import type messages from "./AuthReason.json";

declare global {
  interface MessageNamespaces {
    AuthReason: typeof messages;
  }
}
