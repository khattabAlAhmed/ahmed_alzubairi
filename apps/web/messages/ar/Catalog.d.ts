import type messages from "./Catalog.json";

declare global {
  interface MessageNamespaces {
    Catalog: typeof messages;
  }
}
