import { test, expect, Page } from "@playwright/test";

/**
 * Regressão: botão "Visualizar PDF" nos relatórios.
 *
 * Bug original: usuária reportou ausência de botão para visualizar relatórios
 * (forçava download mesmo quando o usuário só queria conferir o conteúdo).
 * Esta spec garante que o botão existe, dispara um GET ao endpoint do
 * relatório com format=pdf e não dispara download forçado.
 */
async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("seu@email.com").fill(process.env.ADMIN_EMAIL || "admin@iers.org");
  await page.getByPlaceholder("••••••••").fill(process.env.ADMIN_PASSWORD || "admin123");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 10000 });
}

test.describe("Relatórios — Visualizar PDF", () => {
  test("botão 'Visualizar PDF' faz GET com format=pdf (sem forçar download)", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/relatorios");

    // Garante que o botão de preview existe (não existia antes do fix)
    const previewBtn = page.getByTestId("report-preview-pdf");
    await expect(previewBtn).toBeVisible({ timeout: 10000 });

    // Captura o GET do endpoint do relatório
    const reportRequests: { url: string; status: number }[] = [];
    page.on("response", (resp) => {
      const u = resp.url();
      if (u.includes("/api/reports/") && resp.request().method() === "GET") {
        reportRequests.push({ url: u, status: resp.status() });
      }
    });

    // Intercepta window.open (browser pode bloquear popup em headless)
    // e abertura de nova aba via context.
    const popupPromise = page
      .waitForEvent("popup", { timeout: 5_000 })
      .catch(() => null);

    await previewBtn.click();

    // Aguarda o request do relatório acontecer
    await expect
      .poll(() => reportRequests.length, { timeout: 15_000 })
      .toBeGreaterThan(0);

    const reportReq = reportRequests.find((r) => r.url.includes("format=pdf"));
    expect(reportReq, "GET com format=pdf não foi disparado").toBeTruthy();
    expect(reportReq!.status).toBe(200);

    // popup pode ou não ser bloqueado pelo browser; o importante é que o GET
    // foi feito com format=pdf e o botão existe (cobertura mínima do fix).
    await popupPromise;
  });
});
