import { test, expect } from "@playwright/test";
import { getAuthHeaders, getAuthToken } from "../../helpers/auth";
import { tag, tagEmail } from "../../helpers/e2e-tag";

test.describe("Gestão de Usuários - API", () => {
  let headers: Record<string, string>;
  let createdUserId: number;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
  });

  test.describe.configure({ mode: "serial" });

  // ============ CRUD USUÁRIOS ============

  test("GET /api/auth/users lista usuários", async ({ request }) => {
    const response = await request.get("/api/auth/users", { headers });

    expect(response.ok()).toBeTruthy();

    const users = await response.json();
    expect(Array.isArray(users)).toBeTruthy();
    expect(users.length).toBeGreaterThanOrEqual(1);

    const admin = users.find((u: any) => u.email === "admin@iers.org");
    expect(admin).toBeDefined();
    expect(admin.role).toBe("super_admin");
  });

  test("POST /api/auth/register cria novo usuário", async ({ request }) => {
    const newUser = {
      name: tag(`Usuário ${Date.now()}`),
      email: tagEmail(`user-${Date.now()}`),
      password: "senha123",
      role: "viewer",
    };

    const response = await request.post("/api/auth/register", {
      headers,
      data: newUser,
    });

    expect(response.ok()).toBeTruthy();

    const created = await response.json();
    createdUserId = created.id;
    expect(created.name).toBe(newUser.name);
    expect(created.email).toBe(newUser.email);
    expect(created.role).toBe("viewer");
    expect(created.is_active).toBe(true);
  });

  test("GET /api/auth/users/:id busca usuário por ID", async ({ request }) => {
    const response = await request.get(`/api/auth/users/${createdUserId}`, { headers });

    expect(response.ok()).toBeTruthy();

    const user = await response.json();
    expect(user.id).toBe(createdUserId);
    expect(user.role).toBe("viewer");
  });

  test("PUT /api/auth/users/:id atualiza role e permissões", async ({ request }) => {
    const response = await request.put(`/api/auth/users/${createdUserId}`, {
      headers,
      data: {
        role: "secretaria",
        permissions: {
          dashboard: ["view"],
          financeiro: ["view"],
          membros: ["view", "create", "edit"],
          retiros: ["view", "create", "edit"],
          feedback: ["view", "create"],
          usuarios: [],
        },
      },
    });

    expect(response.ok()).toBeTruthy();

    const updated = await response.json();
    expect(updated.role).toBe("secretaria");
    expect(updated.permissions).toBeDefined();
    expect(updated.permissions.membros).toContain("create");
    expect(updated.permissions.usuarios).toEqual([]);
  });

  test("PUT /api/auth/users/:id desativa usuário", async ({ request }) => {
    const response = await request.put(`/api/auth/users/${createdUserId}`, {
      headers,
      data: { is_active: false },
    });

    expect(response.ok()).toBeTruthy();

    const updated = await response.json();
    expect(updated.is_active).toBe(false);
  });

  test("PUT /api/auth/users/:id reativa usuário", async ({ request }) => {
    const response = await request.put(`/api/auth/users/${createdUserId}`, {
      headers,
      data: { is_active: true },
    });

    expect(response.ok()).toBeTruthy();

    const updated = await response.json();
    expect(updated.is_active).toBe(true);
  });

  test("PUT /api/auth/users/:id/password redefine senha", async ({ request }) => {
    const response = await request.put(`/api/auth/users/${createdUserId}/password`, {
      headers,
      data: { new_password: "novasenha456" },
    });

    expect(response.ok()).toBeTruthy();
  });

  test("GET /api/auth/permissions/defaults retorna permissões por role", async ({ request }) => {
    const response = await request.get("/api/auth/permissions/defaults", { headers });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.modules).toBeDefined();
    expect(Array.isArray(data.modules)).toBeTruthy();
    expect(data.defaults).toBeDefined();
    expect(data.defaults.super_admin).toBeDefined();
    expect(data.defaults.viewer).toBeDefined();
  });

  test("DELETE /api/auth/users/:id exclui usuário", async ({ request }) => {
    const response = await request.delete(`/api/auth/users/${createdUserId}`, { headers });

    expect(response.ok()).toBeTruthy();

    // Confirma que não existe mais
    const getResp = await request.get(`/api/auth/users/${createdUserId}`, { headers });
    expect(getResp.status()).toBe(404);
  });

  // ============ SEGURANÇA ============

  test("GET /api/auth/users sem auth retorna 401", async ({ request }) => {
    const response = await request.get("/api/auth/users");
    expect(response.status()).toBe(401);
  });

  test("POST /api/auth/register sem auth retorna 401", async ({ request }) => {
    const response = await request.post("/api/auth/register", {
      data: { name: "Hacker", email: "hack@er.com", password: "123456", role: "super_admin" },
    });
    expect(response.status()).toBe(401);
  });

  test("DELETE admin não pode excluir a si mesmo", async ({ request }) => {
    const auth = await getAuthToken(request);
    const meResp = await request.get("/api/auth/me", {
      headers: { Authorization: `Bearer ${auth.access_token}` },
    });
    const me = await meResp.json();

    const response = await request.delete(`/api/auth/users/${me.id}`, { headers });
    expect(response.status()).toBe(400);
  });
});
