import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const fromHere = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fromHere("."),
      // The package throws outside a React server build, so tests use its empty file.
      "server-only": fromHere("./node_modules/server-only/empty.js"),
    },
  },
  test: {
    // Component tests opt in with a `// @vitest-environment jsdom` comment.
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
    // next-intl imports `next/server` with no extension, which Node can't resolve.
    server: { deps: { inline: ["next-intl"] } },
  },
});
