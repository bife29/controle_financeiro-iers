import { test, expect, Page } from "@playwright/test";
import { tag } from "../../helpers/e2e-tag";

/**
 * UI E2E — Compras
 *  - Login → navega para /compras → home renderiza KPIs
 *  - Cria nova lista → adiciona itens → gera pedido
 *  - Verifica que a tela do pedido aparece com status Pendente
 *
 * Não testa aprovação por outro usuário (cobertura de regras está nos
 * testes API). Aqui validamos o fluxo do usuário no navegador.
 */
async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("seu@email.com").fill(process.env.ADMIN_EMAIL || "admin@iers.org");
  await page.getByPlaceholder("••••••••").fill(process.env.ADMIN_PASSWORD || "admin123");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 10000 });
}

test.describe("UI Compras — fluxo lista → pedido", () => {
  test("home renderiza KPIs", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/compras");
    await expect(page.getByRole("heading", { name: /Compras/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Pendentes/ })).toBeVisible();
    await expect(page.getByText("Total recebido este mês")).toBeVisible();
  });

  test("criar lista, adicionar item e gerar pedido", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/compras/listas");

    const listName = tag("UI Lista");
    await page.getByRole("button", { name: /Nova lista/i }).click();
    await page.getByPlaceholder(/Nome/i).fill(listName);
    await page.getByRole("button", { name: /^Salvar$/i }).click();

    // Card da lista deve aparecer; abrir
    await expect(page.getByText(listName)).toBeVisible();
    await page.getByRole("link", { name: listName }).click();

    // Adicionar item
    const itemDesc = tag("UI Arroz");
    await page.getByPlaceholder("Descrição *").fill(itemDesc);
    await page.locator('input[placeholder="Preço estimado"]').fill("12.5");
    await page.getByRole("button", { name: /Adicionar/i }).click();

    // Item aparece na tabela
    await expect(page.getByText(itemDesc)).toBeVisible();

    // Gerar pedido
    await page.getByRole("button", { name: /Gerar pedido/i }).click();
    await page.getByRole("button", { name: /Confirmar/i }).click();

    // Deve navegar para o pedido novo
    await page.waitForURL(/\/compras\/pedidos\/\d+/, { timeout: 10000 });
    await expect(page.getByText("Pendente").first()).toBeVisible();
    await expect(page.getByText(itemDesc)).toBeVisible();
  });
});
