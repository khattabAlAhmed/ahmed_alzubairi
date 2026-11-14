import type messages from "./AccountProfile.json";

declare global {
  interface MessageNamespaces {
    AccountProfile: typeof messages;
  }
}
