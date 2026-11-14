import type messages from "./DashboardNotifications.json";

declare global {
  interface MessageNamespaces {
    DashboardNotifications: typeof messages;
  }
}
