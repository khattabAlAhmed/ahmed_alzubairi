import type messages from "./DesignSystemShell.json";

declare global {
  interface MessageNamespaces {
    DesignSystemShell: typeof messages;
  }
}
