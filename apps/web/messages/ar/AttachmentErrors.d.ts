import type messages from "./AttachmentErrors.json";

declare global {
  interface MessageNamespaces {
    AttachmentErrors: typeof messages;
  }
}
