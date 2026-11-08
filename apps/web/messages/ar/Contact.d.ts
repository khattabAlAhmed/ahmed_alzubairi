import type messages from "./Contact.json";

declare global {
  interface MessageNamespaces {
    Contact: typeof messages;
  }
}
