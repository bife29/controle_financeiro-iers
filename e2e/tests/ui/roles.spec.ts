import { test, expect, Page } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";
import { tag, tagEmail } from "../../helpers/e2e-tag";

const API_URL = process.env.API_URL || "http://127.0.0.1:8001";

interface TestUser {
  name: string;
  email: string;
  password: string;
  role: string;
}

const ROLES: TestUser[] = [
  { name: tag("Pastor"), email: tagEmail(`pastor-${Date.now()}`), password: "senha123", role: "pastor" },
  { name: tag("Financeiro"), email: tagEmail(`fin-${Date.now()}`), password: "senha123", role: "financeiro" },
  { name: tag("Secretaria"), email: tagEmail(`sec-${Date.now()}`), password: "senha123", role: "secretaria" },
  { name: tag("Viewer"), email: tagEmail(`viewer-${Date.now()}`), password: "senha123", role: "viewer" },
];

// Quais links da sidebar cada role deve ver
const SIDEBAR_EXPECTATIONS: Record<string, { visible: RegExp[]; hidden: RegExp[] }> = {
  pastor: {
    visible: [/Dashboard/, /Financeiro/, /Membros/, /Retiros/, /Feedback/],
    hidden: [/Usu[aá]rio/i],
  },
  financeiro: {
    visible: [/Dashboard/, /Financeiro/, /Membros/, /Feedback/],
    hidden: [/Retiros/, /Usu[aá]rio/i],
  },
  secretaria: {
    visible: [/Dashboard/, /Membros/, /Retiros/, /Feedback/],
    hidden: [/Financeiro/, /Usu[aá]rio/i],
  },
  viewer: {
    visible: [/Dashboard/],
    hidden: [/Usu[aá]rio/i],
  },
};

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByPlaceholder("seu@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  // Aguardar login concluído - sidebar renderizada
  await expect(page.locator("aside")).toBeAttached({ timeout: 10000 });
}

