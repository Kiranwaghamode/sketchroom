import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// The test logs in as the seeded demo users (`pnpm db:seed`), whose password is
// DEMO_PASSWORD in apps/web/.env.
if (!process.env["DEMO_PASSWORD"] && existsSync("apps/web/.env")) {
  process.loadEnvFile("apps/web/.env");
}

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Starts the web app and the sync server (or reuses ones already running).
  // Runs against the dev server: the test reads window.doc, which is only exposed in development.
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
