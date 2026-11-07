import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

// Shared config for the packages. apps/web has its own, from eslint-config-next.
export default defineConfig([tseslint.configs.recommended]);
