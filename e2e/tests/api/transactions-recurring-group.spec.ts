import { test, expect } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Regressão Ajuste 10 — recorrência: editar/excluir 1 ou todas as futuras.
 *
 * Cobre:
 *  - PUT /api/financial/transactions/recurring/{group_id} sem from_date
 *    aplica patch a todas do grupo
 *  - PUT com from_date aplica patch só nas com date >= from_date
 *  - Campo `date` é ignorado no batch (cada uma mantém a sua)
 *  - DELETE /api/financial/transactions/recurring/{group_id}?from_date=
 *    remove só do escopo
 *  - 404 quando group_id não existe
 */
test.describe("Recurring group - PUT/DELETE em lote (Ajuste 10)", () => {
  let headers: Record<string, string>;
  let projectId: number;
  let groupId: string;
  let txIds: number[] = [];

  test.beforeEach(async ({ request }) => {
    headers = await getAuthHeaders(request);
    const proj = await request.post(`${API_URL}/api/financial/projects`, {
      headers,
      data: { name: tag("Rec Group Proj"), start_date: "2027-01-01" },
    });
    projectId = (await proj.json()).id;

    // Cria 4 transações recorrentes mensais a partir de 2027-01-15
    const r = await request.post(`${API_URL}/api/financial/transactions/recurring`, {
      headers,
      data: {
        date: "2027-01-15",
        type: "Saída",
        value: 100,
        description: tag("Aluguel recorrente"),
        payment_method: "Boleto",
        project_id: projectId,
        recurrence_count: 4,
      },
    });
    expect(r.ok()).toBeTruthy();
    const txs = await r.json();
    expect(txs).toHaveLength(4);
    txIds = txs.map((t: any) => t.id);
    groupId = txs[0].recurring_group_id;
    expect(groupId).toBeTruthy();
  });

  test("PUT sem from_date aplica patch a todas do grupo", async ({ request }) => {
    const res = await request.put(
      `${API_URL}/api/financial/transactions/recurring/${groupId}`,
      {
        headers,
        data: { value: 250, description: tag("Aluguel REAJUSTADO") },
      }
    );
    expect(res.ok()).toBeTruthy();
    const updated = await res.json();
    expect(updated).toHaveLength(4);
    for (const t of updated) {
      expect(t.value).toBe(250);
      expect(t.description).toContain("REAJUSTADO");
    }
  });

  test("PUT com from_date aplica patch só nas date >= from_date", async ({ request }) => {
    const res = await request.put(
      `${API_URL}/api/financial/transactions/recurring/${groupId}?from_date=2027-03-01`,
      {
        headers,
        data: { value: 333 },
      }
    );
    expect(res.ok()).toBeTruthy();
    const updated = await res.json();
    // 3a e 4a parcelas (mar e abr)
    expect(updated).toHaveLength(2);
    for (const t of updated) {
      expect(t.value).toBe(333);
      expect(new Date(t.date) >= new Date("2027-03-01")).toBe(true);
    }

    // Verifica que as anteriores continuam com o valor original
    const tx1 = await (
      await request.get(`${API_URL}/api/financial/transactions/by-id/${txIds[0]}`, { headers })
    ).json();
    expect(tx1.value).toBe(100);
  });

  test("PUT ignora campo date (datas individuais permanecem)", async ({ request }) => {
    const datesBefore = await Promise.all(
      txIds.map(async (id) => {
        const t = await (
          await request.get(`${API_URL}/api/financial/transactions/by-id/${id}`, { headers })
        ).json();
        return t.date;
      })
    );

    const res = await request.put(
      `${API_URL}/api/financial/transactions/recurring/${groupId}`,
      {
        headers,
        data: { date: "2099-01-01", value: 50 },
      }
    );
    expect(res.ok()).toBeTruthy();

    const datesAfter = await Promise.all(
      txIds.map(async (id) => {
        const t = await (
          await request.get(`${API_URL}/api/financial/transactions/by-id/${id}`, { headers })
        ).json();
        return t.date;
      })
    );
    expect(datesAfter).toEqual(datesBefore);
  });

  test("DELETE com from_date remove só do escopo", async ({ request }) => {
    const res = await request.delete(
      `${API_URL}/api/financial/transactions/recurring/${groupId}?from_date=2027-03-01`,
      { headers }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.deleted).toBe(2);

    // 1a e 2a continuam acessíveis, 3a e 4a viram 404
    const r1 = await request.get(`${API_URL}/api/financial/transactions/by-id/${txIds[0]}`, { headers });
    expect(r1.ok()).toBeTruthy();
    const r3 = await request.get(`${API_URL}/api/financial/transactions/by-id/${txIds[2]}`, { headers });
    expect(r3.status()).toBe(404);
  });

  test("PUT em group_id inexistente retorna 404", async ({ request }) => {
    const res = await request.put(
      `${API_URL}/api/financial/transactions/recurring/00000000-0000-0000-0000-000000000000`,
      { headers, data: { value: 1 } }
    );
    expect(res.status()).toBe(404);
  });
});
