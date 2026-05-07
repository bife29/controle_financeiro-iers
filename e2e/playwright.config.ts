import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Permite escolher qual .env carregar via E2E_ENV (ex.: production)
const envFile =
  process.env.E2E_ENV === "production" ? ".env.production" : ".env";
dotenv.config({ path: path.resolve(__dirname, envFile) });

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const API_URL = process.env.API_URL || "http://127.0.0.1:8001";
const IS_PROD = process.env.E2E_ENV === "production";

// HARD GUARD: nunca rodar suites destrutivas em produção sem opt-in explícito
const PROD_HOST_RE =
  /onrender\.com|vercel\.app|herokuapp\.com|railway\.app|fly\.dev|neon\.tech|amazonaws\.com|azurewebsites\.net|appspot\.com/i;
const looksProd = PROD_HOST_RE.test(API_URL) || PROD_HOST_RE.test(BASE_URL);
if (looksProd && process.env.ALLOW_PROD_DESTRUCTIVE !== "true") {
  // Apenas avisa; o filtro real está em cada projeto via testIgnore abaixo
  console.warn(
    `\n⚠️  Produção detectada (${API_URL}). Suites api/ui serão IGNORADAS sem ALLOW_PROD_DESTRUCTIVE=true.\n   Use --project=smoke para checks read-only seguros.\n`
  );
}
const PROD_LOCK = looksProd && process.env.ALLOW_PROD_DESTRUCTIVE !== "true";

export default defineConfig({
  testDir: "./tests",
  globalTeardown: "./global-teardown.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  // Produção (Render free tier) pode ter cold start lento
  timeout: IS_PROD ? 90_000 : 30_000,

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    // Smoke seguro para PRODUÇÃO (somente leitura)
    {
      name: "smoke",
      testDir: "./tests/smoke",
      use: {
        baseURL: API_URL,
      },
    },
    // Testes de API (sem browser)
    {
      name: "api",
      testDir: "./tests/api",
      testIgnore: PROD_LOCK ? /.*/ : undefined,
      use: {
        baseURL: API_URL,
      },
    },
    // Testes de UI - Chromium
    {
      name: "chromium",
      testDir: "./tests/ui",
      testIgnore: PROD_LOCK ? /.*/ : undefined,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: BASE_URL,
      },
    },
    // Testes de UI - Firefox
    {
      name: "firefox",
      testDir: "./tests/ui",
      testIgnore: PROD_LOCK ? /.*/ : undefined,
      use: {
        ...devices["Desktop Firefox"],
        baseURL: BASE_URL,
      },
    },
    // Testes de UI - Mobile
    {
      name: "mobile",
      testDir: "./tests/ui",
      testIgnore: PROD_LOCK ? /.*/ : undefined,
      use: {
        ...devices["iPhone 14"],
        baseURL: BASE_URL,
      },
    },
  ],
});
