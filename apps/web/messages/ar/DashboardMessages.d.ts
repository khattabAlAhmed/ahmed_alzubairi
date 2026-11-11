import type messages from "./DashboardMessages.json";

declare global {
  interface MessageNamespaces {
    DashboardMessages: typeof messages;
  }
}