test.describe("Validação de permissões por role", () => {
  const createdIds: number[] = [];
  let adminHeaders: Record<string, string>;

  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ request }) => {
    adminHeaders = await getAuthHeaders(request);

    // Criar um usuário de cada role
    for (const user of ROLES) {
      const resp = await request.post(`${API_URL}/api/auth/register`, {
        headers: adminHeaders,
        data: user,
      });
      expect(resp.ok()).toBeTruthy();
      const created = await resp.json();
      createdIds.push(created.id);
    }
  });

  test.afterAll(async ({ request }) => {
    // Limpar todos os usuários criados
    for (const id of createdIds) {
      await request.delete(`${API_URL}/api/auth/users/${id}`, {
        headers: adminHeaders,
      });
    }
  });

  // ===== PASTOR =====
  test.describe("Role: Pastor", () => {
    const user = ROLES[0];

    test("pastor faz login com sucesso", async ({ page }) => {
      await loginAs(page, user.email, user.password);
      await expect(page.locator("aside").getByText(user.name)).toBeVisible({ timeout: 5000 });
    });

    test("pastor vê links corretos na sidebar", async ({ page }) => {
      await loginAs(page, user.email, user.password);

      for (const pattern of SIDEBAR_EXPECTATIONS.pastor.visible) {
        await expect(page.locator("aside").getByRole("link", { name: pattern })).toBeVisible({ timeout: 3000 });
      }
      for (const pattern of SIDEBAR_EXPECTATIONS.pastor.hidden) {
        await expect(page.locator("aside").getByRole("link", { name: pattern })).not.toBeVisible();
      }
    });

    test("pastor acessa Financeiro (somente view/create)", async ({ page }) => {
      await loginAs(page, user.email, user.password);
      await page.getByRole("link", { name: "Financeiro" }).click();
      await expect(page).toHaveURL(/financeiro/, { timeout: 5000 });
    });

    test("pastor acessa Retiros", async ({ page }) => {
      await loginAs(page, user.email, user.password);
      await page.getByRole("link", { name: "Retiros" }).click();
      await expect(page).toHaveURL(/retiros/, { timeout: 5000 });
    });

    test("pastor NÃO pode criar usuários via API (somente super_admin)", async ({ request }) => {
      const loginResp = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: user.email, password: user.password },
      });
      const auth = await loginResp.json();
      const resp = await request.post(`${API_URL}/api/auth/register`, {
        headers: { Authorization: `Bearer ${auth.access_token}` },
        data: { name: "Hack", email: "hack@e2e.com", password: "123", role: "viewer" },
      });
      expect(resp.status()).toBeGreaterThanOrEqual(403);
    });
  });

  // ===== FINANCEIRO =====
  test.describe("Role: Financeiro", () => {
    const user = ROLES[1];

    test("financeiro faz login com sucesso", async ({ page }) => {
      await loginAs(page, user.email, user.password);
      await expect(page.locator("aside").getByText(user.name)).toBeVisible({ timeout: 5000 });
    });

    test("financeiro vê links corretos na sidebar", async ({ page }) => {
      await loginAs(page, user.email, user.password);

      for (const pattern of SIDEBAR_EXPECTATIONS.financeiro.visible) {
        await expect(page.locator("aside").getByRole("link", { name: pattern })).toBeVisible({ timeout: 3000 });
      }
      for (const pattern of SIDEBAR_EXPECTATIONS.financeiro.hidden) {
        await expect(page.locator("aside").getByRole("link", { name: pattern })).not.toBeVisible();
      }
    });

    test("financeiro acessa módulo Financeiro completo", async ({ page }) => {
      await loginAs(page, user.email, user.password);
      await page.getByRole("link", { name: "Financeiro" }).click();
      await expect(page).toHaveURL(/financeiro/, { timeout: 5000 });
      // Deve ver transações, projetos, etc.
      await expect(page.getByRole("link", { name: /Transações/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Projetos/i })).toBeVisible();
    });

    test("financeiro acessa dashboard financeiro via API", async ({ request }) => {
      const loginResp = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: user.email, password: user.password },
      });
      const auth = await loginResp.json();
      const resp = await request.get(`${API_URL}/api/financial/dashboard`, {
        headers: { Authorization: `Bearer ${auth.access_token}` },
      });
      expect(resp.ok()).toBeTruthy();
      const data = await resp.json();
      expect(data.total_income).toBeDefined();
    });

    test("financeiro NÃO acessa gestão de usuários via API", async ({ request }) => {
      const loginResp = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: user.email, password: user.password },
      });
      const auth = await loginResp.json();
      const resp = await request.get(`${API_URL}/api/auth/users`, {
        headers: { Authorization: `Bearer ${auth.access_token}` },
      });
      expect(resp.status()).toBeGreaterThanOrEqual(403);
    });
  });

  // ===== SECRETARIA =====
  test.describe("Role: Secretaria", () => {
    const user = ROLES[2];

    test("secretaria faz login com sucesso", async ({ page }) => {
      await loginAs(page, user.email, user.password);
      await expect(page.locator("aside").getByText(user.name)).toBeVisible({ timeout: 5000 });
    });

    test("secretaria vê links corretos na sidebar", async ({ page }) => {
      await loginAs(page, user.email, user.password);

      for (const pattern of SIDEBAR_EXPECTATIONS.secretaria.visible) {
        await expect(page.locator("aside").getByRole("link", { name: pattern })).toBeVisible({ timeout: 3000 });
      }
      for (const pattern of SIDEBAR_EXPECTATIONS.secretaria.hidden) {
        await expect(page.locator("aside").getByRole("link", { name: pattern })).not.toBeVisible();
      }
    });

    test("secretaria acessa Membros e pode criar", async ({ page }) => {
      await loginAs(page, user.email, user.password);
      await page.getByRole("link", { name: "Membros" }).click();
      await expect(page).toHaveURL(/membros/, { timeout: 5000 });
      // Botão de novo membro deve estar visível
      await expect(
        page.getByRole("link", { name: /novo|adicionar|cadastrar/i })
          .or(page.getByRole("button", { name: /novo|adicionar|cadastrar/i }))
      ).toBeVisible({ timeout: 5000 });
    });

    test("secretaria acessa Retiros", async ({ page }) => {
      await loginAs(page, user.email, user.password);
      await page.getByRole("link", { name: "Retiros" }).click();
      await expect(page).toHaveURL(/retiros/, { timeout: 5000 });
    });

    test("secretaria NÃO acessa Financeiro na sidebar", async ({ page }) => {
      await loginAs(page, user.email, user.password);
      await expect(page.locator("aside").getByRole("link", { name: "Financeiro" })).not.toBeVisible();
    });

    test("secretaria NÃO acessa dashboard financeiro via API", async ({ request }) => {
      const loginResp = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: user.email, password: user.password },
      });
      const auth = await loginResp.json();
      const resp = await request.get(`${API_URL}/api/financial/dashboard`, {
        headers: { Authorization: `Bearer ${auth.access_token}` },
      });
      expect(resp.status()).toBeGreaterThanOrEqual(403);
    });
  });

  // ===== VIEWER =====
  test.describe("Role: Viewer", () => {
    const user = ROLES[3];

    test("viewer faz login com sucesso", async ({ page }) => {
      await loginAs(page, user.email, user.password);
      await expect(page.locator("aside").getByText(user.name)).toBeVisible({ timeout: 5000 });
    });

    test("viewer não vê Financeiro nem Usuários na sidebar", async ({ page }) => {
      await loginAs(page, user.email, user.password);

      await expect(page.locator("aside").getByRole("link", { name: /Financeiro/ })).not.toBeVisible();
      await expect(page.locator("aside").getByRole("link", { name: /Usu[aá]rio/i })).not.toBeVisible();
    });

    test("viewer NÃO pode criar transações via API", async ({ request }) => {
      const loginResp = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: user.email, password: user.password },
      });
      const auth = await loginResp.json();
      const resp = await request.post(`${API_URL}/api/financial/transactions`, {
        headers: { Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" },
        data: {
          date: "2026-01-01",
          type: "Entrada",
          value: 100,
          project_id: 1,
          description: "Tentativa viewer",
        },
      });
      expect(resp.status()).toBeGreaterThanOrEqual(403);
    });

    test("viewer NÃO pode criar membros via API", async ({ request }) => {
      const loginResp = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: user.email, password: user.password },
      });
      const auth = await loginResp.json();
      const resp = await request.post(`${API_URL}/api/members/`, {
        headers: { Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" },
        data: {
          full_name: "Viewer Hack",
          membership_number: 9999,
        },
      });
      expect(resp.status()).toBeGreaterThanOrEqual(403);
    });

    test("viewer NÃO pode excluir usuários via API", async ({ request }) => {
      const loginResp = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: user.email, password: user.password },
      });
      const auth = await loginResp.json();
      const resp = await request.delete(`${API_URL}/api/auth/users/1`, {
        headers: { Authorization: `Bearer ${auth.access_token}` },
      });
      expect(resp.status()).toBeGreaterThanOrEqual(403);
    });
  });
});
