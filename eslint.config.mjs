// Lint config for the Node packages (apps/sync, packages/*).
// apps/web has its own config from create-next-app.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/dist/**",
    "**/node_modules/**",
    "**/generated/**",
    "apps/web/**",
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
]);
