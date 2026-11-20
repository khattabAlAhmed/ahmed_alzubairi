import type messages from "./ContentWork.json";

declare global {
  interface MessageNamespaces {
    ContentWork: typeof messages;
  }
}
