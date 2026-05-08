import { test, expect } from "@playwright/test";

test.describe("UI — página de Relatórios", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e-?mail/i).fill(process.env.ADMIN_EMAIL || "admin@iers.org");
    await page.getByLabel(/senha/i).fill(process.env.ADMIN_PASSWORD || "admin123");
    await page.getByRole("button", { name: /entrar/i }).click();
    await page.waitForURL(/\/$/);
  });

  test("Acessa /relatorios e exibe os 5 cards", async ({ page }) => {
    await page.goto("/relatorios");
    await expect(page.getByRole("heading", { name: /relat[óo]rios anal[íi]ticos/i })).toBeVisible();
    await expect(page.getByTestId("report-card-cashbook")).toBeVisible();
    await expect(page.getByTestId("report-card-by-category")).toBeVisible();
    await expect(page.getByTestId("report-card-by-project")).toBeVisible();
    await expect(page.getByTestId("report-card-projects-by-member")).toBeVisible();
    await expect(page.getByTestId("report-card-payables-receivables")).toBeVisible();
  });

  test("Baixa PDF do Livro Caixa", async ({ page }) => {
    await page.goto("/relatorios");
    await page.getByTestId("report-card-cashbook").click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("report-download-pdf").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/livro-caixa.*\.pdf$/);
  });

  test("Baixa XLSX por Categoria", async ({ page }) => {
    await page.goto("/relatorios");
    await page.getByTestId("report-card-by-category").click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("report-download-xlsx").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/relatorio-por-categoria.*\.xlsx$/);
  });
});
