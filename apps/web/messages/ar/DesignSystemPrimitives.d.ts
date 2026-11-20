import type messages from "./DesignSystemPrimitives.json";

declare global {
  interface MessageNamespaces {
    DesignSystemPrimitives: typeof messages;
  }
}
