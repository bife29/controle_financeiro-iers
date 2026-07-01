import { test, expect } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Regressão (relato Jéssica, jun/2026):
 * "como ficam as cobranças das crianças, preciso contabilizar e constar na
 *  lista, mas o pagamento é feito pelos pais."
 *
 * Solução implementada: cada participante criança pode ter um
 * responsible_participant_id apontando para um adulto do MESMO retiro, e o
 * GET de listagem retorna também responsible_name para exibir na UI.
 * A criança continua contando no total de participantes e no dashboard.
 */
test.describe("Retiros - Responsável de pagamento (crianças)", () => {
  let headers: Record<string, string>;
  let retreatId: number;
  let otherRetreatId: number;
  let adultId: number;
  let otherAdultId: number;
  let childId: number;

  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);

    // Retiro principal do cenário
    const r1 = await request.post("/api/retreats/", {
      headers,
      data: {
        name: tag(`Retiro Responsável ${Date.now()}`),
        description: tag("Regressão criança-responsável"),
        location: "Local Teste",
        start_date: "2026-10-01",
        end_date: "2026-10-03",
        max_participants: 30,
        cost_adult: 300.0,
        cost_child: 150.0,
        total_budget: 5000.0,
      },
    });
    expect(r1.ok()).toBeTruthy();
    retreatId = (await r1.json()).id;

    // Segundo retiro (para testar validação cross-retreat)
    const r2 = await request.post("/api/retreats/", {
      headers,
      data: {
        name: tag(`Retiro Outro ${Date.now()}`),
        description: tag("Regressão criança-responsável 2"),
        location: "Local Teste 2",
        start_date: "2026-11-01",
        end_date: "2026-11-03",
        max_participants: 30,
        cost_adult: 300.0,
        cost_child: 150.0,
        total_budget: 5000.0,
      },
    });
    expect(r2.ok()).toBeTruthy();
    otherRetreatId = (await r2.json()).id;

    // Adulto no retiro principal (potencial responsável)
    const adultResp = await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: {
        retreat_id: retreatId,
        name: tag("Pai Responsável"),
        is_member: false,
        participant_type: "adulto",
        installments_count: 3,
      },
    });
    expect(adultResp.ok()).toBeTruthy();
    adultId = (await adultResp.json()).id;

    // Adulto em outro retiro (usado para testar cross-retreat)
    const otherAdultResp = await request.post(
      `/api/retreats/${otherRetreatId}/participants`,
      {
        headers,
        data: {
          retreat_id: otherRetreatId,
          name: tag("Adulto Outro Retiro"),
          is_member: false,
          participant_type: "adulto",
          installments_count: 1,
        },
      }
    );
    expect(otherAdultResp.ok()).toBeTruthy();
    otherAdultId = (await otherAdultResp.json()).id;
  });

  test("POST cria criança com responsible_participant_id apontando para o pai", async ({
    request,
  }) => {
    const response = await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: {
        retreat_id: retreatId,
        name: tag("Filho da Família"),
        is_member: false,
        participant_type: "crianca",
        installments_count: 0,
        payment_status: "Isento",
        responsible_participant_id: adultId,
      },
    });
    expect(response.ok()).toBeTruthy();

    const child = await response.json();
    childId = child.id;
    expect(child.responsible_participant_id).toBe(adultId);
    expect(child.participant_type).toBe("crianca");
  });

  test("GET lista participantes com responsible_name preenchido", async ({ request }) => {
    const response = await request.get(`/api/retreats/${retreatId}/participants`, {
      headers,
    });
    expect(response.ok()).toBeTruthy();

    const list = await response.json();
    const child = list.find((p: { id: number }) => p.id === childId);
    expect(child).toBeDefined();
    expect(child.responsible_participant_id).toBe(adultId);
    // O responsible_name deve vir populado com o nome do adulto (tag inclusa)
    expect(typeof child.responsible_name).toBe("string");
    expect(child.responsible_name.length).toBeGreaterThan(0);
    expect(child.responsible_name).toContain("Pai Responsável");

    // Criança continua no total (contabiliza)
    const adult = list.find((p: { id: number }) => p.id === adultId);
    expect(adult).toBeDefined();
    expect(adult.responsible_name).toBeNull();
  });

  test("POST rejeita responsible_participant_id de outro retiro", async ({ request }) => {
    const response = await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: {
        retreat_id: retreatId,
        name: tag("Filho Erro Cross-Retiro"),
        is_member: false,
        participant_type: "crianca",
        installments_count: 0,
        payment_status: "Isento",
        responsible_participant_id: otherAdultId,
      },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(String(body.detail).toLowerCase()).toContain("retiro");
  });

  test("POST rejeita responsible_participant_id inexistente", async ({ request }) => {
    const response = await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: {
        retreat_id: retreatId,
        name: tag("Filho Erro Inexistente"),
        is_member: false,
        participant_type: "crianca",
        installments_count: 0,
        payment_status: "Isento",
        responsible_participant_id: 999_999_999,
      },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(String(body.detail).toLowerCase()).toContain("respons");
  });

  test("PUT permite trocar responsável para outro adulto do mesmo retiro", async ({
    request,
  }) => {
    // Cria segundo adulto no MESMO retiro
    const adult2Resp = await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: {
        retreat_id: retreatId,
        name: tag("Mãe Responsável"),
        is_member: false,
        participant_type: "adulto",
        installments_count: 1,
      },
    });
    expect(adult2Resp.ok()).toBeTruthy();
    const adult2Id = (await adult2Resp.json()).id;

    const upd = await request.put(`/api/retreats/participants/${childId}`, {
      headers,
      data: { responsible_participant_id: adult2Id },
    });
    expect(upd.ok()).toBeTruthy();
    const updated = await upd.json();
    expect(updated.responsible_participant_id).toBe(adult2Id);
  });

  test("PUT rejeita responsável = próprio participante (auto-referência)", async ({
    request,
  }) => {
    const upd = await request.put(`/api/retreats/participants/${childId}`, {
      headers,
      data: { responsible_participant_id: childId },
    });
    expect(upd.status()).toBe(400);
  });

  test("PUT permite limpar responsável (null)", async ({ request }) => {
    const upd = await request.put(`/api/retreats/participants/${childId}`, {
      headers,
      data: { responsible_participant_id: null },
    });
    expect(upd.ok()).toBeTruthy();
    const updated = await upd.json();
    expect(updated.responsible_participant_id).toBeNull();

    // Confirma via listagem
    const listResp = await request.get(`/api/retreats/${retreatId}/participants`, {
      headers,
    });
    const list = await listResp.json();
    const child = list.find((p: { id: number }) => p.id === childId);
    expect(child.responsible_participant_id).toBeNull();
    expect(child.responsible_name).toBeNull();
  });
});
