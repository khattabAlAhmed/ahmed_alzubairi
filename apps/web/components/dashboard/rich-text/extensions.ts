import StarterKit from "@tiptap/starter-kit";
import { safeHref } from "@/components/public/rich-text";
import { HEADING_LEVELS } from "./allow-list";

/** Only http, https and mailto, exactly as the public renderer allows. */
export const isAllowedLink = (url: string): boolean => safeHref(url) !== null;

/**
 * The editor's extensions: StarterKit cut down to the allow-list. Everything
 * it doesn't list can't be typed, pasted or stored. Pasted HTML goes through
 * the same schema, so a `<script>` or `<style>` is ignored and a link outside
 * the allowed protocols loses its link.
 */
export function richTextExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [...HEADING_LEVELS] },
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        protocols: ["mailto"],
        isAllowedUri: (url) => isAllowedLink(url),
        shouldAutoLink: (url) => isAllowedLink(url),
        HTMLAttributes: { rel: "noopener noreferrer", target: null },
      },
    }),
  ];
}
