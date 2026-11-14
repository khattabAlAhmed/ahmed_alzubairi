import type messages from "./DashboardConsultations.json";

declare global {
  interface MessageNamespaces {
    DashboardConsultations: typeof messages;
  }
}
