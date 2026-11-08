import type messages from "./DashboardPreview.json";

declare global {
  interface MessageNamespaces {
    DashboardPreview: typeof messages;
  }
}
