import { test, expect } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

test.describe("Módulo Financeiro - Categorias", () => {
  let headers: Record<string, string>;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
  });

  test("GET /api/financial/categories lista categorias", async ({ request }) => {
    const response = await request.get("/api/financial/categories", { headers });

    expect(response.ok()).toBeTruthy();

    const categories = await response.json();
    expect(Array.isArray(categories)).toBeTruthy();
    expect(categories.length).toBeGreaterThan(0);

    // Verifica estrutura
    const cat = categories[0];
    expect(cat).toHaveProperty("id");
    expect(cat).toHaveProperty("name");
    expect(cat).toHaveProperty("type");
    expect(cat).toHaveProperty("nature");
  });

  test("GET /api/financial/categories sem auth retorna 401", async ({ request }) => {
    const response = await request.get("/api/financial/categories");
    expect(response.status()).toBe(401);
  });
});

test.describe("Módulo Financeiro - Projetos", () => {
  let headers: Record<string, string>;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
  });

  test("GET /api/financial/projects lista projetos", async ({ request }) => {
    const response = await request.get("/api/financial/projects", { headers });

    expect(response.ok()).toBeTruthy();

    const projects = await response.json();
    expect(Array.isArray(projects)).toBeTruthy();
    expect(projects.length).toBeGreaterThan(0);

    const project = projects[0];
    expect(project).toHaveProperty("id");
    expect(project).toHaveProperty("name");
    expect(project).toHaveProperty("status");
  });

  test("POST /api/financial/projects cria projeto", async ({ request }) => {
    const newProject = {
      name: tag(`Projeto Teste ${Date.now()}`),
      description: tag("Criado por teste E2E"),
      start_date: "2026-01-01",
    };

    const response = await request.post("/api/financial/projects", {
      headers,
      data: newProject,
    });

    expect(response.ok()).toBeTruthy();

    const created = await response.json();
    expect(created.name).toBe(newProject.name);
    expect(created.description).toBe(newProject.description);
    expect(created.id).toBeDefined();
  });
});

