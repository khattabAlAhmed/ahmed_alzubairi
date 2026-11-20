import type messages from "./DesignSystemVoice.json";

declare global {
  interface MessageNamespaces {
    DesignSystemVoice: typeof messages;
  }
}
