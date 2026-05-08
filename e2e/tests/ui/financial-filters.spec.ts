import { test, expect, Page } from "@playwright/test";

async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("seu@email.com").fill(process.env.ADMIN_EMAIL || "admin@iers.org");
  await page.getByPlaceholder("••••••••").fill(process.env.ADMIN_PASSWORD || "admin123");
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible({ timeout: 10000 });
}

test.describe("Financeiro — filtros via URL (deep-link)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("deep-link 'A receber' aplica status=Previsto e type=Entrada", async ({ page }) => {
    await page.goto("/financeiro/transacoes?status=Previsto&type=Entrada");
    // Os selects exibidos na página devem refletir o filtro vindo da URL
    const statusSelect = page.locator("select").filter({ hasText: /todos os status/i });
    const typeSelect = page.locator("select").filter({ hasText: /todos os tipos/i });
    await expect(statusSelect).toHaveValue("Previsto");
    await expect(typeSelect).toHaveValue("Entrada");
  });

  test("deep-link 'A pagar' aplica status=Previsto e type=Saída", async ({ page }) => {
    await page.goto("/financeiro/transacoes?status=Previsto&type=Saída");
    const statusSelect = page.locator("select").filter({ hasText: /todos os status/i });
    const typeSelect = page.locator("select").filter({ hasText: /todos os tipos/i });
    await expect(statusSelect).toHaveValue("Previsto");
    await expect(typeSelect).toHaveValue("Saída");
  });

  test("clicar no card 'A receber' do hub leva para lista filtrada", async ({ page }) => {
    await page.goto("/financeiro");
    await page.getByText(/A receber \(Previsto/i).click();
    await expect(page).toHaveURL(/financeiro\/transacoes.*type=Entrada/);
    await expect(page).toHaveURL(/financeiro\/transacoes.*status=Previsto/);
  });
});
