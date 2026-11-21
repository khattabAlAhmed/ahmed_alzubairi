import type messages from "./DesignSystemForms.json";

declare global {
  interface MessageNamespaces {
    DesignSystemForms: typeof messages;
  }
}
