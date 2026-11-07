import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_NAME } from "@repo/shared";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: SITE_NAME,
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-text">{children}</body>
    </html>
  );
}
