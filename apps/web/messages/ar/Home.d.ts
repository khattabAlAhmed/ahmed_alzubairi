import type messages from "./Home.json";

declare global {
  interface MessageNamespaces {
    Home: typeof messages;
  }
}
