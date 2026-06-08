import { test, expect } from "@playwright/test";
import { getAuthHeaders, getAuthToken, API_URL } from "../../helpers/auth";
import { tag, tagEmail } from "../../helpers/e2e-tag";

/**
 * Notificações por atribuição.
 *
 * - Atribuir uma ShoppingList a um outro usuário cria notificação para ele.
 * - O dono da lista (autor) NÃO recebe notificação para si.
 * - Marcar como lida e marcar todas como lidas funcionam.
 * - O endpoint /api/auth/users/options é acessível para usuários comuns.
 */
test.describe("Notificações — atribuição em Compras", () => {
  let adminHeaders: Record<string, string>;
  let assigneeHeaders: Record<string, string>;
  let assigneeId: number;

  test.beforeAll(async ({ request }) => {
    adminHeaders = await getAuthHeaders(request);

    // Cria usuário "assignee" para receber as notificações
    const email = tagEmail("notif-assignee");
    const password = "Senha@123!";
    const create = await request.post(`${API_URL}/api/auth/register`, {
      headers: adminHeaders,
      data: {
        name: tag("Assignee Notif"),
        email,
        password,
        role: "viewer",
      },
    });
    expect(create.ok()).toBeTruthy();
    const user = await create.json();
    assigneeId = user.id;

    const tok = await getAuthToken(request, email, password);
    assigneeHeaders = { Authorization: `Bearer ${tok.access_token}` };
  });

  test("GET /api/auth/users/options é acessível a usuário comum", async ({ request }) => {
    const resp = await request.get(`${API_URL}/api/auth/users/options`, {
      headers: assigneeHeaders,
    });
    expect(resp.ok()).toBeTruthy();
    const opts = await resp.json();
    expect(Array.isArray(opts)).toBeTruthy();
    // O próprio assignee deve aparecer
    expect(opts.some((u: any) => u.id === assigneeId)).toBeTruthy();
    // Não deve vazar email/hash
    for (const u of opts) {
      expect(u).not.toHaveProperty("hashed_password");
      expect(u).not.toHaveProperty("email");
    }
  });

  test("Criar lista com assigned_to_id cria notificação para o atribuído", async ({ request }) => {
    // estado inicial: pega contagem do assignee
    const before = await (
      await request.get(`${API_URL}/api/notifications?only_unread=true`, {
        headers: assigneeHeaders,
      })
    ).json();
    const beforeCount = before.unread_count;

    // admin cria lista atribuída ao assignee
    const listTitle = tag("Lista Notif Assign");
    const create = await request.post(`${API_URL}/api/shopping/lists`, {
      headers: adminHeaders,
      data: {
        name: listTitle,
        description: "lista do teste de notificação",
        assigned_to_id: assigneeId,
      },
    });
    expect(create.ok()).toBeTruthy();
    const lst = await create.json();
    expect(lst.assigned_to_id).toBe(assigneeId);

    // assignee deve ver +1 notificação não lida
    const after = await (
      await request.get(`${API_URL}/api/notifications?only_unread=true`, {
        headers: assigneeHeaders,
      })
    ).json();
    expect(after.unread_count).toBe(beforeCount + 1);

    const matching = after.items.find(
      (n: any) => n.type === "shopping.assignment" && n.link === `/compras/listas/${lst.id}`
    );
    expect(matching).toBeTruthy();
    expect(matching.title).toContain(listTitle);
    expect(matching.is_read).toBe(false);

    // Admin NÃO deve ter recebido notificação para si mesmo
    const adminNotifs = await (
      await request.get(`${API_URL}/api/notifications?only_unread=true`, {
        headers: adminHeaders,
      })
    ).json();
    const ownNotif = adminNotifs.items.find(
      (n: any) => n.link === `/compras/listas/${lst.id}`
    );
    expect(ownNotif).toBeFalsy();

    // Marca como lida
    const read = await request.patch(
      `${API_URL}/api/notifications/${matching.id}/read`,
      { headers: assigneeHeaders }
    );
    expect(read.ok()).toBeTruthy();
    const readBody = await read.json();
    expect(readBody.is_read).toBe(true);
  });

  test("Mudar assigned_to_id em update gera nova notificação", async ({ request }) => {
    // Cria lista SEM assignee
    const create = await request.post(`${API_URL}/api/shopping/lists`, {
      headers: adminHeaders,
      data: { name: tag("Lista para reassign"), description: null },
    });
    const lst = await create.json();

    const before = await (
      await request.get(`${API_URL}/api/notifications?only_unread=true&limit=50`, {
        headers: assigneeHeaders,
      })
    ).json();
    const beforeIds = new Set(before.items.map((n: any) => n.id));

    // Atualiza atribuindo ao assignee
    const upd = await request.put(`${API_URL}/api/shopping/lists/${lst.id}`, {
      headers: adminHeaders,
      data: { assigned_to_id: assigneeId },
    });
    expect(upd.ok()).toBeTruthy();

    const after = await (
      await request.get(`${API_URL}/api/notifications?only_unread=true&limit=50`, {
        headers: assigneeHeaders,
      })
    ).json();
    const newOnes = after.items.filter((n: any) => !beforeIds.has(n.id));
    expect(newOnes.length).toBeGreaterThanOrEqual(1);
    expect(
      newOnes.some(
        (n: any) =>
          n.type === "shopping.assignment" && n.link === `/compras/listas/${lst.id}`
      )
    ).toBeTruthy();
  });

  test("POST /api/notifications/read-all zera o contador", async ({ request }) => {
    const resp = await request.post(`${API_URL}/api/notifications/read-all`, {
      headers: assigneeHeaders,
    });
    expect(resp.ok()).toBeTruthy();

    const after = await (
      await request.get(`${API_URL}/api/notifications?only_unread=true`, {
        headers: assigneeHeaders,
      })
    ).json();
    expect(after.unread_count).toBe(0);
  });

  test("Não pode marcar como lida notificação de outro usuário (404)", async ({ request }) => {
    // Atribui novamente para gerar uma nova notif
    const create = await request.post(`${API_URL}/api/shopping/lists`, {
      headers: adminHeaders,
      data: { name: tag("Lista isolation"), assigned_to_id: assigneeId },
    });
    expect(create.ok()).toBeTruthy();

    const notifs = await (
      await request.get(`${API_URL}/api/notifications?only_unread=true`, {
        headers: assigneeHeaders,
      })
    ).json();
    const target = notifs.items[0];
    expect(target).toBeTruthy();

    // Tenta como admin (que não é o dono dessa notificação)
    const resp = await request.patch(
      `${API_URL}/api/notifications/${target.id}/read`,
      { headers: adminHeaders }
    );
    expect(resp.status()).toBe(404);
  });
});
