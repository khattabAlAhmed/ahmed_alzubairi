import type messages from "./ConsultationErrors.json";

declare global {
  interface MessageNamespaces {
    ConsultationErrors: typeof messages;
  }
}
