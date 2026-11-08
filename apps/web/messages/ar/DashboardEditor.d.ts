import type messages from "./DashboardEditor.json";

declare global {
  interface MessageNamespaces {
    DashboardEditor: typeof messages;
  }
}
