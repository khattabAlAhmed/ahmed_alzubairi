"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

/**
 * Holds the footer's newsletter signup, and leaves it out on the home page:
 * home has its own newsletter section (the Home mockup's footer shows the
 * Contact column alone), so the form is never on the page twice. Only this
 * small part reads the path; the footer and the public layout stay server
 * components, and their shell stays static.
 */
export function FooterNewsletterSlot({ children }: { children: ReactNode }) {
  // Without the locale prefix: "/" is home in both languages.
  return usePathname() === "/" ? null : children;
}
