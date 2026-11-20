import type messages from "./Feedback.json";

declare global {
  interface MessageNamespaces {
    Feedback: typeof messages;
  }
}
