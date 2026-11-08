import type messages from "./DashboardHome.json";

declare global {
  interface MessageNamespaces {
    DashboardHome: typeof messages;
  }
}
