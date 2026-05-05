import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env") });

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const API_URL = process.env.API_URL || "http://127.0.0.1:8001";

export default defineConfig({
  testDir: "./tests",
  globalTeardown: "./global-teardown.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    // Testes de API (sem browser)
    {
      name: "api",
      testDir: "./tests/api",
      use: {
        baseURL: API_URL,
      },
    },
    // Testes de UI - Chromium
    {
      name: "chromium",
      testDir: "./tests/ui",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: BASE_URL,
      },
    },
    // Testes de UI - Firefox
    {
      name: "firefox",
      testDir: "./tests/ui",
      use: {
        ...devices["Desktop Firefox"],
        baseURL: BASE_URL,
      },
    },
    // Testes de UI - Mobile
    {
      name: "mobile",
      testDir: "./tests/ui",
      use: {
        ...devices["iPhone 14"],
        baseURL: BASE_URL,
      },
    },
  ],
});
