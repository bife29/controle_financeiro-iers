import { test, expect } from "@playwright/test";
import { getAuthToken } from "../../helpers/auth";

test.describe("Autenticação", () => {
  test("POST /api/auth/login com credenciais válidas retorna JWT", async ({ request }) => {
    const response = await request.post("/api/auth/login", {
      data: {
        email: process.env.ADMIN_EMAIL || "admin@iers.org",
        password: process.env.ADMIN_PASSWORD || "admin123",
      },
    });

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.access_token).toBeTruthy();
    expect(body.token_type).toBe("bearer");
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(process.env.ADMIN_EMAIL || "admin@iers.org");
    expect(body.user.role).toBe("super_admin");
  });

  test("POST /api/auth/login com credenciais inválidas retorna 401", async ({ request }) => {
    const response = await request.post("/api/auth/login", {
      data: {
        email: "admin@iers.org",
        password: "senha-errada",
      },
    });

    expect(response.status()).toBe(401);
  });

  test("GET /api/auth/me retorna dados do usuário autenticado", async ({ request }) => {
    const auth = await getAuthToken(request);

    const response = await request.get("/api/auth/me", {
      headers: { Authorization: `Bearer ${auth.access_token}` },
    });

    expect(response.ok()).toBeTruthy();

    const user = await response.json();
    expect(user.id).toBeDefined();
    expect(user.email).toBe(process.env.ADMIN_EMAIL || "admin@iers.org");
    expect(user.name).toBeTruthy();
    expect(user.role).toBe("super_admin");
  });

  test("GET /api/auth/me sem token retorna 401", async ({ request }) => {
    const response = await request.get("/api/auth/me");
    expect(response.status()).toBe(401);
  });

  test("GET /api/auth/me com token inválido retorna 401", async ({ request }) => {
    const response = await request.get("/api/auth/me", {
      headers: { Authorization: "Bearer token-invalido-xyz" },
    });

    expect(response.status()).toBe(401);
  });
});
