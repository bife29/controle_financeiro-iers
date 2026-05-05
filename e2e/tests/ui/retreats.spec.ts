import { test, expect, Page } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";

async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("seu@email.com").fill(process.env.ADMIN_EMAIL || "admin@iers.org");
  await page.getByPlaceholder("••••••••").fill(process.env.ADMIN_PASSWORD || "admin123");
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible({ timeout: 10000 });
}

test.describe("Retiros - UI", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole("link", { name: "Retiros" }).click();
    await expect(page).toHaveURL(/retiros/, { timeout: 5000 });
  });

  test("página de retiros carrega corretamente", async ({ page }) => {
    await expect(page.getByText(/retiros/i).first()).toBeVisible({ timeout: 5000 });
    // Botão de novo retiro visível
    await expect(
      page.getByRole("link", { name: /novo/i }).or(page.getByRole("button", { name: /novo/i }))
    ).toBeVisible();
  });

  test("formulário de novo retiro abre e tem campos corretos", async ({ page }) => {
    await page.getByRole("link", { name: /novo/i }).click();
    await expect(page).toHaveURL(/retiros\/novo/, { timeout: 5000 });

    // Campos obrigatórios
    await expect(page.getByText(/nome do retiro/i)).toBeVisible();
    await expect(page.getByText(/data in/i)).toBeVisible();
    await expect(page.getByText(/data fim/i)).toBeVisible();

    // Campos de valores
    await expect(page.getByText(/adulto/i).first()).toBeVisible();
    await expect(page.getByText(/crian/i).first()).toBeVisible();
    await expect(page.getByText(/custo total/i)).toBeVisible();
  });

  test("cria retiro via formulário", async ({ page }) => {
    await page.getByRole("link", { name: /novo/i }).click();
    await expect(page).toHaveURL(/retiros\/novo/, { timeout: 5000 });

    const retiroName = `UI Retiro ${Date.now()}`;

    // Preencher formulário
    await page.getByRole('textbox', { name: /Retiro de Carnaval/i }).fill(retiroName);
    await page.locator('input[type="date"]').first().fill("2026-09-01");
    await page.locator('input[type="date"]').nth(1).fill("2026-09-03");

    // Salvar
    await page.getByRole("button", { name: /criar|salvar/i }).click();

    // Volta para a listagem
    await expect(page).toHaveURL(/\/retiros$/, { timeout: 10000 });
    // Novo retiro aparece
    await expect(page.getByText(retiroName)).toBeVisible({ timeout: 5000 });
  });

  test("abre detalhe do retiro com dashboard", async ({ page, request }) => {
    // Criar retiro via API para garantir dados
    const headers = await getAuthHeaders(request);
    const resp = await request.post("/api/retreats/", {
      headers,
      data: {
        name: `Dashboard UI ${Date.now()}`,
        start_date: "2026-10-01",
        end_date: "2026-10-03",
        cost_adult: 300,
        cost_child: 150,
        total_budget: 5000,
      },
    });
    const retreat = await resp.json();

    // Navegar para o detalhe
    await page.goto(`/retiros/${retreat.id}`);
    await page.waitForTimeout(1000);

    // Verifica KPIs do dashboard
    await expect(page.getByText(/participantes/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/arrecadado/i)).toBeVisible();
    await expect(page.getByText(/custo total/i)).toBeVisible();

    // Botões de ação
    await expect(page.getByRole("link", { name: /participantes/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /editar/i })).toBeVisible();
  });

  test("página de participantes exibe tabela e botão de inscrição", async ({ page, request }) => {
    const headers = await getAuthHeaders(request);
    const resp = await request.post("/api/retreats/", {
      headers,
      data: {
        name: `Participantes UI ${Date.now()}`,
        start_date: "2026-11-01",
        end_date: "2026-11-03",
        cost_adult: 500,
        cost_child: 250,
        total_budget: 8000,
      },
    });
    const retreat = await resp.json();

    await page.goto(`/retiros/${retreat.id}/participantes`);
    await page.waitForTimeout(1000);

    // Botão de inscrição
    await expect(
      page.getByRole("button", { name: /inscrever/i })
    ).toBeVisible({ timeout: 5000 });

    // Tabela de participantes (pode estar vazia)
    await expect(
      page.getByText(/participante|nenhum/i).first()
    ).toBeVisible();
  });

  test("modal de inscrição abre com opções membro/visitante", async ({ page, request }) => {
    const headers = await getAuthHeaders(request);
    const resp = await request.post("/api/retreats/", {
      headers,
      data: {
        name: `Modal UI ${Date.now()}`,
        start_date: "2026-12-01",
        end_date: "2026-12-03",
        cost_adult: 350,
        cost_child: 175,
        total_budget: 6000,
      },
    });
    const retreat = await resp.json();

    await page.goto(`/retiros/${retreat.id}/participantes`);
    await page.waitForTimeout(1000);

    // Abrir modal
    await page.getByRole("button", { name: /inscrever/i }).click();

    // Verifica opções do modal
    await expect(page.getByText(/membro da igreja/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/visitante|convidado/i)).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
    await expect(page.getByText(/parcela/i).first()).toBeVisible();
  });

  test("inscreve visitante e verifica na tabela", async ({ page, request }) => {
    const headers = await getAuthHeaders(request);
    const resp = await request.post("/api/retreats/", {
      headers,
      data: {
        name: `Inscrição UI ${Date.now()}`,
        start_date: "2027-01-01",
        end_date: "2027-01-03",
        cost_adult: 400,
        cost_child: 200,
        total_budget: 7000,
      },
    });
    const retreat = await resp.json();

    await page.goto(`/retiros/${retreat.id}/participantes`);
    await page.waitForTimeout(1000);

    // Abrir modal
    await page.getByRole("button", { name: /inscrever/i }).click();
    await page.waitForTimeout(500);

    // Selecionar Visitante
    await page.getByText(/visitante|convidado/i).click();

    // Preencher dados
    const visitorName = `Visitante UI ${Date.now()}`;
    await page.getByPlaceholder(/nome completo/i).fill(visitorName);
    await page.getByPlaceholder(/00000-0000/i).fill("(21) 99988-7766");

    // Confirmar inscrição
    await page.getByRole("button", { name: /inscrever$/i }).click();
    await page.waitForTimeout(1000);

    // Verifica que aparece na tabela
    await expect(page.getByText(visitorName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Visitante", { exact: true })).toBeVisible();
  });

  test("acessa carnê de pagamento do participante", async ({ page, request }) => {
    const headers = await getAuthHeaders(request);

    // Criar retiro + participante via API
    const retreatResp = await request.post("/api/retreats/", {
      headers,
      data: {
        name: `Carnê UI ${Date.now()}`,
        start_date: "2027-02-01",
        end_date: "2027-02-03",
        cost_adult: 600,
        cost_child: 300,
        total_budget: 12000,
      },
    });
    const retreat = await retreatResp.json();

    const partResp = await request.post(`/api/retreats/${retreat.id}/participants`, {
      headers,
      data: {
        retreat_id: retreat.id,
        name: "Testador Carnê",
        is_member: false,
        participant_type: "adulto",
        installments_count: 4,
      },
    });
    const participant = await partResp.json();

    // Navegar para o carnê
    await page.goto(`/retiros/${retreat.id}/participantes/${participant.id}/pagamentos`);
    await page.waitForTimeout(1000);

    // Verifica elementos do carnê
    await expect(page.getByText(/carnê de pagamento/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/parcela 1/i)).toBeVisible();
    await expect(page.getByText(/parcela 4/i)).toBeVisible();

    // Botão de pagar visível
    await expect(page.getByRole("button", { name: /pagar/i }).first()).toBeVisible();
  });
});
