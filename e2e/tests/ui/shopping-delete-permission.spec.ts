/**
 * Spec: docs/specs/SPEC-001-excluir-lista-compras-permissao.md
 *
 * Valida que o botão "Excluir" das listas de compras respeita a permissão
 * `compras.delete` do usuário logado.
 *
 * Cenários (AC-1 a AC-6):
 *  - super_admin  → vê Arquivar e Excluir
 *  - secretaria   → NÃO vê Excluir (não tem compras.delete no default)
 *  - financeiro   → vê Arquivar, NÃO vê Excluir
 *  - secretaria com permissão custom compras.delete → vê Excluir
 *  - Contrato de API: super_admin 200 no DELETE, secretaria 403 (bug original)
 */
import { test, expect, Page } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag, tagEmail } from "../../helpers/e2e-tag";

async function loginUI(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByPlaceholder("seu@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page.locator("aside")).toBeAttached({ timeout: 10000 });
}

async function createUser(
  request: import("@playwright/test").APIRequestContext,
  adminHeaders: Record<string, string>,
  data: {
    name: string;
    email: string;
    password: string;
    role: string;
    permissions?: Record<string, string[]>;
  }
): Promise<number> {
  const resp = await request.post(`${API_URL}/api/auth/register`, {
    headers: adminHeaders,
    data,
  });
  expect(resp.status(), await resp.text()).toBe(200);
  const created = await resp.json();
  return created.id;
}

test.describe("SPEC-001 — Visibilidade do botão Excluir em Compras/Listas", () => {
  test.describe.configure({ mode: "serial" });

  let adminHeaders: Record<string, string>;
  const createdUserIds: number[] = [];
  const createdListIds: number[] = [];
  const stamp = Date.now();

  const usuarios = {
    secretaria: {
      name: tag("Sec SPEC-001"),
      email: tagEmail(`spec001-sec-${stamp}`),
      password: "Senha@123",
      role: "secretaria",
    },
    financeiro: {
      name: tag("Fin SPEC-001"),
      email: tagEmail(`spec001-fin-${stamp}`),
      password: "Senha@123",
      role: "financeiro",
    },
    secretariaComDelete: {
      name: tag("Sec+del SPEC-001"),
      email: tagEmail(`spec001-secdel-${stamp}`),
      password: "Senha@123",
      role: "secretaria",
      permissions: {
        dashboard: ["view"],
        membros: ["view"],
        compras: ["view", "create", "delete"],
      },
    },
  };

  test.beforeAll(async ({ request }) => {
    adminHeaders = await getAuthHeaders(request);

    // Cria os 3 usuários de teste
    for (const u of Object.values(usuarios)) {
      const id = await createUser(request, adminHeaders, u);
      createdUserIds.push(id);
    }

    // Cria 1 lista de compras (como super_admin) para os cenários terem algo
    // pra ver na tela.
    const resp = await request.post(`${API_URL}/api/shopping/lists`, {
      headers: adminHeaders,
      data: {
        name: tag("Lista SPEC-001"),
        description: "Lista de teste de visibilidade de botão",
      },
    });
    expect(resp.status(), await resp.text()).toBe(200);
    const lista = await resp.json();
    createdListIds.push(lista.id);
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdListIds) {
      await request
        .delete(`${API_URL}/api/shopping/lists/${id}`, { headers: adminHeaders })
        .catch(() => undefined);
    }
    for (const id of createdUserIds) {
      await request
        .delete(`${API_URL}/api/auth/users/${id}?force=true`, {
          headers: adminHeaders,
        })
        .catch(() => undefined);
    }
  });

  test("AC-1 — super_admin vê botões Arquivar e Excluir", async ({ page }) => {
    await loginUI(
      page,
      process.env.ADMIN_EMAIL || "admin@iers.org",
      process.env.ADMIN_PASSWORD || "admin123"
    );
    await page.goto("/compras/listas");
    const listId = createdListIds[0];
    await expect(
      page.getByTestId(`archive-list-${listId}`)
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId(`delete-list-${listId}`)).toBeVisible();
  });

  test("AC-2 — secretaria (default) NÃO vê botão Excluir", async ({ page }) => {
    await loginUI(page, usuarios.secretaria.email, usuarios.secretaria.password);
    await page.goto("/compras/listas");
    const listId = createdListIds[0];
    // A lista aparece (secretaria tem compras.view), mas botão excluir não.
    await expect(
      page.getByRole("link", { name: /Abrir/i }).first()
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId(`delete-list-${listId}`)).toHaveCount(0);
    // secretaria tem compras.create → botão "Nova lista" habilitado
    await expect(page.getByTestId("new-list-button")).toBeEnabled();
    // secretaria NÃO tem compras.edit → botão Arquivar não aparece
    await expect(page.getByTestId(`archive-list-${listId}`)).toHaveCount(0);
  });

  test("AC-3 — financeiro vê Arquivar mas NÃO vê Excluir", async ({ page }) => {
    await loginUI(page, usuarios.financeiro.email, usuarios.financeiro.password);
    await page.goto("/compras/listas");
    const listId = createdListIds[0];
    await expect(
      page.getByTestId(`archive-list-${listId}`)
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId(`delete-list-${listId}`)).toHaveCount(0);
  });

  test("AC-4 — secretaria com permissão custom vê Excluir", async ({ page }) => {
    await loginUI(
      page,
      usuarios.secretariaComDelete.email,
      usuarios.secretariaComDelete.password
    );
    await page.goto("/compras/listas");
    const listId = createdListIds[0];
    await expect(
      page.getByTestId(`delete-list-${listId}`)
    ).toBeVisible({ timeout: 10000 });
  });

  test("AC-6 — API: secretaria recebe 403 no DELETE (regressão do bug relatado)", async ({
    request,
  }) => {
    const secHeaders = await getAuthHeaders(
      request,
      usuarios.secretaria.email,
      usuarios.secretaria.password
    );
    // Cria lista efêmera pra tentar excluir
    const create = await request.post(`${API_URL}/api/shopping/lists`, {
      headers: adminHeaders,
      data: { name: tag("Lista SPEC-001 ef"), description: "efêmera" },
    });
    expect(create.ok()).toBeTruthy();
    const efemera = await create.json();
    try {
      const del = await request.delete(
        `${API_URL}/api/shopping/lists/${efemera.id}`,
        { headers: secHeaders }
      );
      expect(del.status()).toBe(403);
      const body = await del.json();
      expect(String(body.detail)).toContain("delete");
      expect(String(body.detail)).toContain("compras");
    } finally {
      await request
        .delete(`${API_URL}/api/shopping/lists/${efemera.id}`, {
          headers: adminHeaders,
        })
        .catch(() => undefined);
    }
  });

  test("Contrato de API: /api/auth/me devolve permissions", async ({ request }) => {
    const secHeaders = await getAuthHeaders(
      request,
      usuarios.secretaria.email,
      usuarios.secretaria.password
    );
    const me = await request.get(`${API_URL}/api/auth/me`, { headers: secHeaders });
    expect(me.ok()).toBeTruthy();
    const body = await me.json();
    expect(body).toHaveProperty("permissions");
    // secretaria default: compras=["view","create"] (sem delete/edit)
    expect(body.permissions.compras).toContain("view");
    expect(body.permissions.compras).toContain("create");
    expect(body.permissions.compras).not.toContain("delete");
  });
});
