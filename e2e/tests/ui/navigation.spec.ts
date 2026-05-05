import { test, expect, Page } from "@playwright/test";

/**
 * Helper: realiza login no frontend
 */
async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("seu@email.com").fill(process.env.ADMIN_EMAIL || "admin@iers.org");
  await page.getByPlaceholder("••••••••").fill(process.env.ADMIN_PASSWORD || "admin123");
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible({ timeout: 10000 });
}

test.describe("Navegação - UI", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("sidebar exibe menus principais", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Financeiro" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Membros" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Retiros" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Feedback" })).toBeVisible();
  });

  test("navega para módulo Financeiro", async ({ page }) => {
    await page.getByRole("link", { name: "Financeiro" }).click();
    await expect(page).toHaveURL(/financeiro/);
  });

  test("navega para módulo Membros", async ({ page }) => {
    await page.getByRole("link", { name: "Membros" }).click();
    await expect(page).toHaveURL(/membros/);
  });

  test("navega para módulo Retiros", async ({ page }) => {
    await page.getByRole("link", { name: "Retiros" }).click();
    await expect(page).toHaveURL(/retiros/);
  });

  test("navega para módulo Feedback", async ({ page }) => {
    await page.getByRole("link", { name: "Feedback" }).click();
    await expect(page).toHaveURL(/feedback/);
  });

  test("exibe informações do usuário logado", async ({ page }) => {
    // O nome do admin está na sidebar
    await expect(page.getByText("Administrador", { exact: true })).toBeVisible();
  });
});
