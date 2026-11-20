import type messages from "./DesignSystem.json";

declare global {
  interface MessageNamespaces {
    DesignSystem: typeof messages;
  }
}
