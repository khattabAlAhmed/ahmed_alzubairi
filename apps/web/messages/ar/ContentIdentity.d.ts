import type messages from "./ContentIdentity.json";

declare global {
  interface MessageNamespaces {
    ContentIdentity: typeof messages;
  }
}
