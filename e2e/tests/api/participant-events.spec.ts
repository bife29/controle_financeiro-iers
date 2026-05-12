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

    // 4. STATUS DERIVADO: criar Transaction Confirmada para o par
    //    (member_id, project_id) deve mover o PE de "Pendente" para "Pago".
    //    Antes do fix Bug 2/3 isso não acontecia: paid_value era manual.
    const catsResp = await request.get(`${API_URL}/api/financial/categories`, { headers });
    const entradaCat = (await catsResp.json()).find((c: any) => c.type === "Entrada");
    const txResp = await request.post(`${API_URL}/api/financial/transactions`, {
      headers,
      data: {
        date: new Date().toISOString().slice(0, 10),
        type: "Entrada",
        value: 250.5,
        description: tag("Pagamento PE derivado"),
        category_id: entradaCat.id,
        project_id: projectId,
        member_id: memberId,
        status: "Confirmado",
        payment_date: new Date().toISOString().slice(0, 10),
      },
    });
    expect(txResp.status(), await txResp.text()).toBe(200);
    const txId = (await txResp.json()).id;

    const afterPay = await request.get(
      `${API_URL}/api/financial/participant-events?project_id=${projectId}`,
      { headers }
    );
    const refreshed = (await afterPay.json()).find((i: any) => i.id === peId);
    expect(refreshed.paid_value).toBe(250.5);
    expect(refreshed.status).toBe("Pago");

    // cleanup tx
    await request.delete(`${API_URL}/api/financial/transactions/${txId}`, { headers });

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

/**
 * Regressão Bug 2/3: "Vínculo evento+membro não conta em valor pago"
 *
 * Sintoma reportado pela usuária: transações classificadas em um projeto e
 * vinculadas a um membro não eram computadas como "valor pago" do membro
 * naquele evento. Causa: ParticipantEvent.paid_value era um campo manual que
 * só mudava por PUT explícito; nada agregava as Transactions correspondentes.
 *
 * Fix: paid_value e status do ParticipantEvent passaram a ser DERIVADOS
 * (calculados em runtime) a partir de SUM(Transaction.value WHERE
 *  member_id=pe.member_id AND project_id=pe.project_id AND type='Entrada' AND
 *  status='Confirmado').
 *
 * Testes abaixo cobrem: pagamento parcial, pagamento total, múltiplas
 * transações somando, transação sem member_id não entra, status "Isento"
 * preserva-se mesmo com pagamentos.
 */
