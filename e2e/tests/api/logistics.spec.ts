import { test, expect } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";

test.describe("Retiros - Logística (Ônibus/Camas/Fila de Espera)", () => {
  let headers: Record<string, string>;
  let retreatId: number;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
  });

  test.describe.configure({ mode: "serial" });

  // ============ SETUP: RETIRO COM CAPACIDADES ============

  test("cria retiro com bus_capacity=3 e bed_capacity=3", async ({ request }) => {
    const response = await request.post("/api/retreats/", {
      headers,
      data: {
        name: `Logística E2E ${Date.now()}`,
        start_date: "2026-09-01",
        end_date: "2026-09-03",
        max_participants: 10,
        bus_capacity: 3,
        bed_capacity: 3,
        cost_adult: 200.0,
        cost_child: 100.0,
        total_budget: 5000.0,
      },
    });

    expect(response.ok()).toBeTruthy();
    const retreat = await response.json();
    retreatId = retreat.id;
    expect(retreat.bus_capacity).toBe(3);
    expect(retreat.bed_capacity).toBe(3);
  });

  // ============ INSCRIÇÃO COM OPÇÕES DE BUS/BED ============

  test("inscreve participante 1 com bus=Sim, bed=Sim → Confirmado", async ({ request }) => {
    const response = await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: {
        retreat_id: retreatId,
        name: "P1 - Bus Sim Bed Sim",
        is_member: false,
        participant_type: "adulto",
        bus_option: "Sim",
        bed_option: "Sim",
        installments_count: 1,
      },
    });

    expect(response.ok()).toBeTruthy();
    const p = await response.json();
    expect(p.inscription_status).toBe("Confirmado");
    expect(p.bus_option).toBe("Sim");
    expect(p.bed_option).toBe("Sim");
  });

  test("inscreve participante 2 com bus=Sim, bed=Sim → Confirmado", async ({ request }) => {
    const response = await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: {
        retreat_id: retreatId,
        name: "P2 - Bus Sim Bed Sim",
        is_member: false,
        participant_type: "adulto",
        bus_option: "Sim",
        bed_option: "Sim",
        installments_count: 1,
      },
    });

    expect(response.ok()).toBeTruthy();
    const p = await response.json();
    expect(p.inscription_status).toBe("Confirmado");
  });

  test("inscreve participante 3 com bus=Colo, bed=Divide → Confirmado", async ({ request }) => {
    const response = await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: {
        retreat_id: retreatId,
        name: "P3 - Bus Colo Bed Divide",
        is_member: false,
        participant_type: "crianca",
        bus_option: "Colo",
        bed_option: "Divide",
        installments_count: 1,
      },
    });

    expect(response.ok()).toBeTruthy();
    const p = await response.json();
    expect(p.inscription_status).toBe("Confirmado");
    expect(p.bus_option).toBe("Colo");
    expect(p.bed_option).toBe("Divide");
  });

  test("inscreve participante 4 com bus=Sim → vai para Espera (bus cheio)", async ({ request }) => {
    // 3 lugares de ônibus já ocupados (P1=Sim, P2=Sim, P3=Colo conta como lugar)
    const response = await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: {
        retreat_id: retreatId,
        name: "P4 - Espera Bus",
        is_member: false,
        participant_type: "adulto",
        bus_option: "Sim",
        bed_option: "Não",
        installments_count: 1,
      },
    });

    expect(response.ok()).toBeTruthy();
    const p = await response.json();
    expect(p.inscription_status).toBe("Espera");
  });

  test("inscreve participante 5 sem bus (Não) → Confirmado", async ({ request }) => {
    // Não precisa de ônibus, então entra direto
    const response = await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: {
        retreat_id: retreatId,
        name: "P5 - Sem Bus",
        is_member: false,
        participant_type: "adulto",
        bus_option: "Não",
        bed_option: "Não",
        installments_count: 1,
      },
    });

    expect(response.ok()).toBeTruthy();
    const p = await response.json();
    expect(p.inscription_status).toBe("Confirmado");
  });

  // ============ DASHBOARD COM LOGÍSTICA ============

  test("dashboard retorna métricas de logística", async ({ request }) => {
    const response = await request.get(`/api/retreats/${retreatId}/dashboard`, { headers });

    expect(response.ok()).toBeTruthy();
    const d = await response.json();

    // Contagens básicas
    expect(d.total_participants).toBeGreaterThanOrEqual(4); // Confirmados
    expect(d.waiting_count).toBeGreaterThanOrEqual(1);

    // Logística de ônibus (campo aninhado)
    const lg = d.logistics;
    expect(lg).toBeDefined();
    expect(lg.bus_capacity).toBe(3);
    expect(lg.bus_occupied).toBeGreaterThanOrEqual(2); // P1=Sim, P2=Sim
    expect(lg.bus_sim_count).toBeGreaterThanOrEqual(2);
    expect(lg.bus_colo_count).toBeGreaterThanOrEqual(1); // P3=Colo

    // Logística de camas
    expect(lg.bed_capacity).toBe(3);
    expect(lg.bed_occupied).toBeGreaterThanOrEqual(2); // P1=Sim, P2=Sim
    expect(lg.bed_sim_count).toBeGreaterThanOrEqual(2);
    expect(lg.bed_divide_count).toBeGreaterThanOrEqual(1); // P3=Divide
  });

  // ============ PROMOÇÃO AUTOMÁTICA ============

  test("remover participante confirmado promove da fila de espera", async ({ request }) => {
    // Buscar P1 para remover
    const listResp = await request.get(`/api/retreats/${retreatId}/participants`, { headers });
    const participants = await listResp.json();
    const p1 = participants.find((p: any) => p.name === "P1 - Bus Sim Bed Sim");
    expect(p1).toBeDefined();

    // Remover P1 (libera 1 lugar de ônibus)
    const delResp = await request.delete(`/api/retreats/participants/${p1.id}`, { headers });
    expect(delResp.ok()).toBeTruthy();

    // P4 deve ter sido promovido para Confirmado
    const listAfter = await request.get(`/api/retreats/${retreatId}/participants`, { headers });
    const afterParticipants = await listAfter.json();
    const p4 = afterParticipants.find((p: any) => p.name === "P4 - Espera Bus");
    expect(p4).toBeDefined();
    expect(p4.inscription_status).toBe("Confirmado");
  });

  test("aumentar bus_capacity promove participantes em espera", async ({ request }) => {
    // Colocar mais um na espera
    await request.post(`/api/retreats/${retreatId}/participants`, {
      headers,
      data: {
        retreat_id: retreatId,
        name: "P6 - Nova Espera",
        is_member: false,
        participant_type: "adulto",
        bus_option: "Sim",
        bed_option: "Não",
        installments_count: 1,
      },
    });

    // Verificar que P6 está em espera
    const listBefore = await request.get(`/api/retreats/${retreatId}/participants?inscription_status=Espera`, { headers });
    const waitingBefore = await listBefore.json();
    const p6Before = waitingBefore.find((p: any) => p.name === "P6 - Nova Espera");
    expect(p6Before).toBeDefined();

    // Aumentar capacidade do ônibus
    const updateResp = await request.put(`/api/retreats/${retreatId}`, {
      headers,
      data: { bus_capacity: 5 },
    });
    expect(updateResp.ok()).toBeTruthy();

    // P6 deve ter sido promovido
    const listAfter = await request.get(`/api/retreats/${retreatId}/participants`, { headers });
    const afterAll = await listAfter.json();
    const p6After = afterAll.find((p: any) => p.name === "P6 - Nova Espera");
    expect(p6After).toBeDefined();
    expect(p6After.inscription_status).toBe("Confirmado");
  });

  // ============ FILTRO POR INSCRIPTION_STATUS ============

  test("GET filtra participantes por inscription_status=Confirmado", async ({ request }) => {
    const response = await request.get(
      `/api/retreats/${retreatId}/participants?inscription_status=Confirmado`,
      { headers }
    );

    expect(response.ok()).toBeTruthy();
    const confirmed = await response.json();
    expect(confirmed.length).toBeGreaterThanOrEqual(3);
    expect(confirmed.every((p: any) => p.inscription_status === "Confirmado")).toBe(true);
  });
});
