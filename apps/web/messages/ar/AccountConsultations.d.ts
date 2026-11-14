import type messages from "./AccountConsultations.json";

declare global {
  interface MessageNamespaces {
    AccountConsultations: typeof messages;
  }
}