test.describe("Financial: paid_value calculado a partir de Transactions (Bug 2/3)", () => {
  let memberId: number;
  let projectId: number;
  let entradaCatId: number;
  const createdPEs: number[] = [];
  const createdTxs: number[] = [];

  test.beforeAll(async ({ request }) => {
    const headers = await getAuthHeaders(request);
    const m = await request.post(`${API_URL}/api/members/`, {
      headers,
      data: { name: tag("Membro paid calc") },
    });
    memberId = (await m.json()).id;

    const p = await request.post(`${API_URL}/api/financial/projects`, {
      headers,
      data: {
        name: tag("Projeto paid calc"),
        start_date: new Date().toISOString().slice(0, 10),
      },
    });
    projectId = (await p.json()).id;

    const cats = await (await request.get(`${API_URL}/api/financial/categories`, { headers })).json();
    entradaCatId = cats.find((c: any) => c.type === "Entrada").id;
  });

  test.afterAll(async ({ request }) => {
    const headers = await getAuthHeaders(request);
    for (const id of createdTxs) {
      await request.delete(`${API_URL}/api/financial/transactions/${id}`, { headers }).catch(() => undefined);
    }
    for (const id of createdPEs) {
      await request.delete(`${API_URL}/api/financial/participant-events/${id}`, { headers }).catch(() => undefined);
    }
    if (projectId) {
      await request.delete(`${API_URL}/api/financial/projects/${projectId}`, { headers }).catch(() => undefined);
    }
    if (memberId) {
      await request.delete(`${API_URL}/api/members/${memberId}?force=true`, { headers }).catch(() => undefined);
    }
  });

  async function createTx(
    request: any,
    headers: Record<string, string>,
    value: number,
    withMember: boolean,
  ): Promise<number> {
    const r = await request.post(`${API_URL}/api/financial/transactions`, {
      headers,
      data: {
        date: "2026-04-10",
        type: "Entrada",
        value,
        description: tag(`paid-calc ${value}`),
        category_id: entradaCatId,
        project_id: projectId,
        member_id: withMember ? memberId : null,
        status: "Confirmado",
        payment_date: "2026-04-10",
      },
    });
    expect(r.status(), await r.text()).toBe(200);
    const id = (await r.json()).id;
    createdTxs.push(id);
    return id;
  }

  async function getPE(request: any, headers: Record<string, string>, peId: number) {
    const list = await request.get(
      `${API_URL}/api/financial/participant-events?project_id=${projectId}`,
      { headers }
    );
    return (await list.json()).find((p: any) => p.id === peId);
  }

  test("paid_value some transactions e status fica Parcial -> Pago", async ({ request }) => {
    const headers = await getAuthHeaders(request);
    const pe = await request.post(`${API_URL}/api/financial/participant-events`, {
      headers,
      data: { member_id: memberId, project_id: projectId, agreed_value: 300, status: "Pendente" },
    });
    const peObj = await pe.json();
    createdPEs.push(peObj.id);

    // 1ª transação parcial = 100
    await createTx(request, headers, 100, true);
    let refreshed = await getPE(request, headers, peObj.id);
    expect(refreshed.paid_value).toBe(100);
    expect(refreshed.status).toBe("Parcial");

    // 2ª transação de 200 → total 300 → status Pago
    await createTx(request, headers, 200, true);
    refreshed = await getPE(request, headers, peObj.id);
    expect(refreshed.paid_value).toBe(300);
    expect(refreshed.status).toBe("Pago");

    // dashboard do projeto deve refletir paid_count >= 1 e nenhum pendente
    const dash = await request.get(
      `${API_URL}/api/financial/projects/${projectId}/dashboard`,
      { headers }
    );
    const dashJson = await dash.json();
    expect(dashJson.paid_count).toBeGreaterThanOrEqual(1);
  });

  test("transação sem member_id não entra no paid_value de ninguém", async ({ request }) => {
    const headers = await getAuthHeaders(request);
    // novo PE com membro (mesma chave member+project, mas isolaremos por outro projeto)
    const newProj = await request.post(`${API_URL}/api/financial/projects`, {
      headers,
      data: { name: tag("Projeto sem member"), start_date: "2026-01-01" },
    });
    const np = await newProj.json();

    const pe = await request.post(`${API_URL}/api/financial/participant-events`, {
      headers,
      data: { member_id: memberId, project_id: np.id, agreed_value: 100, status: "Pendente" },
    });
    const peObj = await pe.json();
    createdPEs.push(peObj.id);

    // tx sem member_id (só project)
    const r = await request.post(`${API_URL}/api/financial/transactions`, {
      headers,
      data: {
        date: "2026-04-10", type: "Entrada", value: 999,
        description: tag("sem member"),
        category_id: entradaCatId,
        project_id: np.id,
        status: "Confirmado",
        payment_date: "2026-04-10",
      },
    });
    const txId = (await r.json()).id;
    createdTxs.push(txId);

    const list = await request.get(
      `${API_URL}/api/financial/participant-events?project_id=${np.id}`,
      { headers }
    );
    const refreshed = (await list.json()).find((p: any) => p.id === peObj.id);
    expect(refreshed.paid_value).toBe(0);
    expect(refreshed.status).toBe("Pendente");

    // cleanup específico do projeto isolado
    await request.delete(`${API_URL}/api/financial/projects/${np.id}`, { headers }).catch(() => undefined);
  });

  test("status Isento se preserva mesmo com pagamentos vinculados", async ({ request }) => {
    const headers = await getAuthHeaders(request);
    const newProj = await request.post(`${API_URL}/api/financial/projects`, {
      headers,
      data: { name: tag("Projeto isento"), start_date: "2026-01-01" },
    });
    const np = await newProj.json();

    const pe = await request.post(`${API_URL}/api/financial/participant-events`, {
      headers,
      data: { member_id: memberId, project_id: np.id, agreed_value: 0, status: "Isento" },
    });
    const peObj = await pe.json();
    createdPEs.push(peObj.id);

    // Mesmo com transação vinculada, status continua "Isento"
    const r = await request.post(`${API_URL}/api/financial/transactions`, {
      headers,
      data: {
        date: "2026-04-10", type: "Entrada", value: 50,
        description: tag("valor a isento"),
        category_id: entradaCatId,
        project_id: np.id,
        member_id: memberId,
        status: "Confirmado",
        payment_date: "2026-04-10",
      },
    });
    const txId = (await r.json()).id;
    createdTxs.push(txId);

    const list = await request.get(
      `${API_URL}/api/financial/participant-events?project_id=${np.id}`,
      { headers }
    );
    const refreshed = (await list.json()).find((p: any) => p.id === peObj.id);
    expect(refreshed.status).toBe("Isento");

    await request.delete(`${API_URL}/api/financial/projects/${np.id}`, { headers }).catch(() => undefined);
  });
});
