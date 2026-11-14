import type messages from "./Workspace.json";

declare global {
  interface MessageNamespaces {
    Workspace: typeof messages;
  }
}
