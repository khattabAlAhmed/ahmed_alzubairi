import type messages from "./DesignSystemWorkspace.json";

declare global {
  interface MessageNamespaces {
    DesignSystemWorkspace: typeof messages;
  }
}
