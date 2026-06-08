import { test, expect } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Filtro "Vencendo em breve" + badge de urgência em Transações Previstas.
 * Seed via API para deixar o teste rápido e determinístico.
 */
test.describe("Transações — alerta de vencimento próximo (UI)", () => {
  let headers: Record<string, string>;
  let createdId: number;
  let createdDesc: string;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
    const cats = await (
      await request.get(`${API_URL}/api/financial/categories`, { headers })
    ).json();
    const cat = cats.find((c: any) => c.type === "Saída");
    const projs = await (
      await request.get(`${API_URL}/api/financial/projects`, { headers })
    ).json();

    createdDesc = tag(`Conta vencendo ${Date.now()}`);
    // Vence em 2 dias — escolhido para (a) entrar na janela due_soon (<=7d)
    // e (b) ficar no topo da lista paginada (ordenada por date DESC).
    const d = new Date();
    d.setDate(d.getDate() + 2);
    const dueDate = d.toISOString().split("T")[0];
    const resp = await request.post(`${API_URL}/api/financial/transactions`, {
      headers,
      data: {
        date: dueDate,
        type: "Saída",
        value: 99.9,
        description: createdDesc,
        category_id: cat.id,
        project_id: projs[0].id,
        status: "Previsto",
      },
    });
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    createdId = body.id;
  });

  test("badge de vencimento aparece e filtro due_soon aplica via URL", async ({ page }) => {
    // Login pela UI
    await page.goto("/");
    await page
      .getByPlaceholder("seu@email.com")
      .fill(process.env.ADMIN_EMAIL || "admin@iers.org");
    await page
      .getByPlaceholder("••••••••")
      .fill(process.env.ADMIN_PASSWORD || "admin123");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible({
      timeout: 15000,
    });

    // Navega direto para transações com filtro de vencimento próximo
    // + status=Previsto + page_size=500 para garantir que nossa transação
    // recém-criada esteja na página carregada (filtro due_soon é client-side).
    await page.goto(
      "/financeiro/transacoes?due_soon=1&status=Previsto&page_size=500"
    );

    // O botão de filtro deve estar visível
    await expect(page.getByTestId("filter-due-soon")).toBeVisible();

    // O badge da transação criada deve aparecer
    const badge = page.getByTestId(`due-badge-${createdId}`);
    await expect(badge).toBeVisible({ timeout: 15000 });
    // due_date = hoje+2 → badge "Vence em 2d"
    await expect(badge).toContainText(/Vence em \d+d/);
  });
});
