import { test, expect } from "@playwright/test";
import { getAuthToken, getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag, tagEmail } from "../../helpers/e2e-tag";

/**
 * Garante que `require_permission` realmente respeita o JSON `permissions`
 * customizado de um usuário não-admin.
 *
 * Cria a Jessica de teste:
 *   role = "financeiro"
 *   permissions custom: { "membros": ["view","create","edit","delete"] }
 *
 * Espera-se:
 *  - POST /api/members/  → 200 (permissão custom autoriza)
 *  - PUT  /api/members/{id} → 200
 *  - DELETE /api/members/{id} → 200
 *
 * E também o caminho negativo:
 *  - usuário "viewer" SEM permissão custom em membros → POST 403
 */
test.describe("Permissões granulares (JSON permissions)", () => {
  let adminHeaders: Record<string, string>;
  let createdUserIds: number[] = [];
  let createdMemberIds: number[] = [];

  test.beforeAll(async ({ request }) => {
    adminHeaders = await getAuthHeaders(request);
  });

  test.afterAll(async ({ request }) => {
    // best-effort: remove os recursos criados (cleanup global também cuida via tag)
    for (const id of createdMemberIds) {
      await request
        .delete(`${API_URL}/api/members/${id}`, { headers: adminHeaders })
        .catch(() => undefined);
    }
    for (const id of createdUserIds) {
      // ?force=true caso tenha audit logs
      await request
        .delete(`${API_URL}/api/auth/users/${id}?force=true`, {
          headers: adminHeaders,
        })
        .catch(() => undefined);
    }
  });

  test("usuário 'financeiro' com permissão custom em membros consegue CRUD", async ({
    request,
  }) => {
    const email = tagEmail("financ-perm");
    const password = "Senha@123";

    // 1. Admin cria a usuária com role=financeiro + permissions custom em membros
    const create = await request.post(`${API_URL}/api/auth/register`, {
      headers: adminHeaders,
      data: {
        name: tag("Jessica Test"),
        email,
        password,
        role: "financeiro",
        permissions: {
          dashboard: ["view"],
          financeiro: ["view", "create", "edit", "delete"],
          membros: ["view", "create", "edit", "delete"],
          retiros: ["view"],
          secretaria: ["view"],
          patrimonio: ["view"],
          feedback: ["view"],
          usuarios: [],
        },
      },
    });
    expect(create.status(), await create.text()).toBe(200);
    const user = await create.json();
    createdUserIds.push(user.id);

    // 2. Login como Jessica
    const auth = await getAuthToken(request, email, password);
    const headers = { Authorization: `Bearer ${auth.access_token}` };

    // 3. POST /api/members/ — deve permitir (permissão custom autoriza)
    const memberPost = await request.post(`${API_URL}/api/members/`, {
      headers,
      data: {
        name: tag("Membro via permissão custom"),
        email: tagEmail("memb-perm"),
        is_active: true,
      },
    });
    expect(
      memberPost.status(),
      `POST member falhou: ${await memberPost.text()}`
    ).toBe(200);
    const member = await memberPost.json();
    createdMemberIds.push(member.id);

    // 4. PUT /api/members/{id}
    const memberPut = await request.put(`${API_URL}/api/members/${member.id}`, {
      headers,
      data: { name: tag("Membro renomeado") },
    });
    expect(memberPut.status(), await memberPut.text()).toBe(200);

    // 5. DELETE /api/members/{id}
    const memberDel = await request.delete(
      `${API_URL}/api/members/${member.id}`,
      { headers }
    );
    expect(memberDel.status()).toBe(200);
    createdMemberIds = createdMemberIds.filter((id) => id !== member.id);
  });

  test("usuário 'viewer' SEM permissão custom em membros recebe 403", async ({
    request,
  }) => {
    const email = tagEmail("viewer-noperm");
    const password = "Senha@123";

    const create = await request.post(`${API_URL}/api/auth/register`, {
      headers: adminHeaders,
      data: {
        name: tag("Viewer Test"),
        email,
        password,
        role: "viewer",
        // sem permissions custom → usa defaults do role viewer (que NÃO inclui create em membros)
      },
    });
    expect(create.status()).toBe(200);
    const user = await create.json();
    createdUserIds.push(user.id);

    const auth = await getAuthToken(request, email, password);
    const headers = { Authorization: `Bearer ${auth.access_token}` };

    const memberPost = await request.post(`${API_URL}/api/members/`, {
      headers,
      data: { name: tag("Não deveria criar"), is_active: true },
    });
    expect(memberPost.status()).toBe(403);
  });
});
