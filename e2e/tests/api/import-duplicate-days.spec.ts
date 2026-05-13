import { test, expect } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Regressão Ajuste 9 — janela de duplicidade configurável (duplicate_days).
 *
 * Antes: backend usava 3 dias hardcoded para casar Previstos/duplicatas.
 * Agora: param Form `duplicate_days` (0..30, default 3) é aceito por
 * POST /api/financial/import e usado em todas as comparações.
 *
 * Estratégia: criar um Previsto com data fixa e importar um CSV com
 * mesmo valor numa data 5 dias depois.
 *  - duplicate_days=3 ⇒ não casa (vai como linha nova)
 *  - duplicate_days=10 ⇒ casa (matches_previstos)
 *  - duplicate_days=99 ⇒ 422
 */
test.describe("Import - duplicate_days configurável (Ajuste 9)", () => {
  let headers: Record<string, string>;
  let projectId: number;
  const previstoDate = "2027-07-01";
  const importDate = "2027-07-06"; // +5 dias

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
    const proj = await request.post("/api/financial/projects", {
      headers,
      data: { name: tag("Dup-Days Proj"), start_date: previstoDate },
    });
    projectId = (await proj.json()).id;

    // Cria 1 Previsto Entrada R$ 137,77 em previstoDate
    const r = await request.post("/api/financial/transactions", {
      headers,
      data: {
        date: previstoDate,
        type: "Entrada",
        value: 137.77,
        description: tag("Previsto p/ duplicate_days"),
        status: "Previsto",
        project_id: projectId,
      },
    });
    expect(r.ok()).toBeTruthy();
  });

  function csvBody(date: string) {
    return `Data,Valor,Descrição\n${date},137.77,${tag("CSV Dup-Days")}`;
  }

  test("duplicate_days=3 NÃO casa o Previsto (data fora da janela)", async ({ request }) => {
    const res = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: {
          name: "dup3.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csvBody(importDate), "utf-8"),
        },
        project_id: String(projectId),
        duplicate_days: "3",
      },
    });
    expect(res.ok()).toBeTruthy();
    const r = await res.json();
    expect(r.total_matches_previstos).toBe(0);
    expect(r.total_importado).toBe(1);
  });

  test("duplicate_days=10 CASA o Previsto (data dentro da janela)", async ({ request }) => {
    const res = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: {
          name: "dup10.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csvBody(importDate), "utf-8"),
        },
        project_id: String(projectId),
        duplicate_days: "10",
      },
    });
    expect(res.ok()).toBeTruthy();
    const r = await res.json();
    expect(r.total_matches_previstos).toBe(1);
    expect(r.matches_previstos[0].previsto.value).toBe(137.77);
    expect(r.total_importado).toBe(0);
  });

  test("duplicate_days=99 retorna 422 (fora do range 0..30)", async ({ request }) => {
    const res = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: {
          name: "dup99.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csvBody(importDate), "utf-8"),
        },
        project_id: String(projectId),
        duplicate_days: "99",
      },
    });
    expect(res.status()).toBe(422);
  });
});
