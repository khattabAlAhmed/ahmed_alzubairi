import type messages from "./DashboardDocuments.json";

declare global {
  interface MessageNamespaces {
    DashboardDocuments: typeof messages;
  }
}
