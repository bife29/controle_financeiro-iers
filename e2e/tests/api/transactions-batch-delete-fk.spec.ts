import { test, expect } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Regressão (relato Jéssica, jun/2026):
 *
 *   "O botão de excluir em massa do financeiro não funciona, a lixeira
 *    individual sim."
 *
 * Causa raiz: o DELETE individual já havia recebido (mai/2026) o nullify
 * de `purchase_requests.transaction_id` antes do delete + flush, para evitar
 * a FK RESTRICT do Postgres derrubar a operação silenciosamente. O batch
 * (`/api/financial/transactions/batch`) NÃO tinha esse nullify — quando ao
 * menos uma das transações selecionadas estava vinculada a um PurchaseRequest
 * (cenário comum: tx criada via fluxo de Compras → Aprovar → Receber), o
 * Postgres falhava a transação e nenhuma linha era removida. SQLite local
 * mascarava (FK não enforce por padrão).
 *
 * Este teste reproduz o cenário: cria 2 tx avulsas + 1 tx vinculada a um
 * purchase_request (via /shopping/requests/{id}/receive), seleciona as 3 no
 * batch DELETE e exige que TODAS sumam.
 */
test.describe("Bulk delete /transactions/batch - FK regression", () => {
  test("apaga até quando há tx referenciada por purchase_request", async ({ request }) => {
    const headers = await getAuthHeaders(request);

    // Setup: projeto + categoria Saída
    const proj = await (
      await request.post(`${API_URL}/api/financial/projects`, {
        headers,
        data: { name: tag("Batch FK Proj"), start_date: "2027-01-01" },
      })
    ).json();
    const cat = await (
      await request.post(`${API_URL}/api/financial/categories`, {
        headers,
        data: { name: tag("Batch FK Cat"), type: "Saída", nature: "Variável" },
      })
    ).json();

    // 2 tx avulsas
    const tx1 = await (
      await request.post(`${API_URL}/api/financial/transactions`, {
        headers,
        data: {
          date: "2027-02-01",
          type: "Saída",
          value: 10,
          description: tag("Avulsa 1"),
          payment_method: "Dinheiro",
          project_id: proj.id,
          category_id: cat.id,
          status: "Confirmado",
        },
      })
    ).json();
    const tx2 = await (
      await request.post(`${API_URL}/api/financial/transactions`, {
        headers,
        data: {
          date: "2027-02-02",
          type: "Saída",
          value: 20,
          description: tag("Avulsa 2"),
          payment_method: "Dinheiro",
          project_id: proj.id,
          category_id: cat.id,
          status: "Confirmado",
        },
      })
    ).json();

    // 1 tx vinculada a PurchaseRequest (via approve → receive)
    const reqResp = await request.post(`${API_URL}/api/shopping/requests`, {
      headers,
      data: {
        title: tag("Pedido FK"),
        supplier: "X",
        project_id: proj.id,
        category_id: cat.id,
        items: [
          { description: tag("Item FK"), quantity: 1, unit: "un", estimated_price: 30 },
        ],
      },
    });
    expect(reqResp.ok()).toBeTruthy();
    const req = await reqResp.json();
    await request.post(`${API_URL}/api/shopping/requests/${req.id}/approve`, { headers, data: {} });
    const recv = await (
      await request.post(`${API_URL}/api/shopping/requests/${req.id}/receive`, {
        headers,
        data: {
          items: [{ id: req.items[0].id, final_price: 30 }],
          payment_method: "Dinheiro",
          status: "Confirmado",
        },
      })
    ).json();
    const txLinkedId: number = recv.transaction_id;
    expect(txLinkedId).toBeTruthy();

    const ids = [tx1.id, tx2.id, txLinkedId];

    // === Sanity: as 3 tx existem ===
    for (const id of ids) {
      const r = await request.get(`${API_URL}/api/financial/transactions/by-id/${id}`, { headers });
      expect(r.status(), `tx ${id} deve existir antes`).toBe(200);
    }

    // === Batch delete ===
    const del = await request.delete(`${API_URL}/api/financial/transactions/batch`, {
      headers,
      data: { ids },
    });
    expect(del.status(), await del.text()).toBe(200);
    const delJ = await del.json();
    expect(delJ.count).toBe(3);

    // === Verificar que TODAS sumiram (incluindo a referenciada) ===
    for (const id of ids) {
      const r = await request.get(`${API_URL}/api/financial/transactions/by-id/${id}`, { headers });
      expect(r.status(), `tx ${id} deveria ter sido excluída`).toBe(404);
    }

    // PurchaseRequest deve sobreviver com transaction_id = null
    const reqAfter = await (
      await request.get(`${API_URL}/api/shopping/requests/${req.id}`, { headers })
    ).json();
    expect(reqAfter.transaction_id).toBeNull();

    // cleanup
    await request.delete(`${API_URL}/api/shopping/requests/${req.id}`, { headers });
    await request.delete(`${API_URL}/api/financial/categories/${cat.id}`, { headers });
    await request.delete(`${API_URL}/api/financial/projects/${proj.id}`, { headers });
  });
});
