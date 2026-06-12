import { test, expect } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Regressão (relato Jéssica, jun/2026):
 *
 * "Permitir editar membro vinculado, por exemplo se errar o valor acordado
 *  e quiser editar, hoje da foma como está não é possivel editar, só tem a
 *  opção de excluir o membro e lançar novamente, o ideal é permitir editar,
 *  para não perder registros de lançamento de pagamentos que possam estar
 *  lançados até o momento."
 *
 * O backend já tinha PUT /api/retreats/participants/{id} mas a UI não expunha
 * o botão. Este teste cobre o contrato do endpoint para garantir que o ajuste
 * preserva o carnê (parcelas e pagamentos) já cadastrado.
 */

test.describe("Retiro - editar participante preservando carnê (regressão Jéssica jun/2026)", () => {
  test.describe.configure({ mode: "serial" });

  let headers: Record<string, string>;
  let retreatId: number;
  let participantId: number;
  let firstPaymentId: number;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);

    // Cria retiro
    const ret = await request.post("/api/retreats/", {
      headers,
      data: {
        name: tag(`Retiro Edit ${Date.now()}`),
        description: tag("Editar participante sem perder carnê"),
        location: "Local Teste",
        start_date: "2026-09-01",
        end_date: "2026-09-03",
        max_participants: 30,
        cost_adult: 300.0,
        cost_child: 150.0,
        total_budget: 5000.0,
      },
    });
    expect(ret.ok()).toBeTruthy();
    retreatId = (await ret.json()).id;

    // Inscreve participante com 3 parcelas
    const memberResp = await request.post("/api/members/", {
      headers,
      data: { name: tag(`Edit Particip ${Date.now()}`) },
    });
    const member = await memberResp.json();

    const ins = await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: {
        retreat_id: retreatId,
        member_id: member.id,
        name: member.name,
        is_member: true,
        participant_type: "adulto",
        installments_count: 3,
      },
    });
    expect(ins.ok()).toBeTruthy();
    const p = await ins.json();
    participantId = p.id;
    expect(p.individual_cost).toBe(300.0);

    // Confirma que o carnê foi criado com 3 parcelas
    const pays = await request.get(
      `/api/retreats/participants/${participantId}/payments`,
      { headers }
    );
    expect(pays.ok()).toBeTruthy();
    const payments = await pays.json();
    expect(payments.length).toBe(3);
    firstPaymentId = payments[0].id;
  });

  test("PUT /api/retreats/participants/{id} edita individual_cost", async ({ request }) => {
    // Caso da Jéssica: errou o valor (300) e quer ajustar para 350 sem perder carnê.
    const upd = await request.put(`/api/retreats/participants/${participantId}`, {
      headers,
      data: { individual_cost: 350.0 },
    });
    expect(upd.ok()).toBeTruthy();
    const body = await upd.json();
    expect(body.individual_cost).toBe(350.0);
    // Demais campos preservados
    expect(body.id).toBe(participantId);
    expect(body.participant_type).toBe("adulto");
    expect(body.installments_count).toBe(3);
  });

  test("Parcelas do carnê continuam intactas após edição", async ({ request }) => {
    // Anti-regressão: o fluxo de "excluir + recadastrar" perdia pagamentos.
    // Aqui garantimos que editar NÃO recria nem deleta o carnê.
    const pays = await request.get(
      `/api/retreats/participants/${participantId}/payments`,
      { headers }
    );
    expect(pays.ok()).toBeTruthy();
    const payments = await pays.json();
    expect(payments.length).toBe(3);
    // Primeira parcela ainda é a mesma (mesmo id) → carnê preservado
    expect(payments[0].id).toBe(firstPaymentId);
  });

  test("Edição parcial respeita exclude_unset (não zera campos não enviados)", async ({ request }) => {
    // Manda só nome e participant_type — não deve sobrescrever individual_cost para None.
    const upd = await request.put(`/api/retreats/participants/${participantId}`, {
      headers,
      data: { name: tag("Nome Atualizado"), participant_type: "adulto" },
    });
    expect(upd.ok()).toBeTruthy();
    const body = await upd.json();
    expect(body.name).toBe(tag("Nome Atualizado"));
    expect(body.individual_cost).toBe(350.0); // preservado do teste anterior
  });

  test("PUT em participante inexistente retorna 404", async ({ request }) => {
    const r = await request.put(`/api/retreats/participants/999999999`, {
      headers,
      data: { participant_type: "adulto" },
    });
    expect(r.status()).toBe(404);
  });
});
