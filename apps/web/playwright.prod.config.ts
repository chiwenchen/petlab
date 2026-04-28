import { defineConfig } from "@playwright/test";

const BASE = process.env.PROD_BASE_URL ?? "https://petlab-5ea.pages.dev";

export default defineConfig({
  testDir: "./e2e/prod-tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/report-prod" }]],
  timeout: 180_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: BASE,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
});
