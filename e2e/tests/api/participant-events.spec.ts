import { test, expect } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Regressão: vinculação de membro a projeto/evento (ParticipantEvent).
 *
 * Bug original: usuária reportou "Não está vinculando membro no projeto/evento".
 * O endpoint POST /api/financial/participant-events existia mas o DELETE não,
 * e a UI não expunha o fluxo. Este teste cobre o contrato completo:
 *   create -> list -> update -> delete
 */
test.describe("Financial: Participant-Events (vinculação de membro a projeto)", () => {
  let memberId: number;
  let projectId: number;
  let peId: number | null = null;

  test.beforeAll(async ({ request }) => {
    const headers = await getAuthHeaders(request);

    // Cria um membro de teste (com tag para teardown)
    const mResp = await request.post(`${API_URL}/api/members/`, {
      headers,
      data: { name: tag("Membro Vinculo PE") },
    });
    expect(mResp.status(), await mResp.text()).toBe(200);
    memberId = (await mResp.json()).id;

    // Cria um projeto de teste
    const pResp = await request.post(`${API_URL}/api/financial/projects`, {
      headers,
      data: {
        name: tag("Projeto Vinculo PE"),
        start_date: new Date().toISOString().slice(0, 10),
        status: "Ativo",
      },
    });
    expect(pResp.status(), await pResp.text()).toBe(200);
    projectId = (await pResp.json()).id;
  });

  test.afterAll(async ({ request }) => {
    const headers = await getAuthHeaders(request);
    if (peId) {
      await request
        .delete(`${API_URL}/api/financial/participant-events/${peId}`, { headers })
        .catch(() => undefined);
    }
    if (projectId) {
      await request
        .delete(`${API_URL}/api/financial/projects/${projectId}`, { headers })
        .catch(() => undefined);
    }
    if (memberId) {
      await request
        .delete(`${API_URL}/api/members/${memberId}?force=true`, { headers })
        .catch(() => undefined);
    }
  });

  test("vincula, atualiza e desvincula membro de projeto", async ({ request }) => {
    const headers = await getAuthHeaders(request);

    // 1. CREATE: vincular membro ao projeto
    const create = await request.post(
      `${API_URL}/api/financial/participant-events`,
      {
        headers,
        data: {
          member_id: memberId,
          project_id: projectId,
          agreed_value: 250.5,
          status: "Pendente",
        },
      }
    );
    expect(create.status(), await create.text()).toBe(200);
    const created = await create.json();
    peId = created.id;
    expect(created.member_id).toBe(memberId);
    expect(created.project_id).toBe(projectId);
    expect(created.agreed_value).toBe(250.5);
    expect(created.status).toBe("Pendente");

    // 2. LIST: aparece filtrado por project_id
    const list = await request.get(
      `${API_URL}/api/financial/participant-events?project_id=${projectId}`,
      { headers }
    );
    expect(list.status()).toBe(200);
    const items = await list.json();
    expect(items.find((i: any) => i.id === peId)).toBeTruthy();

    // 3. DASHBOARD: participant_count deve refletir ao menos 1 vínculo
    const dash = await request.get(
      `${API_URL}/api/financial/projects/${projectId}/dashboard`,
      { headers }
    );
    expect(dash.status()).toBe(200);
    const dashJson = await dash.json();
    expect(dashJson.participant_count).toBeGreaterThanOrEqual(1);

    // 4. UPDATE: marcar como Pago
    const update = await request.put(
      `${API_URL}/api/financial/participant-events/${peId}`,
      {
        headers,
        data: { status: "Pago", paid_value: 250.5 },
      }
    );
    expect(update.status(), await update.text()).toBe(200);
    expect((await update.json()).status).toBe("Pago");

    // 5. DELETE: remover vínculo (endpoint que não existia antes da regressão)
    const del = await request.delete(
      `${API_URL}/api/financial/participant-events/${peId}`,
      { headers }
    );
    expect(del.status(), await del.text()).toBe(200);
    peId = null;

    // 6. Confirma remoção
    const after = await request.get(
      `${API_URL}/api/financial/participant-events?project_id=${projectId}`,
      { headers }
    );
    const remaining = await after.json();
    expect(remaining.find((i: any) => i.id === created.id)).toBeUndefined();
  });

  test("rejeita criar sem campos obrigatórios", async ({ request }) => {
    const headers = await getAuthHeaders(request);
    const r = await request.post(
      `${API_URL}/api/financial/participant-events`,
      { headers, data: { project_id: projectId } }
    );
    expect(r.status()).toBeGreaterThanOrEqual(400);
  });
});
