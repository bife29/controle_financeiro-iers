import { test, expect, Page } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Regressão (relato Jéssica, mai/2026):
 *
 * "O botão de excluir em massa do financeiro não funciona, a lixeira
 *  individual sim."
 *
 * Cobre fluxo UI completo: cria N transações, abre lista, seleciona-as,
 * clica em "Excluir (N)", confirma no modal, e verifica que sumiram
 * (re-fetch da listagem).
 */

async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("seu@email.com").fill(process.env.ADMIN_EMAIL || "admin@iers.org");
  await page.getByPlaceholder("••••••••").fill(process.env.ADMIN_PASSWORD || "admin123");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 10000 });
}

test.describe("Excluir em massa transações - UI", () => {
  const createdIds: number[] = [];
  const BULK_TAG = tag(`Bulk delete ${Date.now()}`);

  test.beforeAll(async ({ request }) => {
    const headers = await getAuthHeaders(request);
    const projectsResp = await request.get(`${API_URL}/api/financial/projects`, { headers });
    const projects = await projectsResp.json();
    expect(projects.length).toBeGreaterThan(0);
    const projectId = projects[0].id;

    for (let i = 0; i < 3; i++) {
      const r = await request.post(`${API_URL}/api/financial/transactions`, {
        headers,
        data: {
          date: new Date().toISOString().slice(0, 10),
          type: "Entrada",
          value: 1 + i,
          description: `${BULK_TAG} #${i + 1}`,
          payment_method: "Dinheiro",
          project_id: projectId,
          status: "Confirmado",
        },
      });
      expect(r.status(), await r.text()).toBe(200);
      const tx = await r.json();
      createdIds.push(tx.id);
    }
  });

  test.afterAll(async ({ request }) => {
    const headers = await getAuthHeaders(request);
    for (const id of createdIds) {
      await request.delete(`${API_URL}/api/financial/transactions/${id}`, { headers }).catch(() => undefined);
    }
  });

  test("seleciona múltiplas + Excluir em massa + remove todas", async ({ page }) => {
    await loginAsAdmin(page);
    // Filtramos por Entrada + Confirmado + page_size=200 para garantir que as
    // 3 transações criadas (todas Entrada/Confirmado) caibam na primeira página
    // mesmo com DB local cheio de lançamentos Previstos futuros de outros testes.
    await page.goto("/financeiro/transacoes?type=Entrada&status=Confirmado&page_size=200");

    // Garante que a lista carregou com nossas 3 transações (por linha via testid)
    for (const id of createdIds) {
      await expect(page.getByTestId(`tx-row-${id}`)).toBeVisible({ timeout: 10000 });
    }

    // Seleciona cada uma via botão de seleção (a UI usa botão com ícone, não <input>)
    for (const id of createdIds) {
      await page.getByTestId(`tx-select-${id}`).click();
    }

    // Botão de excluir em massa deve aparecer com a contagem
    const bulkBtn = page.getByTestId("bulk-delete-btn");
    await expect(bulkBtn).toBeVisible();
    await expect(bulkBtn).toContainText(new RegExp(`Excluir \\(${createdIds.length}\\)`));
    await bulkBtn.click();

    // Modal de confirmação
    await expect(page.getByText("Exclusão em Massa")).toBeVisible();

    // Capturar resposta da rota /batch
    const respPromise = page.waitForResponse(
      (r) => r.url().includes("/api/financial/transactions/batch") && r.request().method() === "DELETE",
      { timeout: 10000 },
    );

    // Confirma exclusão (botão "Excluir N" dentro do modal)
    await page
      .locator('div.fixed:has-text("Exclusão em Massa")')
      .getByRole("button", { name: new RegExp(`Excluir ${createdIds.length}`) })
      .click();

    const resp = await respPromise;
    expect(resp.status(), await resp.text()).toBe(200);

    // Modal fecha e as linhas somem
    await expect(page.getByText("Exclusão em Massa")).toBeHidden({ timeout: 5000 });

    for (const id of createdIds) {
      await expect(page.getByTestId(`tx-row-${id}`)).toHaveCount(0, { timeout: 5000 });
    }

    // Limpa do array (já foram excluídas)
    createdIds.length = 0;
  });
});
