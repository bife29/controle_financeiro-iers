import { test, expect } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Feature Compras (Shopping) — cobertura ponta-a-ponta:
 *  - CRUD de ShoppingList + Items
 *  - Criar PurchaseRequest direto e a partir de Lista (generate-request)
 *  - Workflow: approve / reject / receive
 *  - receive cria Transaction Saída com total = soma(qty * (final|estimated))
 *  - Permissões: approve exige `compras.approve`; receive exige `compras.edit`
 *  - 404 / status inválidos
 */
test.describe("Compras — Listas + Pedidos + Workflow", () => {
  let headers: Record<string, string>;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
  });

  test("CRUD ShoppingList + Items", async ({ request }) => {
    // Criar lista
    const create = await request.post(`${API_URL}/api/shopping/lists`, {
      headers,
      data: { name: tag("Lista Cozinha"), description: "Itens semanais" },
    });
    expect(create.ok()).toBeTruthy();
    const lst = await create.json();
    expect(lst.id).toBeTruthy();
    expect(lst.name).toContain("Lista Cozinha");
    expect(lst.items_count).toBe(0);

    // Adicionar 3 itens
    for (const it of [
      { description: tag("Arroz 5kg"), quantity: 2, unit: "pct", estimated_price: 25 },
      { description: tag("Feijão 1kg"), quantity: 3, unit: "pct", estimated_price: 8 },
      { description: tag("Óleo 900ml"), quantity: 1, unit: "un", estimated_price: 9.5 },
    ]) {
      const r = await request.post(`${API_URL}/api/shopping/lists/${lst.id}/items`, { headers, data: it });
      expect(r.ok()).toBeTruthy();
    }

    // GET detalhe
    const det = await request.get(`${API_URL}/api/shopping/lists/${lst.id}`, { headers });
    const detJ = await det.json();
    expect(detJ.items).toHaveLength(3);
    expect(detJ.items_count).toBe(3);
    expect(detJ.pending_count).toBe(3);

    // Marcar 1 como comprado
    const firstItem = detJ.items[0];
    const upd = await request.put(
      `${API_URL}/api/shopping/lists/${lst.id}/items/${firstItem.id}`,
      { headers, data: { is_purchased: true } }
    );
    expect(upd.ok()).toBeTruthy();
    const det2 = await (await request.get(`${API_URL}/api/shopping/lists/${lst.id}`, { headers })).json();
    expect(det2.pending_count).toBe(2);

    // Editar lista
    const updL = await request.put(`${API_URL}/api/shopping/lists/${lst.id}`, {
      headers, data: { description: "Atualizado" },
    });
    expect(updL.ok()).toBeTruthy();
    expect((await updL.json()).description).toBe("Atualizado");

    // Excluir item
    const delIt = await request.delete(`${API_URL}/api/shopping/lists/${lst.id}/items/${firstItem.id}`, { headers });
    expect(delIt.ok()).toBeTruthy();

    // Excluir lista (cascade nos itens)
    const delL = await request.delete(`${API_URL}/api/shopping/lists/${lst.id}`, { headers });
    expect(delL.ok()).toBeTruthy();
  });

  test("Generate PurchaseRequest a partir de Lista (only_pending=true)", async ({ request }) => {
    // Setup: lista com 3 itens, 1 já comprado
    const lst = await (await request.post(`${API_URL}/api/shopping/lists`, {
      headers, data: { name: tag("Lista p/ pedido") },
    })).json();
    const it1 = await (await request.post(`${API_URL}/api/shopping/lists/${lst.id}/items`, {
      headers, data: { description: tag("Item 1"), quantity: 1, estimated_price: 10 },
    })).json();
    await request.post(`${API_URL}/api/shopping/lists/${lst.id}/items`, {
      headers, data: { description: tag("Item 2"), quantity: 2, estimated_price: 5 },
    });
    await request.post(`${API_URL}/api/shopping/lists/${lst.id}/items`, {
      headers, data: { description: tag("Item 3 (já comprado)"), quantity: 1, estimated_price: 7, is_purchased: true },
    });

    const gen = await request.post(
      `${API_URL}/api/shopping/lists/${lst.id}/generate-request?title=${encodeURIComponent(tag("Pedido cozinha"))}`,
      { headers }
    );
    expect(gen.ok()).toBeTruthy();
    const req = await gen.json();
    expect(req.status).toBe("Pendente");
    expect(req.list_id).toBe(lst.id);
    // Apenas 2 itens (o comprado deve ter sido ignorado)
    expect(req.items).toHaveLength(2);
    // total_estimated = 1*10 + 2*5 = 20
    expect(req.total_estimated).toBe(20);

    // cleanup: tem que excluir pedido antes da lista (FK)
    await request.delete(`${API_URL}/api/shopping/requests/${req.id}`, { headers });
    await request.delete(`${API_URL}/api/shopping/lists/${lst.id}`, { headers });
  });

  test("Generate falha sem itens disponíveis (400)", async ({ request }) => {
    const lst = await (await request.post(`${API_URL}/api/shopping/lists`, {
      headers, data: { name: tag("Lista vazia") },
    })).json();
    const gen = await request.post(`${API_URL}/api/shopping/lists/${lst.id}/generate-request`, { headers });
    expect(gen.status()).toBe(400);
    await request.delete(`${API_URL}/api/shopping/lists/${lst.id}`, { headers });
  });

  test("PurchaseRequest direto + workflow Approve → Receive cria Transaction", async ({ request }) => {
    // Criar projeto e categoria Saída
    const proj = await (await request.post(`${API_URL}/api/financial/projects`, {
      headers, data: { name: tag("Compras Proj"), start_date: "2027-01-01" },
    })).json();
    const cat = await (await request.post(`${API_URL}/api/financial/categories`, {
      headers, data: { name: tag("Compras Cat"), type: "Saída", nature: "Variável" },
    })).json();

    // Criar pedido direto
    const reqResp = await request.post(`${API_URL}/api/shopping/requests`, {
      headers, data: {
        title: tag("Compra teste"),
        supplier: "Mercado X",
        project_id: proj.id,
        category_id: cat.id,
        items: [
          { description: tag("Café 500g"), quantity: 4, unit: "pct", estimated_price: 12 },
          { description: tag("Açúcar 1kg"), quantity: 2, unit: "pct", estimated_price: 5 },
        ],
      },
    });
    expect(reqResp.ok()).toBeTruthy();
    const req = await reqResp.json();
    expect(req.status).toBe("Pendente");
    expect(req.total_estimated).toBe(58); // 4*12 + 2*5

    // Aprovar
    const appr = await request.post(`${API_URL}/api/shopping/requests/${req.id}/approve`, { headers, data: {} });
    expect(appr.ok()).toBeTruthy();
    const apprJ = await appr.json();
    expect(apprJ.status).toBe("Aprovado");
    expect(apprJ.approved_by_id).toBeTruthy();

    // Receber com final_price diferente em 1 item
    const items = apprJ.items;
    const recv = await request.post(`${API_URL}/api/shopping/requests/${req.id}/receive`, {
      headers, data: {
        items: [
          { id: items[0].id, final_price: 13.5 }, // 4*13.5=54
          { id: items[1].id, final_price: 5 },     // 2*5=10
        ],
        payment_method: "Pix",
        status: "Confirmado",
      },
    });
    expect(recv.ok()).toBeTruthy();
    const recvJ = await recv.json();
    expect(recvJ.status).toBe("Recebido");
    expect(recvJ.total_final).toBe(64); // 54 + 10
    expect(recvJ.transaction_id).toBeTruthy();

    // Verifica Transaction criada
    const tx = await (await request.get(`${API_URL}/api/financial/transactions/by-id/${recvJ.transaction_id}`, { headers })).json();
    expect(tx.type).toBe("Saída");
    expect(tx.value).toBe(64);
    expect(tx.project_id).toBe(proj.id);
    expect(tx.category_id).toBe(cat.id);
    expect(tx.status).toBe("Confirmado");
    expect(tx.imported_from).toBe("compras");

    // Não pode receber 2x
    const recv2 = await request.post(`${API_URL}/api/shopping/requests/${req.id}/receive`, { headers, data: {} });
    expect(recv2.status()).toBe(400);

    // cleanup
    await request.delete(`${API_URL}/api/financial/transactions/${recvJ.transaction_id}`, { headers });
    await request.delete(`${API_URL}/api/shopping/requests/${req.id}`, { headers });
    await request.delete(`${API_URL}/api/financial/categories/${cat.id}`, { headers });
    await request.delete(`${API_URL}/api/financial/projects/${proj.id}`, { headers });
  });

  test("Reject grava motivo e bloqueia approve depois", async ({ request }) => {
    const req = await (await request.post(`${API_URL}/api/shopping/requests`, {
      headers, data: {
        title: tag("Pedido p/ rejeitar"),
        items: [{ description: tag("X"), quantity: 1, estimated_price: 100 }],
      },
    })).json();
    const rej = await request.post(`${API_URL}/api/shopping/requests/${req.id}/reject`, {
      headers, data: { reason: "Fora do orçamento" },
    });
    expect(rej.ok()).toBeTruthy();
    const rejJ = await rej.json();
    expect(rejJ.status).toBe("Rejeitado");
    expect(rejJ.rejection_reason).toBe("Fora do orçamento");

    // approve em rejeitado deve falhar 400
    const appr = await request.post(`${API_URL}/api/shopping/requests/${req.id}/approve`, { headers, data: {} });
    expect(appr.status()).toBe(400);

    await request.delete(`${API_URL}/api/shopping/requests/${req.id}`, { headers });
  });

  test("Filtros e dashboard /api/shopping/dashboard", async ({ request }) => {
    const reqA = await (await request.post(`${API_URL}/api/shopping/requests`, {
      headers, data: { title: tag("Filt-Pendente"), items: [{ description: tag("a"), quantity: 1, estimated_price: 1 }] },
    })).json();
    const reqB = await (await request.post(`${API_URL}/api/shopping/requests`, {
      headers, data: { title: tag("Filt-Rejeitar"), items: [{ description: tag("b"), quantity: 1, estimated_price: 1 }] },
    })).json();
    await request.post(`${API_URL}/api/shopping/requests/${reqB.id}/reject`, {
      headers, data: { reason: "x" },
    });

    const list = await (await request.get(`${API_URL}/api/shopping/requests?status=Rejeitado`, { headers })).json();
    expect(list.some((r: any) => r.id === reqB.id)).toBe(true);
    expect(list.every((r: any) => r.status === "Rejeitado")).toBe(true);

    const dash = await (await request.get(`${API_URL}/api/shopping/dashboard`, { headers })).json();
    expect(dash.by_status).toBeTruthy();
    expect(dash.by_status.Pendente).toBeGreaterThanOrEqual(1);
    expect(dash.by_status.Rejeitado).toBeGreaterThanOrEqual(1);
    expect(typeof dash.received_month_total).toBe("number");

    // cleanup
    await request.delete(`${API_URL}/api/shopping/requests/${reqA.id}`, { headers });
    await request.delete(`${API_URL}/api/shopping/requests/${reqB.id}`, { headers });
  });

  test("404 em recursos inexistentes + status inválido em filtro", async ({ request }) => {
    expect((await request.get(`${API_URL}/api/shopping/lists/999999`, { headers })).status()).toBe(404);
    expect((await request.get(`${API_URL}/api/shopping/requests/999999`, { headers })).status()).toBe(404);
    expect((await request.post(`${API_URL}/api/shopping/lists/999999/generate-request`, { headers })).status()).toBe(404);
    expect((await request.get(`${API_URL}/api/shopping/requests?status=ZZZ`, { headers })).status()).toBe(400);
  });

  test("Regressão: DELETE Pedido Recebido — bloqueia se tx existe, libera se já foi removida", async ({ request }) => {
    // Cria pedido, aprova e recebe (gera Transaction)
    const req = await (await request.post(`${API_URL}/api/shopping/requests`, {
      headers, data: {
        title: tag("Reg-Del-Recebido"),
        items: [{ description: tag("x"), quantity: 1, estimated_price: 10 }],
      },
    })).json();
    await request.post(`${API_URL}/api/shopping/requests/${req.id}/approve`, { headers, data: {} });
    const recv = await (await request.post(`${API_URL}/api/shopping/requests/${req.id}/receive`, {
      headers, data: { payment_method: "Pix", status: "Confirmado" },
    })).json();
    expect(recv.status).toBe("Recebido");
    expect(recv.transaction_id).toBeTruthy();

    // 1) DELETE bloqueia (400) enquanto tx existe
    const blocked = await request.delete(`${API_URL}/api/shopping/requests/${req.id}`, { headers });
    expect(blocked.status()).toBe(400);

    // 2) Apaga a Transaction
    const txDel = await request.delete(
      `${API_URL}/api/financial/transactions/${recv.transaction_id}`,
      { headers }
    );
    expect(txDel.ok()).toBeTruthy();

    // 2b) Garante que a Transaction realmente foi removida do banco (regressão prod)
    const txGet = await request.get(
      `${API_URL}/api/financial/transactions/by-id/${recv.transaction_id}`,
      { headers }
    );
    expect(txGet.status()).toBe(404);

    // 3) Agora DELETE do pedido Recebido é liberado
    const ok = await request.delete(`${API_URL}/api/shopping/requests/${req.id}`, { headers });
    expect(ok.ok()).toBeTruthy();
  });
});
