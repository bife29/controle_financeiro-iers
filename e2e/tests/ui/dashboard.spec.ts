import { test, expect, Page } from "@playwright/test";

async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("seu@email.com").fill(process.env.ADMIN_EMAIL || "admin@iers.org");
  await page.getByPlaceholder("••••••••").fill(process.env.ADMIN_PASSWORD || "admin123");
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible({ timeout: 10000 });
}

test.describe("Dashboard - UI", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("exibe cards de resumo financeiro", async ({ page }) => {
    await expect(page.getByText(/entrada|receita/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/saída|despesa/i).first()).toBeVisible();
    await expect(page.getByText(/saldo/i).first()).toBeVisible();
  });

  test("exibe valores numéricos nos cards", async ({ page }) => {
    await expect(page.getByText(/R\$/).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Financeiro - UI", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole("link", { name: "Financeiro" }).click();
    await expect(page).toHaveURL(/financeiro/);
  });

  test("exibe opções do módulo financeiro", async ({ page }) => {
    await expect(page.getByText(/transaç|projeto|importaç/i).first()).toBeVisible({ timeout: 5000 });
  });
});
