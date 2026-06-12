import { test, expect } from "@playwright/test";
import { getAuthHeaders, getAuthToken, API_URL } from "../../helpers/auth";
import { tag, tagEmail } from "../../helpers/e2e-tag";

/**
 * Regressão (relato Jéssica, jun/2026):
 *
 * "Sininho: quando atribui a mim, não apareceu sinalização visual no símbolo
 *  do sininho indicando que tinha uma atribuição de lista de compras."
 *
 * Causa: o backend filtrava `assigned_to_id != current_user.id` antes de criar
 * a notificação — quando a usuária criava a lista já atribuindo a si mesma,
 * nenhuma notificação era gerada.
 *
 * Fix: notificar sempre que houver atribuído, inclusive em auto-atribuição,
 * com mensagem amigável ("Você criou e assumiu a lista...").
 */

test.describe("Notificações - auto-atribuição em Compras (regressão Jéssica jun/2026)", () => {
  test.describe.configure({ mode: "serial" });

  let userHeaders: Record<string, string>;
  let userId: number;

  test.beforeAll(async ({ request }) => {
    const admin = await getAuthHeaders(request);
    // Cria usuário com permissão para criar lista (super_admin para simplificar — o
    // ponto do teste é a notificação para o próprio criador, não a RBAC).
    const email = tagEmail("selfassign");
    const password = "Senha@123!";
    const c = await request.post(`${API_URL}/api/auth/register`, {
      headers: admin,
      data: { name: tag("Self Assignee"), email, password, role: "super_admin" },
    });
    expect(c.ok()).toBeTruthy();
    userId = (await c.json()).id;
    const tok = await getAuthToken(request, email, password);
    userHeaders = { Authorization: `Bearer ${tok.access_token}` };
  });

  test("Criar lista atribuindo a si mesmo dispara notificação no sino", async ({ request }) => {
    const before = await (
      await request.get(`${API_URL}/api/notifications?only_unread=true`, { headers: userHeaders })
    ).json();
    const beforeCount = before.unread_count ?? 0;

    const listName = tag(`Self List ${Date.now()}`);
    const create = await request.post(`${API_URL}/api/shopping/lists`, {
      headers: userHeaders,
      data: { name: listName, assigned_to_id: userId },
    });
    expect(create.ok()).toBeTruthy();
    const lst = await create.json();
    expect(lst.assigned_to_id).toBe(userId);

    const after = await (
      await request.get(`${API_URL}/api/notifications?only_unread=true`, { headers: userHeaders })
    ).json();
    // ANTI-REGRESSÃO: antes a contagem ficava igual. Agora tem que aumentar em 1.
    expect(after.unread_count).toBe(beforeCount + 1);

    const matching = after.items.find(
      (n: any) =>
        n.type === "shopping.assignment" && n.link === `/compras/listas/${lst.id}`
    );
    expect(matching).toBeTruthy();
    // Texto amigável para self-assign
    expect(matching.title.toLowerCase()).toContain(listName.toLowerCase());
    expect(matching.is_read).toBe(false);
  });

  test("Reatribuir uma lista existente a si mesmo também dispara notificação", async ({ request }) => {
    // Lista criada SEM assignee (não emite notif inicial)
    const c = await request.post(`${API_URL}/api/shopping/lists`, {
      headers: userHeaders,
      data: { name: tag(`Reassign self ${Date.now()}`) },
    });
    expect(c.ok()).toBeTruthy();
    const lst = await c.json();
    expect(lst.assigned_to_id).toBeNull();

    const before = await (
      await request.get(`${API_URL}/api/notifications?only_unread=true&limit=50`, { headers: userHeaders })
    ).json();
    const beforeIds = new Set(before.items.map((n: any) => n.id));

    // Atualiza atribuindo a si mesmo
    const u = await request.put(`${API_URL}/api/shopping/lists/${lst.id}`, {
      headers: userHeaders,
      data: { assigned_to_id: userId },
    });
    expect(u.ok()).toBeTruthy();

    const after = await (
      await request.get(`${API_URL}/api/notifications?only_unread=true&limit=50`, { headers: userHeaders })
    ).json();
    const novas = after.items.filter((n: any) => !beforeIds.has(n.id));
    const targetNotif = novas.find(
      (n: any) =>
        n.type === "shopping.assignment" && n.link === `/compras/listas/${lst.id}`
    );
    expect(targetNotif).toBeTruthy();
  });

  test("Criar pedido (purchase request) atribuindo a si mesmo também notifica", async ({ request }) => {
    const before = await (
      await request.get(`${API_URL}/api/notifications?only_unread=true&limit=50`, { headers: userHeaders })
    ).json();
    const beforeIds = new Set(before.items.map((n: any) => n.id));

    const title = tag(`Pedido Self ${Date.now()}`);
    const c = await request.post(`${API_URL}/api/shopping/requests`, {
      headers: userHeaders,
      data: {
        title,
        assigned_to_id: userId,
        items: [{ description: tag("Item teste"), quantity: 1 }],
      },
    });
    expect(c.ok()).toBeTruthy();
    const req = await c.json();

    const after = await (
      await request.get(`${API_URL}/api/notifications?only_unread=true&limit=50`, { headers: userHeaders })
    ).json();
    const novas = after.items.filter((n: any) => !beforeIds.has(n.id));
    expect(
      novas.some(
        (n: any) =>
          n.type === "purchase.assignment" && n.link === `/compras/pedidos/${req.id}`
      )
    ).toBeTruthy();
  });
});
