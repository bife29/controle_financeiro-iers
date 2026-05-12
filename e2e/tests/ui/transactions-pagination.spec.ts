import { test, expect, Page } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Regressão Bug 4 (paginação UI): a tela de transações limitava a 100 itens
 * (default do backend) e não tinha controles Próximo/Anterior. Tudo após a
 * 100ª transação ficava inacessível para edição.
 */
async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("seu@email.com").fill(process.env.ADMIN_EMAIL || "admin@iers.org");
  await page.getByPlaceholder("••••••••").fill(process.env.ADMIN_PASSWORD || "admin123");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 15000 });
}

test.describe("Transações - paginação UI", () => {
  const created: number[] = [];
  let projectId: number | null = null;

  test.beforeAll(async ({ request }) => {
    const headers = await getAuthHeaders(request);

    // Projeto isolado para que o filtro deixe a contagem determinística
    const projResp = await request.post(`${API_URL}/api/financial/projects`, {
      headers,
      data: {
        name: tag(`Pag UI ${Date.now()}`),
        description: tag("Pag UI"),
        start_date: "2026-01-01",
      },
    });
    const proj = await projResp.json();
    projectId = proj.id;

    const cats = await (await request.get(`${API_URL}/api/financial/categories`, { headers })).json();
    const entradaCat = cats.find((c: any) => c.type === "Entrada");

    // Cria 60 transações tagged
    for (let i = 0; i < 60; i++) {
      const r = await request.post(`${API_URL}/api/financial/transactions`, {
        headers,
        data: {
          date: "2026-04-15",
          description: tag(`Pag UI ${i.toString().padStart(2, "0")}`),
          value: 1 + i,
          type: "Entrada",
          category_id: entradaCat.id,
          project_id: proj.id,
          status: "Confirmado",
          payment_date: "2026-04-15",
        },
      });
      const tx = await r.json();
      created.push(tx.id);
    }
  });

  test.afterAll(async ({ request }) => {
    const headers = await getAuthHeaders(request);
    for (const id of created) {
      await request.delete(`${API_URL}/api/financial/transactions/${id}`, { headers }).catch(() => undefined);
    }
    if (projectId) {
      await request.delete(`${API_URL}/api/financial/projects/${projectId}`, { headers }).catch(() => undefined);
    }
  });

  test("mostra controles de página, navega e respeita pageSize", async ({ page }) => {
    await loginAsAdmin(page);

    // Vai direto para a lista filtrada pelo projeto isolado
    await page.goto(`/financeiro/transacoes?project_id=${projectId}&page_size=25`);

    const pagination = page.getByTestId("transactions-pagination");
    await expect(pagination).toBeVisible({ timeout: 10000 });

    // Total de itens visível no cabeçalho
    await expect(page.getByText(/60 lan[çc]amentos/)).toBeVisible();

    // Página 1 de 3
    await expect(page.getByTestId("pagination-info")).toHaveText(/Página 1 de 3/);

    // Próxima → Página 2
    await page.getByTestId("pagination-next").click();
    await expect(page.getByTestId("pagination-info")).toHaveText(/Página 2 de 3/);

    // Próxima → Página 3 (botão Próxima fica desabilitado)
    await page.getByTestId("pagination-next").click();
    await expect(page.getByTestId("pagination-info")).toHaveText(/Página 3 de 3/);
    await expect(page.getByTestId("pagination-next")).toBeDisabled();

    // Anterior volta para 2
    await page.getByTestId("pagination-prev").click();
    await expect(page.getByTestId("pagination-info")).toHaveText(/Página 2 de 3/);
  });
});
