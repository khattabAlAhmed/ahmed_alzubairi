import type messages from "./DesignSystemContentIdentity.json";

declare global {
  interface MessageNamespaces {
    DesignSystemContentIdentity: typeof messages;
  }
}
