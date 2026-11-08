import type messages from "./DashboardContent.json";

declare global {
  interface MessageNamespaces {
    DashboardContent: typeof messages;
  }
}
