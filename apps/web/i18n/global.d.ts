import type { Locale } from "@repo/shared";
import type messages from "../messages/ar.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
