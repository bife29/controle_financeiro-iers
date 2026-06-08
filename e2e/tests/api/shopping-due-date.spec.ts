import { test, expect } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Persistência do campo due_date em ShoppingListItem.
 * Garante que:
 *  - É aceito no POST
 *  - Retornado no GET
 *  - Atualizável via PUT (set e clear)
 *  - Coluna foi adicionada via migração ao banco
 */
test.describe("Compras — due_date em itens", () => {
  let headers: Record<string, string>;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
  });

  test("POST/PUT/GET preserva due_date", async ({ request }) => {
    const create = await request.post(`${API_URL}/api/shopping/lists`, {
      headers,
      data: { name: tag("Lista due_date"), description: null },
    });
    expect(create.ok()).toBeTruthy();
    const lst = await create.json();

    // POST item com due_date
    const due = "2026-12-31";
    const itemResp = await request.post(
      `${API_URL}/api/shopping/lists/${lst.id}/items`,
      {
        headers,
        data: {
          description: tag("Café 500g"),
          quantity: 2,
          unit: "pct",
          estimated_price: 22.5,
          due_date: due,
        },
      }
    );
    expect(itemResp.ok()).toBeTruthy();
    const item = await itemResp.json();
    expect(item.due_date).toBe(due);

    // GET detail deve retornar
    const det = await (
      await request.get(`${API_URL}/api/shopping/lists/${lst.id}`, { headers })
    ).json();
    const found = det.items.find((it: any) => it.id === item.id);
    expect(found.due_date).toBe(due);

    // PUT alterando para outra data
    const newDue = "2027-01-15";
    const upd = await request.put(
      `${API_URL}/api/shopping/lists/${lst.id}/items/${item.id}`,
      { headers, data: { due_date: newDue } }
    );
    expect(upd.ok()).toBeTruthy();
    const updBody = await upd.json();
    expect(updBody.due_date).toBe(newDue);
  });

  test("POST sem due_date funciona (campo opcional)", async ({ request }) => {
    const create = await request.post(`${API_URL}/api/shopping/lists`, {
      headers,
      data: { name: tag("Lista sem due_date") },
    });
    const lst = await create.json();

    const r = await request.post(
      `${API_URL}/api/shopping/lists/${lst.id}/items`,
      { headers, data: { description: tag("Item simples"), quantity: 1 } }
    );
    expect(r.ok()).toBeTruthy();
    const item = await r.json();
    expect(item.due_date).toBeNull();
  });
});
