import { test, expect } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";

test.describe("Módulo Retiros - API", () => {
  let headers: Record<string, string>;
  let retreatId: number;
  let participantId: number;
  let paymentId: number;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
  });

  test.describe.configure({ mode: "serial" });

  // ============ CRUD RETIRO ============

  test("GET /api/retreats/ lista retiros", async ({ request }) => {
    const response = await request.get("/api/retreats/", { headers });

    expect(response.ok()).toBeTruthy();
    const retreats = await response.json();
    expect(Array.isArray(retreats)).toBeTruthy();
  });

  test("POST /api/retreats/ cria retiro com valores adulto/criança", async ({ request }) => {
    const retreat = {
      name: `Retiro E2E ${Date.now()}`,
      description: "Retiro de teste automatizado",
      location: "Hotel Fazenda Teste",
      start_date: "2026-08-01",
      end_date: "2026-08-03",
      max_participants: 50,
      cost_adult: 400.0,
      cost_child: 200.0,
      total_budget: 10000.0,
    };

    const response = await request.post("/api/retreats/", {
      headers,
      data: retreat,
    });

    expect(response.ok()).toBeTruthy();

    const created = await response.json();
    retreatId = created.id;
    expect(created.name).toBe(retreat.name);
    expect(created.cost_adult).toBe(400.0);
    expect(created.cost_child).toBe(200.0);
    expect(created.total_budget).toBe(10000.0);
    expect(created.status).toBe("Planejamento");
    // Projeto financeiro criado automaticamente
    expect(created.project_id).toBeDefined();
    expect(created.project_id).toBeGreaterThan(0);
  });

  test("GET /api/retreats/:id retorna retiro por ID", async ({ request }) => {
    const response = await request.get(`/api/retreats/${retreatId}`, { headers });

    expect(response.ok()).toBeTruthy();

    const retreat = await response.json();
    expect(retreat.id).toBe(retreatId);
    expect(retreat.cost_adult).toBe(400.0);
  });

  test("PUT /api/retreats/:id atualiza retiro", async ({ request }) => {
    const response = await request.put(`/api/retreats/${retreatId}`, {
      headers,
      data: { status: "Inscricoes", max_participants: 60 },
    });

    expect(response.ok()).toBeTruthy();

    const updated = await response.json();
    expect(updated.status).toBe("Inscricoes");
    expect(updated.max_participants).toBe(60);
    // Campos não alterados permanecem
    expect(updated.cost_adult).toBe(400.0);
  });

  // ============ PARTICIPANTES ============

  test("POST inscreve participante membro (adulto, 3 parcelas)", async ({ request }) => {
    // Primeiro, criar um membro para inscrever
    const memberResp = await request.post("/api/members/", {
      headers,
      data: { name: `Retirante E2E ${Date.now()}`, cel: "(21) 99999-0000" },
    });
    const member = await memberResp.json();

    const response = await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: {
        retreat_id: retreatId,
        member_id: member.id,
        name: member.name,
        phone: "(21) 99999-0000",
        is_member: true,
        participant_type: "adulto",
        installments_count: 3,
      },
    });

    expect(response.ok()).toBeTruthy();

    const participant = await response.json();
    participantId = participant.id;
    expect(participant.individual_cost).toBe(400.0); // Usa cost_adult automaticamente
    expect(participant.payment_status).toBe("Pendente");
    expect(participant.installments_count).toBe(3);
    expect(participant.is_member).toBe(true);
    expect(participant.participant_type).toBe("adulto");
  });

  test("POST inscreve participante não-membro (criança)", async ({ request }) => {
    const response = await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: {
        retreat_id: retreatId,
        member_id: null,
        name: "Criança Visitante E2E",
        phone: "(11) 88888-7777",
        is_member: false,
        participant_type: "crianca",
        installments_count: 2,
      },
    });

    expect(response.ok()).toBeTruthy();

    const participant = await response.json();
    expect(participant.individual_cost).toBe(200.0); // Usa cost_child automaticamente
    expect(participant.is_member).toBe(false);
    expect(participant.participant_type).toBe("crianca");
    expect(participant.installments_count).toBe(2);
  });

  test("POST inscreve participante isento", async ({ request }) => {
    const response = await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: {
        retreat_id: retreatId,
        name: "Pastor Convidado E2E",
        is_member: false,
        participant_type: "adulto",
        individual_cost: 0,
        payment_status: "Isento",
        installments_count: 0,
      },
    });

    expect(response.ok()).toBeTruthy();

    const participant = await response.json();
    expect(participant.payment_status).toBe("Isento");
    expect(participant.individual_cost).toBe(0);
  });

  test("POST rejeita inscrição duplicada do mesmo membro", async ({ request }) => {
    // Criar membro
    const memberResp = await request.post("/api/members/", {
      headers,
      data: { name: `Duplicado E2E ${Date.now()}` },
    });
    const member = await memberResp.json();

    // Primeira inscrição
    await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: { retreat_id: retreatId, member_id: member.id, is_member: true, participant_type: "adulto", installments_count: 1 },
    });

    // Segunda inscrição (deve falhar)
    const response = await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: { retreat_id: retreatId, member_id: member.id, is_member: true, participant_type: "adulto", installments_count: 1 },
    });

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.detail).toContain("já inscrito");
  });

  test("GET lista participantes do retiro", async ({ request }) => {
    const response = await request.get(`/api/retreats/${retreatId}/participants`, { headers });

    expect(response.ok()).toBeTruthy();

    const participants = await response.json();
    expect(participants.length).toBeGreaterThanOrEqual(3);

    // Verifica que tem membro e não-membro
    const members = participants.filter((p: any) => p.is_member);
    const nonMembers = participants.filter((p: any) => !p.is_member);
    expect(members.length).toBeGreaterThanOrEqual(1);
    expect(nonMembers.length).toBeGreaterThanOrEqual(1);
  });

  test("GET filtra participantes por status de pagamento", async ({ request }) => {
    const response = await request.get(`/api/retreats/${retreatId}/participants?payment_status=Isento`, { headers });

    expect(response.ok()).toBeTruthy();

    const exempt = await response.json();
    expect(exempt.length).toBeGreaterThanOrEqual(1);
    expect(exempt.every((p: any) => p.payment_status === "Isento")).toBe(true);
  });

  // ============ PAGAMENTOS (CARNÊ) ============

  test("GET lista parcelas do participante", async ({ request }) => {
    const response = await request.get(`/api/retreats/participants/${participantId}/payments`, { headers });

    expect(response.ok()).toBeTruthy();

    const payments = await response.json();
    expect(payments.length).toBe(3); // 3 parcelas
    expect(payments[0].installment_number).toBe(1);
    expect(payments[1].installment_number).toBe(2);
    expect(payments[2].installment_number).toBe(3);

    // Cada parcela = 400 / 3 ≈ 133.33
    const parcelaValue = Math.round((400 / 3) * 100) / 100;
    expect(payments[0].value).toBeCloseTo(parcelaValue, 1);
    expect(payments[0].status).toBe("Pendente");

    paymentId = payments[0].id;
  });

  test("POST paga primeira parcela via Pix", async ({ request }) => {
    const response = await request.post(`/api/retreats/payments/${paymentId}/pay`, {
      headers,
      data: {
        paid_date: "2026-05-04",
        status: "Pago",
        payment_method: "Pix",
      },
    });

    expect(response.ok()).toBeTruthy();

    const payment = await response.json();
    expect(payment.status).toBe("Pago");
    expect(payment.paid_date).toBe("2026-05-04");
    expect(payment.payment_method).toBe("Pix");
    // Transação financeira criada
    expect(payment.transaction_id).toBeDefined();
    expect(payment.transaction_id).toBeGreaterThan(0);
  });

  test("POST rejeita pagamento de parcela já paga", async ({ request }) => {
    const response = await request.post(`/api/retreats/payments/${paymentId}/pay`, {
      headers,
      data: { paid_date: "2026-05-04", status: "Pago", payment_method: "Dinheiro" },
    });

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.detail).toContain("já está paga");
  });

  test("participante muda para status Parcial após primeiro pagamento", async ({ request }) => {
    const response = await request.get(`/api/retreats/${retreatId}/participants`, { headers });
    const participants = await response.json();
    const participant = participants.find((p: any) => p.id === participantId);

    expect(participant.payment_status).toBe("Parcial");
    expect(participant.paid_value).toBeGreaterThan(0);
  });

  test("POST paga segunda e terceira parcelas", async ({ request }) => {
    // Buscar parcelas pendentes
    const paymentsResp = await request.get(`/api/retreats/participants/${participantId}/payments`, { headers });
    const payments = await paymentsResp.json();
    const pending = payments.filter((p: any) => p.status === "Pendente");

    expect(pending.length).toBe(2);

    // Pagar ambas
    for (const p of pending) {
      const resp = await request.post(`/api/retreats/payments/${p.id}/pay`, {
        headers,
        data: { paid_date: "2026-05-05", status: "Pago", payment_method: "Dinheiro" },
      });
      expect(resp.ok()).toBeTruthy();
    }
  });

  test("participante muda para status Pago após todas parcelas pagas", async ({ request }) => {
    const response = await request.get(`/api/retreats/${retreatId}/participants`, { headers });
    const participants = await response.json();
    const participant = participants.find((p: any) => p.id === participantId);

    expect(participant.payment_status).toBe("Pago");
    expect(participant.paid_value).toBeCloseTo(400, 0);
  });

  // ============ INTEGRAÇÃO FINANCEIRA ============

  test("pagamentos geram transações no projeto financeiro do retiro", async ({ request }) => {
    // Buscar retiro para pegar project_id
    const retreatResp = await request.get(`/api/retreats/${retreatId}`, { headers });
    const retreat = await retreatResp.json();

    const response = await request.get(
      `/api/financial/transactions?project_id=${retreat.project_id}`,
      { headers }
    );

    expect(response.ok()).toBeTruthy();

    const transactions = await response.json();
    expect(transactions.length).toBeGreaterThanOrEqual(3); // 3 parcelas pagas

    // Todas são entradas com origem "retiro"
    for (const t of transactions) {
      expect(t.type).toBe("Entrada");
      expect(t.imported_from).toBe("retiro");
      expect(t.project_id).toBe(retreat.project_id);
      expect(t.status).toBe("Conciliado");
    }
  });

  // ============ DASHBOARD ============

  test("GET dashboard retorna panorama completo", async ({ request }) => {
    const response = await request.get(`/api/retreats/${retreatId}/dashboard`, { headers });

    expect(response.ok()).toBeTruthy();

    const dashboard = await response.json();
    expect(dashboard.total_participants).toBeGreaterThanOrEqual(3);
    expect(dashboard.adults_count).toBeGreaterThanOrEqual(2);
    expect(dashboard.children_count).toBeGreaterThanOrEqual(1);
    expect(dashboard.members_count).toBeGreaterThanOrEqual(1);
    expect(dashboard.non_members_count).toBeGreaterThanOrEqual(1);
    expect(dashboard.paid_count).toBeGreaterThanOrEqual(1);
    expect(dashboard.exempt_count).toBeGreaterThanOrEqual(1);
    expect(dashboard.total_collected).toBeGreaterThan(0);
    expect(dashboard.total_expected).toBeGreaterThan(0);
    expect(dashboard.total_budget).toBe(10000.0);
    expect(dashboard.balance).toBeDefined();
  });

  // ============ REMOVER PARTICIPANTE ============

  test("DELETE remove participante e seus pagamentos", async ({ request }) => {
    // Inscrever alguém para remover
    const addResp = await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: {
        retreat_id: retreatId,
        name: "Para Remover E2E",
        is_member: false,
        participant_type: "adulto",
        installments_count: 1,
      },
    });
    const toRemove = await addResp.json();

    const response = await request.delete(`/api/retreats/participants/${toRemove.id}`, { headers });

    expect(response.ok()).toBeTruthy();

    // Confirmar que não aparece mais
    const listResp = await request.get(`/api/retreats/${retreatId}/participants`, { headers });
    const participants = await listResp.json();
    const found = participants.find((p: any) => p.id === toRemove.id);
    expect(found).toBeUndefined();
  });

  // ============ SEGURANÇA ============

  test("GET /api/retreats/ sem auth retorna 401", async ({ request }) => {
    const response = await request.get("/api/retreats/");
    expect(response.status()).toBe(401);
  });

  test("GET /api/retreats/:id/participants sem auth retorna 401", async ({ request }) => {
    const response = await request.get(`/api/retreats/${retreatId}/participants`);
    expect(response.status()).toBe(401);
  });
});
