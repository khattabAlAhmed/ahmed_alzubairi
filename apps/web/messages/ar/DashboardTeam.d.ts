import type messages from "./DashboardTeam.json";

declare global {
  interface MessageNamespaces {
    DashboardTeam: typeof messages;
  }
}
