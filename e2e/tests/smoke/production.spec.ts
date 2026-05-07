import { test, expect } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";

/**
 * SMOKE de PRODUÇÃO — somente leitura.
 *
 * Roda contra a API real após o deploy.
 * NÃO cria, edita ou exclui nada.
 *
 * Pré-requisito: ter um usuário em produção (definido em .env.production)
 * com permissão de visualização nos módulos.
 */
test.describe("Smoke produção — saúde geral", () => {
  test("GET /health responde 200", async ({ request }) => {
    const r = await request.get(`${API_URL}/health`);
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body).toHaveProperty("status");
  });

  test("GET /docs (Swagger) acessível", async ({ request }) => {
    const r = await request.get(`${API_URL}/docs`);
    // Em produção pode estar desabilitado — aceitamos 200 ou 404
    expect([200, 404]).toContain(r.status());
  });
});

test.describe("Smoke produção — autenticação", () => {
  test("login com credenciais válidas retorna JWT", async ({ request }) => {
    const r = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
      },
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body).toHaveProperty("access_token");
    expect(body).toHaveProperty("user");
  });

  test("login com senha errada retorna 401", async ({ request }) => {
    const r = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: process.env.ADMIN_EMAIL,
        password: "senha-invalida-smoke-123",
      },
    });
    expect(r.status()).toBe(401);
  });

  test("/api/auth/me retorna o usuário autenticado", async ({ request }) => {
    const headers = await getAuthHeaders(request);
    const r = await request.get(`${API_URL}/api/auth/me`, { headers });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body).toHaveProperty("email");
  });
});

test.describe("Smoke produção — leitura dos módulos", () => {
  let headers: Record<string, string>;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
  });

  test("GET /api/financial/dashboard responde", async ({ request }) => {
    const r = await request.get(`${API_URL}/api/financial/dashboard`, { headers });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    // Campos do refactor financeiro
    expect(body).toHaveProperty("total_income");
    expect(body).toHaveProperty("total_expense");
    expect(body).toHaveProperty("forecast_in");
    expect(body).toHaveProperty("forecast_out");
    expect(body).toHaveProperty("forecast_in_count");
    expect(body).toHaveProperty("forecast_out_count");
  });

  test("GET /api/financial/categories responde lista", async ({ request }) => {
    const r = await request.get(`${API_URL}/api/financial/categories`, { headers });
    expect(r.ok()).toBeTruthy();
    expect(Array.isArray(await r.json())).toBeTruthy();
  });

  test("GET /api/financial/projects responde lista", async ({ request }) => {
    const r = await request.get(`${API_URL}/api/financial/projects`, { headers });
    expect(r.ok()).toBeTruthy();
    expect(Array.isArray(await r.json())).toBeTruthy();
  });

  test("GET /api/financial/transactions responde lista", async ({ request }) => {
    const r = await request.get(`${API_URL}/api/financial/transactions?limit=5`, {
      headers,
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(Array.isArray(body)).toBeTruthy();

    // Garante que NÃO existem transações com status legado "Conciliado"
    for (const t of body) {
      expect(["Previsto", "Confirmado"]).toContain(t.status);
    }
  });

  test("GET /api/members/ responde lista", async ({ request }) => {
    const r = await request.get(`${API_URL}/api/members/?limit=5`, { headers });
    expect(r.ok()).toBeTruthy();
  });

  test("GET /api/retreats/ responde lista", async ({ request }) => {
    const r = await request.get(`${API_URL}/api/retreats/`, { headers });
    expect(r.ok()).toBeTruthy();
  });

  test("GET /api/patrimony responde lista", async ({ request }) => {
    const r = await request.get(`${API_URL}/api/patrimony`, { headers });
    // 200 (lista) ou 404 se módulo ainda não foi liberado em prod
    expect([200, 404]).toContain(r.status());
  });
});

test.describe("Smoke produção — endpoint /confirm existe", () => {
  test("POST /api/financial/transactions/0/confirm retorna 404 (rota registrada)", async ({
    request,
  }) => {
    const headers = await getAuthHeaders(request);
    // ID inexistente: o importante é a rota responder (não 405/Method Not Allowed)
    const r = await request.post(
      `${API_URL}/api/financial/transactions/999999999/confirm`,
      { headers, data: {} }
    );
    expect([400, 404]).toContain(r.status());
  });
});
