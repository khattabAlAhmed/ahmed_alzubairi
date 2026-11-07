import { notFound } from "next/navigation";

// Next only renders not-found.tsx from notFound(), so unknown paths need this.
export default function CatchAllPage() {
  notFound();
}
