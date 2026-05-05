import { test, expect } from "@playwright/test";

test.describe("Login - UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("página de login é exibida quando não autenticado", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "IERS" })).toBeVisible();
    await expect(page.getByText("Sistema Integrado")).toBeVisible();
  });

  test("exibe campos de email e senha", async ({ page }) => {
    await expect(page.getByPlaceholder("seu@email.com")).toBeVisible();
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  });

  test("login com credenciais inválidas não redireciona", async ({ page }) => {
    await page.getByPlaceholder("seu@email.com").fill("wrong@email.com");
    await page.getByPlaceholder("••••••••").fill("senhaerrada");

    // Aguarda a resposta 401 do backend
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/login")),
      page.getByRole("button", { name: /entrar/i }).click(),
    ]);

    expect(response.status()).toBe(401);

    // Deve permanecer na tela de login
    await expect(page.getByRole("heading", { name: "IERS" })).toBeVisible();
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  });

  test("login com credenciais válidas redireciona para dashboard", async ({ page }) => {
    await page.getByPlaceholder("seu@email.com").fill(process.env.ADMIN_EMAIL || "admin@iers.org");
    await page.getByPlaceholder("••••••••").fill(process.env.ADMIN_PASSWORD || "admin123");
    await page.getByRole("button", { name: /entrar/i }).click();

    // Após login, sidebar aparece com links de navegação
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible({ timeout: 10000 });
  });
});
