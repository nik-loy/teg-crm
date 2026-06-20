import { defineConfig, devices } from "@playwright/test";

console.log("--- DEBUG PLAYWRIGHT CONFIG ---");
console.log("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is:", process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH);
console.log("-------------------------------");

const config = defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { 
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
        },
      },
    },
  ],
});

console.log("RESOLVED PROJECTS:", JSON.stringify(config.projects));

export default config;
