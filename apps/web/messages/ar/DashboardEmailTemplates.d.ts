import type messages from "./DashboardEmailTemplates.json";

declare global {
  interface MessageNamespaces {
    DashboardEmailTemplates: typeof messages;
  }
}
