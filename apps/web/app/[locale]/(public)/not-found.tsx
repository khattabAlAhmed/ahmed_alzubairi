import { NotFoundContent } from "@/components/not-found-content";
import { noindexMetadata } from "@/lib/seo";

// Next adds `noindex` on a 404 status; this also covers a 404 after streaming starts.
export const metadata = noindexMetadata;

export default function PublicNotFound() {
  return <NotFoundContent />;
}
