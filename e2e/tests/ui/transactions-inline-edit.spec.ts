import { test, expect, Page } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Regressão Ajuste 5 — coluna Categoria + edição inline.
 *
 * Garante que os <select> inline na lista de transações disparam
 * PUT /api/financial/transactions/{id} com o campo correto e que o
 * valor escolhido é persistido (categoria, projeto e membro).
 */
async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page
    .getByPlaceholder("seu@email.com")
    .fill(process.env.ADMIN_EMAIL || "admin@iers.org");
  await page
    .getByPlaceholder("••••••••")
    .fill(process.env.ADMIN_PASSWORD || "admin123");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"), {
    timeout: 10000,
  });
}

test.describe("Transações - edição inline (Ajuste 5)", () => {
  let txId: number | null = null;
  let projectAId: number | null = null;
  let projectBId: number | null = null;
  let categoryId: number | null = null;
  let memberId: number | null = null;

  test.beforeAll(async ({ request }) => {
    const headers = await getAuthHeaders(request);

    const today = new Date().toISOString().slice(0, 10);

    // Projeto A (origem)
    const projAResp = await request.post(`${API_URL}/api/financial/projects`, {
      headers,
      data: { name: tag("Proj A inline"), start_date: today },
    });
    expect(projAResp.ok()).toBeTruthy();
    projectAId = (await projAResp.json()).id;

    // Projeto B (destino do swap)
    const projBResp = await request.post(`${API_URL}/api/financial/projects`, {
      headers,
      data: { name: tag("Proj B inline"), start_date: today },
    });
    expect(projBResp.ok()).toBeTruthy();
    projectBId = (await projBResp.json()).id;

    // Categoria de Entrada (categoria filtra por t.type)
    const catResp = await request.post(
      `${API_URL}/api/financial/categories`,
      {
        headers,
        data: { name: tag("Cat Inline"), type: "Entrada", nature: "Variável" },
      }
    );
    expect(catResp.ok()).toBeTruthy();
    categoryId = (await catResp.json()).id;

    // Membro
    const memberResp = await request.post(`${API_URL}/api/members/`, {
      headers,
      data: { name: tag("Membro Inline") },
    });
    expect(memberResp.ok()).toBeTruthy();
    memberId = (await memberResp.json()).id;

    // Transação ligada ao Projeto A, sem categoria nem membro
    const txResp = await request.post(
      `${API_URL}/api/financial/transactions`,
      {
        headers,
        data: {
          date: new Date().toISOString().slice(0, 10),
          type: "Entrada",
          value: 123.45,
          description: tag("Tx inline edit"),
          status: "Confirmado",
          project_id: projectAId,
        },
      }
    );
    expect(txResp.ok()).toBeTruthy();
    txId = (await txResp.json()).id;
  });

  test("edita projeto, categoria e membro via selects inline", async ({
    page,
    request,
  }) => {
    expect(txId).not.toBeNull();
    expect(projectBId).not.toBeNull();
    expect(categoryId).not.toBeNull();
    expect(memberId).not.toBeNull();

    await loginAsAdmin(page);
    await page.goto(`/financeiro/transacoes?project_id=${projectAId}`);

    // Os <select> inline usam aria-label "Categoria/Projeto/Membro da transação {id}"
    const catSelect = page.getByLabel(`Categoria da transação ${txId}`);
    const projSelect = page.getByLabel(`Projeto da transação ${txId}`);
    const memberSelect = page.getByLabel(`Membro da transação ${txId}`);

    await expect(catSelect).toBeVisible();
    await expect(projSelect).toBeVisible();
    await expect(memberSelect).toBeVisible();

    // Edição 1: categoria
    await catSelect.selectOption(String(categoryId));
    // Edição 2: membro
    await memberSelect.selectOption(String(memberId));
    // Edição 3: projeto (último, para garantir que o swap não esconde a linha
    // antes das outras edições serem salvas)
    await projSelect.selectOption(String(projectBId));

    // Pequena espera p/ as três PUTs concluírem (mutation invalida query)
    await page.waitForTimeout(800);

    // Validação via API: estado final persistido
    const headers = await getAuthHeaders(request);
    const txResp = await request.get(
      `${API_URL}/api/financial/transactions/by-id/${txId}`,
      { headers }
    );
    expect(txResp.ok()).toBeTruthy();
    const tx = await txResp.json();
    expect(tx.category_id).toBe(categoryId);
    expect(tx.member_id).toBe(memberId);
    expect(tx.project_id).toBe(projectBId);
  });
});
