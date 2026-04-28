import { defineConfig } from "@playwright/test";

const PORT_API = 8787;
const PORT_WEB = 3000;

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/report" }]],
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: `http://localhost:${PORT_WEB}`,
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
  globalSetup: require.resolve("./e2e/global-setup"),
  webServer: [
    {
      command: "cd ../api && bunx wrangler dev --port 8787 --persist-to .wrangler/state",
      url: `http://localhost:${PORT_API}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `API_BASE_URL=http://localhost:${PORT_API} next dev --port ${PORT_WEB}`,
      url: `http://localhost:${PORT_WEB}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
