/**
 * Spec: docs/specs/SPEC-002-navegacao-notificacoes-sino.md (seção 13)
 *
 * Bug reportado por Jéssica no retest 15/07/26: "aparece a notificação
 * no sininho, mas não aparece o card, aparentemente está cortando".
 *
 * Diagnóstico: o sino do sidebar (desktop) fica no rodapé do viewport.
 * O dropdown usava `top-full` (abre pra baixo) → aparecia embaixo da
 * tela, invisível.
 *
 * Fix (2026-07-22): NotificationBell usa `useLayoutEffect` para medir
 * o espaço disponível e alterna entre `top-full` e `bottom-full`.
 *
 * AC-6 (novo): dropdown deve estar 100% dentro do viewport em desktop.
 */
import { test, expect } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@iers.org";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

test.describe("SPEC-002 §13 — Dropdown do sino totalmente visível", () => {
  test.describe.configure({ mode: "serial" });
  // Força viewport desktop grande — problema clássico é justamente aí
  // (em mobile o sino fica no topo, sem esse bug).
  test.use({ viewport: { width: 1280, height: 720 } });

  let adminHeaders: Record<string, string>;
  let adminId: number;
  const createdListIds: number[] = [];

  test.beforeAll(async ({ request }) => {
    adminHeaders = await getAuthHeaders(request);
    const me = await request.get(`${API_URL}/api/auth/me`, {
      headers: adminHeaders,
    });
    expect(me.ok()).toBeTruthy();
    adminId = (await me.json()).id;
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdListIds) {
      await request
        .delete(`${API_URL}/api/shopping/lists/${id}`, { headers: adminHeaders })
        .catch(() => undefined);
    }
  });

  test("AC-6 — dropdown do sino do sidebar (desktop) fica dentro do viewport", async ({
    page,
    request,
  }) => {
    // Gera uma notificação para garantir que o dropdown tem conteúdo.
    const listName = tag(`SPEC-002 dropdown ${Date.now()}`);
    const create = await request.post(`${API_URL}/api/shopping/lists`, {
      headers: adminHeaders,
      data: {
        name: listName,
        description: "Teste E2E dropdown visível",
        assigned_to_id: adminId,
      },
    });
    expect(create.ok()).toBeTruthy();
    createdListIds.push((await create.json()).id);

    // Login via UI
    await page.goto("/");
    await page.getByPlaceholder("seu@email.com").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("••••••••").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.locator("aside")).toBeAttached({ timeout: 15000 });

    // Em desktop (>= 1024px) o header mobile é hidden e o sidebar é static.
    // O primeiro botão de sino no DOM é o do sidebar (dentro de <aside>).
    // Aguarda o badge aparecer para garantir que há o que mostrar.
    const badge = page.getByTestId("notifications-unread-badge").first();
    await expect(badge).toBeVisible({ timeout: 65000 });

    // Localiza o sino que está DENTRO do sidebar (o problemático).
    const sidebarBell = page
      .locator("aside")
      .getByTestId("notifications-bell");
    await expect(sidebarBell).toBeVisible();

    // Antes de abrir: dropdown não existe.
    await expect(page.getByTestId("notifications-dropdown")).toHaveCount(0);

    // Abre o dropdown.
    await sidebarBell.click();

    const dropdown = page.getByTestId("notifications-dropdown").first();
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Deve ter escolhido placement="top" porque o sino está no rodapé do
    // sidebar (não há espaço abaixo).
    await expect(dropdown).toHaveAttribute("data-placement", "top");

    // Valida geometricamente que o dropdown está 100% dentro do viewport.
    const box = await dropdown.boundingBox();
    expect(box).not.toBeNull();
    const vp = page.viewportSize();
    expect(vp).not.toBeNull();

    if (box && vp) {
      const bottom = box.y + box.height;
      const right = box.x + box.width;
      expect(box.y, `top do dropdown deve ser >= 0 (foi ${box.y})`)
        .toBeGreaterThanOrEqual(0);
      expect(box.x, `left do dropdown deve ser >= 0 (foi ${box.x})`)
        .toBeGreaterThanOrEqual(0);
      expect(
        bottom,
        `bottom do dropdown (${bottom}) não pode ultrapassar viewport (${vp.height})`
      ).toBeLessThanOrEqual(vp.height);
      expect(
        right,
        `right do dropdown (${right}) não pode ultrapassar viewport (${vp.width})`
      ).toBeLessThanOrEqual(vp.width);
    }

    // O primeiro card deve estar visível (não cortado).
    const primeiroCard = page
      .locator('[data-testid^="notification-"]')
      .filter({ hasText: listName })
      .first();
    await expect(primeiroCard).toBeVisible({ timeout: 3000 });

    const cardBox = await primeiroCard.boundingBox();
    expect(cardBox).not.toBeNull();
    if (cardBox && vp) {
      expect(cardBox.y).toBeGreaterThanOrEqual(0);
      expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(vp.height);
    }
  });
});
