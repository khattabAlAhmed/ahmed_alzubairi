import type messages from "./DashboardTrust.json";

declare global {
  interface MessageNamespaces {
    DashboardTrust: typeof messages;
  }
}
