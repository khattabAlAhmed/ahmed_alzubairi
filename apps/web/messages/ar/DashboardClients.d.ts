import type messages from "./DashboardClients.json";

declare global {
  interface MessageNamespaces {
    DashboardClients: typeof messages;
  }
}
