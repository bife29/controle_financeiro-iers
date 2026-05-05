import { test, expect } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";

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
      name: `Projeto Teste E2E ${Date.now()}`,
      description: "Criado por teste E2E",
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
      description: `Entrada E2E ${Date.now()}`,
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
