import { test, expect } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

test.describe("Módulo Patrimônio", () => {
  let headers: Record<string, string>;
  let categoryId: number;
  let locationId: number;
  let assetId: number;
  let assetCode: string;
  let maintenanceId: number;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
  });

  test.describe.configure({ mode: "serial" });

  test("GET /api/patrimony/categories lista categorias seedadas", async ({ request }) => {
    const r = await request.get("/api/patrimony/categories", { headers });
    expect(r.ok()).toBeTruthy();
    const list = await r.json();
    expect(Array.isArray(list)).toBeTruthy();
    expect(list.length).toBeGreaterThan(0);
    categoryId = list[0].id;
  });

  test("GET /api/patrimony/locations lista locais seedados", async ({ request }) => {
    const r = await request.get("/api/patrimony/locations", { headers });
    expect(r.ok()).toBeTruthy();
    const list = await r.json();
    expect(list.length).toBeGreaterThan(0);
    locationId = list[0].id;
  });

  test("POST /api/patrimony/categories rejeita duplicado", async ({ request }) => {
    const ts = Date.now();
    const name = tag(`Categoria ${ts}`);
    const r1 = await request.post("/api/patrimony/categories", { headers, data: { name } });
    expect(r1.ok()).toBeTruthy();
    const r2 = await request.post("/api/patrimony/categories", { headers, data: { name } });
    expect(r2.status()).toBe(409);
  });

  test("POST /api/patrimony/ cria bem com código auto PAT-XXXX", async ({ request }) => {
    const r = await request.post("/api/patrimony/", {
      headers,
      data: {
        name: tag(`Bem ${Date.now()}`),
        category_id: categoryId,
        location_id: locationId,
        acquisition_date: "2024-01-15",
        value: 1500.5,
        invoice_number: "NF-12345",
        maintenance_interval_months: 6,
      },
    });
    expect(r.ok()).toBeTruthy();
    const asset = await r.json();
    assetId = asset.id;
    assetCode = asset.code;
    expect(assetCode).toMatch(/^PAT-\d{4}$/);
    expect(asset.status).toBe("active_in_use");
    expect(asset.next_maintenance_due).toBeTruthy();
  });

  test("GET /api/patrimony/?status=active_in_use filtra corretamente", async ({ request }) => {
    const r = await request.get("/api/patrimony/?status=active_in_use", { headers });
    expect(r.ok()).toBeTruthy();
    const list = await r.json();
    expect(list.every((a: any) => a.status === "active_in_use")).toBeTruthy();
  });

  test("POST /api/patrimony/{id}/maintenances envia para manutenção e muda status", async ({ request }) => {
    const r = await request.post(`/api/patrimony/${assetId}/maintenances`, {
      headers,
      data: {
        sent_date: "2024-06-01",
        provider_name: "Loja Teste",
        provider_phone: "(21) 9999-0000",
        provider_deadline: "7 dias úteis",
      },
    });
    expect(r.ok()).toBeTruthy();
    const m = await r.json();
    maintenanceId = m.id;

    const detail = await request.get(`/api/patrimony/${assetId}`, { headers });
    const asset = await detail.json();
    expect(asset.status).toBe("in_maintenance");
    expect(asset.maintenances.length).toBeGreaterThan(0);
  });

  test("POST .../return registra retorno e recalcula próxima manutenção", async ({ request }) => {
    const r = await request.post(
      `/api/patrimony/${assetId}/maintenances/${maintenanceId}/return`,
      {
        headers,
        data: {
          returned_date: "2024-06-08",
          service_warranty_until: "2024-12-08",
          cost: 250.0,
          new_status: "active_in_use",
        },
      },
    );
    expect(r.ok()).toBeTruthy();

    const detail = await request.get(`/api/patrimony/${assetId}`, { headers });
    const asset = await detail.json();
    expect(asset.status).toBe("active_in_use");
    expect(asset.last_maintenance_date).toBe("2024-06-08");
    expect(asset.next_maintenance_due).toBeTruthy();
  });

  test("POST /write-off com reason='other' sem texto retorna 400", async ({ request }) => {
    const r = await request.post(`/api/patrimony/${assetId}/write-off`, {
      headers,
      data: { reason: "other" },
    });
    expect(r.status()).toBe(400);
  });

  test("POST /write-off marca como decommissioned", async ({ request }) => {
    const r = await request.post(`/api/patrimony/${assetId}/write-off`, {
      headers,
      data: { reason: "broken", decommission_date: "2024-07-01" },
    });
    expect(r.ok()).toBeTruthy();

    const detail = await request.get(`/api/patrimony/${assetId}`, { headers });
    const asset = await detail.json();
    expect(asset.status).toBe("decommissioned");
    expect(asset.decommission_reason).toBe("broken");
  });

  test("POST /reactivate limpa decommission_*", async ({ request }) => {
    const r = await request.post(`/api/patrimony/${assetId}/reactivate`, { headers });
    expect(r.ok()).toBeTruthy();
    const asset = await r.json();
    expect(asset.status).toBe("active_in_use");
    expect(asset.decommission_reason).toBeNull();
  });

  test("GET /dashboard/summary retorna estrutura completa", async ({ request }) => {
    const r = await request.get("/api/patrimony/dashboard/summary?days=30", { headers });
    expect(r.ok()).toBeTruthy();
    const dash = await r.json();
    expect(dash).toHaveProperty("total_assets");
    expect(dash).toHaveProperty("total_value");
    expect(dash).toHaveProperty("counts_by_status");
    expect(dash).toHaveProperty("upcoming_maintenance");
    expect(dash).toHaveProperty("upcoming_warranty");
    expect(dash).toHaveProperty("overdue_returns");
    expect(Array.isArray(dash.upcoming_maintenance)).toBeTruthy();
  });

  test("DELETE /api/patrimony/{id} remove o bem de teste", async ({ request }) => {
    const r = await request.delete(`/api/patrimony/${assetId}`, { headers });
    expect(r.ok()).toBeTruthy();
  });
});
