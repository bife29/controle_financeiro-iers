import { test, expect, Page } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";

async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("seu@email.com").fill(process.env.ADMIN_EMAIL || "admin@iers.org");
  await page.getByPlaceholder("••••••••").fill(process.env.ADMIN_PASSWORD || "admin123");
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible({ timeout: 10000 });
}

test.describe("Membros - UI", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole("link", { name: "Membros" }).click();
    await expect(page).toHaveURL(/membros/, { timeout: 5000 });
  });

  test("lista de membros é exibida", async ({ page }) => {
    await expect(
      page.getByText(/membro|nome|ficha|nenhum|cadastr/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("botão de novo membro está visível", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: /novo|adicionar|cadastrar/i }).or(
        page.getByRole("button", { name: /novo|adicionar|cadastrar/i })
      )
    ).toBeVisible({ timeout: 5000 });
  });

  test("formulário de cadastro abre ao clicar novo", async ({ page }) => {
    await page
      .getByRole("link", { name: /novo|adicionar|cadastrar/i })
      .or(page.getByRole("button", { name: /novo|adicionar|cadastrar/i }))
      .click();

    // Verifica que algum campo de formulário aparece
    await expect(
      page.getByPlaceholder(/nome/i).or(page.getByText(/nome completo|dados pessoais/i).first())
    ).toBeVisible({ timeout: 5000 });
  });

  test("cadastrar membro com celular e verificar na lista", async ({ page, request }) => {
    const uniqueName = `UITest ${Date.now()}`;
    const celular = "(21) 91234-5678";

    // Criar membro via API para garantir dados de teste
    const headers = await getAuthHeaders(request);
    await request.post("/api/members/", {
      headers,
      data: { name: uniqueName, cel: celular, cidade: "Niterói" },
    });

    // Recarregar a lista
    await page.reload();
    await page.waitForTimeout(1000);

    // Buscar pelo nome
    await page.getByPlaceholder(/buscar/i).fill(uniqueName);
    await page.waitForTimeout(500);

    // Verificar que celular aparece na tabela
    await expect(page.getByText(celular)).toBeVisible({ timeout: 5000 });
  });

  test("página de detalhe exibe campos de contato", async ({ page, request }) => {
    const uniqueName = `DetalheTest ${Date.now()}`;
    const celular = "(11) 98765-1234";
    const telefone = "(11) 3456-7890";
    const email = "detalhe@teste.com";

    // Criar membro via API
    const headers = await getAuthHeaders(request);
    const resp = await request.post("/api/members/", {
      headers,
      data: { name: uniqueName, cel: celular, tel: telefone, email: email, cidade: "São Paulo" },
    });
    const created = await resp.json();

    // Navegar para a página de detalhe
    await page.goto(`/membros/${created.id}`);
    await page.waitForTimeout(1000);

    // Verificar nome exibido
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 5000 });

    // Verificar card de contato rápido (celular)
    await expect(page.getByText(celular).first()).toBeVisible();

    // Verificar seção Contato com todos os campos
    await expect(page.getByText("Contato")).toBeVisible();
    await expect(page.getByText(telefone).first()).toBeVisible();
    await expect(page.getByText(email).first()).toBeVisible();
  });

  test("página de detalhe exibe tel quando cel está vazio", async ({ page, request }) => {
    const uniqueName = `TelFallback ${Date.now()}`;
    const telefone = "(21) 2222-3333";

    // Criar membro só com tel (sem cel)
    const headers = await getAuthHeaders(request);
    const resp = await request.post("/api/members/", {
      headers,
      data: { name: uniqueName, tel: telefone, cel: "" },
    });
    const created = await resp.json();

    // Navegar para o detalhe
    await page.goto(`/membros/${created.id}`);
    await page.waitForTimeout(1000);

    // Verificar que o telefone aparece no card de contato rápido (fallback)
    await expect(page.getByText(telefone).first()).toBeVisible({ timeout: 5000 });
  });

  test("lista exibe tel como fallback quando cel está vazio", async ({ page, request }) => {
    const uniqueName = `ListaFallback ${Date.now()}`;
    const telefone = "(31) 4444-5555";

    // Criar membro só com tel
    const headers = await getAuthHeaders(request);
    await request.post("/api/members/", {
      headers,
      data: { name: uniqueName, tel: telefone, cel: "" },
    });

    // Buscar pelo nome
    await page.reload();
    await page.getByPlaceholder(/buscar/i).fill(uniqueName);
    await page.waitForTimeout(500);

    // Verificar que o telefone aparece na coluna Celular (fallback)
    await expect(page.getByText(telefone)).toBeVisible({ timeout: 5000 });
  });
});
