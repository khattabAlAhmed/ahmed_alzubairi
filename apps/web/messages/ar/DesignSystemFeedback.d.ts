import type messages from "./DesignSystemFeedback.json";

declare global {
  interface MessageNamespaces {
    DesignSystemFeedback: typeof messages;
  }
}
