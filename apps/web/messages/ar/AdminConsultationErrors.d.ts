import type messages from "./AdminConsultationErrors.json";

declare global {
  interface MessageNamespaces {
    AdminConsultationErrors: typeof messages;
  }
}