test.describe("Módulo Financeiro - Transações", () => {
  let headers: Record<string, string>;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
  });

  test("GET /api/financial/transactions lista transações", async ({ request }) => {
    const response = await request.get("/api/financial/transactions", { headers });

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test("POST /api/financial/transactions cria transação de entrada", async ({ request }) => {
    // Busca categoria e projeto para criar transação
    const catsResp = await request.get("/api/financial/categories", { headers });
    const categories = await catsResp.json();
    const entradaCat = categories.find((c: any) => c.type === "Entrada");

    const projsResp = await request.get("/api/financial/projects", { headers });
    const projects = await projsResp.json();

    const transaction = {
      date: new Date().toISOString().split("T")[0],
      description: tag(`Entrada ${Date.now()}`),
      value: 150.0,
      type: "Entrada",
      category_id: entradaCat.id,
      project_id: projects[0].id,
    };

    const response = await request.post("/api/financial/transactions", {
      headers,
      data: transaction,
    });

    expect(response.ok()).toBeTruthy();

    const created = await response.json();
    expect(Number(created.value)).toBe(150.0);
    expect(created.type).toBe("Entrada");
    expect(created.id).toBeDefined();
  });

  // Regressão Bug 1: DELETE /api/financial/transactions/batch retornava 422
  // porque a rota /{transaction_id} estava declarada antes de /batch e o
  // FastAPI capturava "batch" como id.
  test("DELETE /api/financial/transactions/batch exclui múltiplas transações", async ({ request }) => {
    const catsResp = await request.get("/api/financial/categories", { headers });
    const entradaCat = (await catsResp.json()).find((c: any) => c.type === "Entrada");
    const projsResp = await request.get("/api/financial/projects", { headers });
    const projectId = (await projsResp.json())[0].id;

    // Cria 3 transações descartáveis
    const ids: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await request.post("/api/financial/transactions", {
        headers,
        data: {
          date: new Date().toISOString().split("T")[0],
          description: tag(`Batch delete ${Date.now()}-${i}`),
          value: 1.0,
          type: "Entrada",
          category_id: entradaCat.id,
          project_id: projectId,
        },
      });
      const tx = await r.json();
      ids.push(tx.id);
    }

    const delResp = await request.delete("/api/financial/transactions/batch", {
      headers,
      data: { ids },
    });

    expect(delResp.status()).toBe(200);
    const body = await delResp.json();
    expect(body.count).toBe(3);

    // Confirma que foram realmente excluídas
    const after = await request.get("/api/financial/transactions", { headers });
    const remaining = await after.json();
    for (const id of ids) {
      expect(remaining.find((t: any) => t.id === id)).toBeUndefined();
    }
  });

  test("DELETE /api/financial/transactions/batch com lista vazia retorna 400", async ({ request }) => {
    const resp = await request.delete("/api/financial/transactions/batch", {
      headers,
      data: { ids: [] },
    });
    expect(resp.status()).toBe(400);
  });

  // Regressão Bug 3: PUT precisa funcionar e o backend deve aceitar
  // project_id null sem 500 (tela branca no frontend).
  test("PUT /api/financial/transactions/{id} edita transação com project_id null", async ({ request }) => {
    const catsResp = await request.get("/api/financial/categories", { headers });
    const entradaCat = (await catsResp.json()).find((c: any) => c.type === "Entrada");
    const projsResp = await request.get("/api/financial/projects", { headers });
    const projectId = (await projsResp.json())[0].id;

    const create = await request.post("/api/financial/transactions", {
      headers,
      data: {
        date: "2026-04-01",
        description: tag(`Edit ${Date.now()}`),
        value: 99.99,
        type: "Entrada",
        category_id: entradaCat.id,
        project_id: projectId,
        status: "Previsto",
      },
    });
    expect(create.ok()).toBeTruthy();
    const tx = await create.json();

    const upd = await request.put(`/api/financial/transactions/${tx.id}`, {
      headers,
      data: {
        description: tag("Editada via"),
        value: 123.45,
        status: "Confirmado",
        project_id: null,
      },
    });
    expect(upd.status()).toBe(200);
    const updated = await upd.json();
    expect(updated.description).toBe(tag("Editada via"));
    expect(Number(updated.value)).toBe(123.45);
    expect(updated.status).toBe("Confirmado");
    expect(updated.project_id).toBeNull();

    // cleanup
    await request.delete(`/api/financial/transactions/${tx.id}`, { headers });
  });

  test("POST /api/financial/transactions/{id}/confirm faz baixa de Previsto", async ({ request }) => {
    const catsResp = await request.get("/api/financial/categories", { headers });
    const entradaCat = (await catsResp.json()).find((c: any) => c.type === "Entrada");
    const projsResp = await request.get("/api/financial/projects", { headers });
    const projectId = (await projsResp.json())[0].id;

    const create = await request.post("/api/financial/transactions", {
      headers,
      data: {
        date: "2026-05-10",
        description: tag(`Confirm ${Date.now()}`),
        value: 250.0,
        type: "Entrada",
        category_id: entradaCat.id,
        project_id: projectId,
        status: "Previsto",
      },
    });
    expect(create.ok()).toBeTruthy();
    const tx = await create.json();
    expect(tx.status).toBe("Previsto");

    const confirm = await request.post(`/api/financial/transactions/${tx.id}/confirm`, {
      headers,
      data: { payment_date: "2026-05-12" },
    });
    expect(confirm.status()).toBe(200);
    const confirmed = await confirm.json();
    expect(confirmed.status).toBe("Confirmado");
    expect(confirmed.payment_date).toBe("2026-05-12");

    // tentar confirmar duas vezes deve falhar
    const dup = await request.post(`/api/financial/transactions/${tx.id}/confirm`, {
      headers,
      data: {},
    });
    expect(dup.status()).toBe(400);

    await request.delete(`/api/financial/transactions/${tx.id}`, { headers });
  });
});

test.describe("Módulo Financeiro - Dashboard", () => {
  let headers: Record<string, string>;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
  });

  test("GET /api/financial/dashboard retorna resumo financeiro", async ({ request }) => {
    const response = await request.get("/api/financial/dashboard", { headers });

    expect(response.ok()).toBeTruthy();

    const dashboard = await response.json();
    expect(dashboard).toHaveProperty("total_income");
    expect(dashboard).toHaveProperty("total_expense");
    expect(dashboard).toHaveProperty("balance");
    expect(typeof dashboard.total_income).toBe("number");
    expect(typeof dashboard.total_expense).toBe("number");
    expect(typeof dashboard.balance).toBe("number");
  });
});
