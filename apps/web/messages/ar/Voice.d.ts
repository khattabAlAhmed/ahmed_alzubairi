import type messages from "./Voice.json";

declare global {
  interface MessageNamespaces {
    Voice: typeof messages;
  }
}
