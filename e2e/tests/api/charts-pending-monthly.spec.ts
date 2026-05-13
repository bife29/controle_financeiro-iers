import { test, expect } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Regressão Ajuste 8 — totalizador mensal CP/CR.
 *
 * Endpoint /api/financial/charts/pending-monthly retorna, para cada mês
 * do horizonte solicitado, os totais de Previstos do tipo Entrada (CR)
 * e Saída (CP), com saldo previsto.
 */
test.describe("Charts pending-monthly (Ajuste 8)", () => {
  let projectId: number;
  let headers: Record<string, string>;
  const today = new Date();
  const ymd = (d: Date) => d.toISOString().slice(0, 10);

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
    const proj = await request.post(`${API_URL}/api/financial/projects`, {
      headers,
      data: { name: tag("Pending-Monthly Proj"), start_date: ymd(today) },
    });
    projectId = (await proj.json()).id;

    // Cria 1 entrada e 1 saída previstas no mês corrente
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 15);
    await request.post(`${API_URL}/api/financial/transactions`, {
      headers,
      data: {
        date: ymd(thisMonth),
        type: "Entrada",
        value: 200,
        description: tag("CR mes 0"),
        status: "Previsto",
        project_id: projectId,
      },
    });
    await request.post(`${API_URL}/api/financial/transactions`, {
      headers,
      data: {
        date: ymd(thisMonth),
        type: "Saída",
        value: 75,
        description: tag("CP mes 0"),
        status: "Previsto",
        project_id: projectId,
      },
    });
    // Cria 1 entrada prevista no próximo mês
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 10);
    await request.post(`${API_URL}/api/financial/transactions`, {
      headers,
      data: {
        date: ymd(nextMonth),
        type: "Entrada",
        value: 50,
        description: tag("CR mes 1"),
        status: "Previsto",
        project_id: projectId,
      },
    });
  });

  test("agrupa Previstos por mês e calcula CR, CP e saldo", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/financial/charts/pending-monthly`, {
      headers,
      params: { project_id: projectId, months: 3 },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(3);

    const m0 = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const m1 = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;

    const bucket0 = data.find((d: any) => d.month === m0);
    expect(bucket0).toBeTruthy();
    expect(bucket0.receivable).toBe(200);
    expect(bucket0.payable).toBe(75);
    expect(bucket0.balance).toBe(125);
    expect(bucket0.receivable_count).toBe(1);
    expect(bucket0.payable_count).toBe(1);

    const bucket1 = data.find((d: any) => d.month === m1);
    expect(bucket1).toBeTruthy();
    expect(bucket1.receivable).toBe(50);
    expect(bucket1.payable).toBe(0);
    expect(bucket1.balance).toBe(50);
  });

  test("retorna meses zerados quando não há previstos no horizonte", async ({ request }) => {
    // project_id de seed pode não ter previstos futuros; esperamos array
    // com months itens, mesmo zerado.
    const res = await request.get(`${API_URL}/api/financial/charts/pending-monthly`, {
      headers,
      params: { project_id: 99999, months: 4 },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveLength(4);
    for (const d of data) {
      expect(d.receivable).toBe(0);
      expect(d.payable).toBe(0);
      expect(d.balance).toBe(0);
    }
  });

  test("rejeita months fora de [1,24]", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/financial/charts/pending-monthly`, {
      headers,
      params: { months: 99 },
    });
    expect(res.status()).toBe(422);
  });
});
