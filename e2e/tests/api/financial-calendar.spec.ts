import { test, expect } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Endpoint usado pelo Calendário Financeiro:
 *  GET /api/financial/transactions com start_date, end_date e status (Previsto).
 * Garante que o filtro por intervalo e status funciona corretamente.
 */
test.describe("Financial Calendar — backend filter", () => {
  let headers: Record<string, string>;
  let categoryId: number;
  let projectId: number;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
    const cats = await (
      await request.get(`${API_URL}/api/financial/categories`, { headers })
    ).json();
    categoryId = cats.find((c: any) => c.type === "Saída").id;
    const projs = await (
      await request.get(`${API_URL}/api/financial/projects`, { headers })
    ).json();
    projectId = projs[0].id;
  });

  test("filtra Previsto por intervalo start_date/end_date", async ({ request }) => {
    // cria 3 transações: dentro, antes e depois do intervalo
    const inside = "2027-03-15";
    const before = "2027-02-01";
    const after = "2027-04-30";

    for (const [date, label] of [
      [inside, "calendar inside"],
      [before, "calendar before"],
      [after, "calendar after"],
    ] as const) {
      const r = await request.post(`${API_URL}/api/financial/transactions`, {
        headers,
        data: {
          date,
          type: "Saída",
          value: 50,
          description: tag(label),
          category_id: categoryId,
          project_id: projectId,
          status: "Previsto",
        },
      });
      expect(r.ok()).toBeTruthy();
    }

    // Busca apenas o intervalo de março/2027
    const resp = await request.get(
      `${API_URL}/api/financial/transactions?start_date=2027-03-01&end_date=2027-03-31&status=Previsto&limit=500`,
      { headers }
    );
    expect(resp.ok()).toBeTruthy();
    const items = await resp.json();

    const insideHit = items.find(
      (t: any) => t.description === tag("calendar inside")
    );
    const beforeHit = items.find(
      (t: any) => t.description === tag("calendar before")
    );
    const afterHit = items.find(
      (t: any) => t.description === tag("calendar after")
    );
    expect(insideHit).toBeTruthy();
    expect(beforeHit).toBeFalsy();
    expect(afterHit).toBeFalsy();
    // Todos devem ter status Previsto
    for (const t of items) {
      expect(t.status).toBe("Previsto");
    }
  });

  test("expõe X-Total-Count para paginação", async ({ request }) => {
    const resp = await request.get(
      `${API_URL}/api/financial/transactions?start_date=2027-03-01&end_date=2027-03-31&limit=10`,
      { headers }
    );
    expect(resp.ok()).toBeTruthy();
    const total = resp.headers()["x-total-count"];
    expect(total).toBeDefined();
    expect(Number(total)).toBeGreaterThanOrEqual(0);
  });
});
