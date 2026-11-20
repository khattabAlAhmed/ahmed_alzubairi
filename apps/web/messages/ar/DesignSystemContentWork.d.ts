import type messages from "./DesignSystemContentWork.json";

declare global {
  interface MessageNamespaces {
    DesignSystemContentWork: typeof messages;
  }
}
