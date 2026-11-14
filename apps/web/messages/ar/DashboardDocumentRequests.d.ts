import type messages from "./DashboardDocumentRequests.json";

declare global {
  interface MessageNamespaces {
    DashboardDocumentRequests: typeof messages;
  }
}
