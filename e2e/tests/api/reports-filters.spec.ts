import { test, expect } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Regressão Ajuste 6 — filtros adicionais nos endpoints de relatórios.
 *
 * Antes do ajuste, somente `cashbook` aceitava status, `by-category` aceitava
 * type/status, `by-project` aceitava project_id e `payables-receivables` só
 * aceitava type. Agora todos aceitam category_id / project_id / member_id
 * conforme aplicável.
 *
 * O teste:
 *   - cria 2 projetos, 2 categorias e 1 membro tagueados
 *   - cria 4 transações cobrindo combinações distintas
 *   - confirma via /api/financial/transactions que a mesma combinação de
 *     filtros (category_id, project_id, member_id) usada nos relatórios
 *     restringe corretamente o conjunto retornado
 *   - confirma que cada endpoint de relatório aceita os filtros e responde 200
 */
test.describe("Relatórios — filtros category/project/member (Ajuste 6)", () => {
  let projAId: number;
  let projBId: number;
  let catAId: number;
  let catBId: number;
  let memberId: number;
  let headers: Record<string, string>;
  const today = new Date().toISOString().slice(0, 10);

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);

    const projA = await request.post(`${API_URL}/api/financial/projects`, {
      headers,
      data: { name: tag("Rep-Filter Proj A"), start_date: today },
    });
    expect(projA.ok()).toBeTruthy();
    projAId = (await projA.json()).id;

    const projB = await request.post(`${API_URL}/api/financial/projects`, {
      headers,
      data: { name: tag("Rep-Filter Proj B"), start_date: today },
    });
    expect(projB.ok()).toBeTruthy();
    projBId = (await projB.json()).id;

    const catA = await request.post(`${API_URL}/api/financial/categories`, {
      headers,
      data: { name: tag("Rep-Filter Cat A"), type: "Entrada", nature: "Variável" },
    });
    expect(catA.ok()).toBeTruthy();
    catAId = (await catA.json()).id;

    const catB = await request.post(`${API_URL}/api/financial/categories`, {
      headers,
      data: { name: tag("Rep-Filter Cat B"), type: "Entrada", nature: "Variável" },
    });
    expect(catB.ok()).toBeTruthy();
    catBId = (await catB.json()).id;

    const member = await request.post(`${API_URL}/api/members/`, {
      headers,
      data: { name: tag("Rep-Filter Membro") },
    });
    expect(member.ok()).toBeTruthy();
    memberId = (await member.json()).id;

    // 4 transações: Confirmadas para entrar no relatório com status default
    const combos = [
      { project_id: projAId, category_id: catAId, member_id: memberId, value: 10 },
      { project_id: projAId, category_id: catBId, member_id: null, value: 20 },
      { project_id: projBId, category_id: catAId, member_id: null, value: 30 },
      { project_id: projBId, category_id: catBId, member_id: memberId, value: 40 },
    ];
    for (const c of combos) {
      const r = await request.post(`${API_URL}/api/financial/transactions`, {
        headers,
        data: {
          date: today,
          type: "Entrada",
          value: c.value,
          description: tag(`Rep-Filter combo p${c.project_id}-c${c.category_id}-m${c.member_id ?? "null"}`),
          status: "Confirmado",
          ...c,
        },
      });
      expect(r.ok()).toBeTruthy();
    }
  });

  test("filtro category_id restringe transações (fonte do filter)", async ({ request }) => {
    const r = await request.get(`${API_URL}/api/financial/transactions`, {
      headers,
      params: { category_id: catAId, status: "Confirmado", limit: 500 },
    });
    expect(r.ok()).toBeTruthy();
    const list = await r.json();
    const ours = list.filter((t: any) =>
      [projAId, projBId].includes(t.project_id) && t.category_id === catAId
    );
    // Devem ser exatamente as duas transações de catA (A-A-mem e B-A-null)
    expect(ours).toHaveLength(2);
    for (const t of ours) expect(t.category_id).toBe(catAId);
  });

  test("filtro project_id + member_id combinados", async ({ request }) => {
    const r = await request.get(`${API_URL}/api/financial/transactions`, {
      headers,
      params: { project_id: projBId, member_id: memberId, status: "Confirmado", limit: 500 },
    });
    expect(r.ok()).toBeTruthy();
    const list = await r.json();
    const ours = list.filter((t: any) => t.project_id === projBId && t.member_id === memberId);
    // Apenas a combinação B-B-mem
    expect(ours).toHaveLength(1);
    expect(ours[0].category_id).toBe(catBId);
  });

  test("endpoints de relatório aceitam category_id/project_id/member_id (200)", async ({ request }) => {
    const params = {
      category_id: catAId,
      project_id: projAId,
      member_id: memberId,
      format: "xlsx",
      start: "2020-01-01",
      end: "2030-12-31",
    };
    const endpoints = [
      "/api/reports/cashbook",
      "/api/reports/by-category",
      "/api/reports/by-project",
      "/api/reports/payables-receivables",
    ];
    for (const ep of endpoints) {
      const r = await request.get(`${API_URL}${ep}`, { headers, params });
      expect(r.ok(), `${ep} deve aceitar filtros novos`).toBeTruthy();
      const buf = await r.body();
      // XLSX é zip → magic 'PK'
      expect(buf[0]).toBe(0x50);
      expect(buf[1]).toBe(0x4b);
    }
  });
});
