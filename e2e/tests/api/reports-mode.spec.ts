import { test, expect } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Regressão Ajuste 7 — modo Sintético vs Analítico em by-category e by-project.
 *
 * - Default `mode=analytic` mantém o comportamento antigo (subtotais por
 *   grupo + lista detalhada), garantindo compatibilidade.
 * - `mode=synthetic` produz somente uma linha por grupo (categoria/projeto)
 *   com Qtd, Entradas, Saídas e Saldo.
 *
 * Como os arquivos retornados são binários (PDF/XLSX zipado), a regressão
 * verifica:
 *   - status 200 com mode=synthetic e XLSX válido (magic PK)
 *   - mode inválido devolve 422 (Pydantic rejeita pelo pattern)
 *   - filename muda para "*-sintetico-*" no Content-Disposition
 */
test.describe("Relatórios — modo sintético/analítico (Ajuste 7)", () => {
  let projAId: number;
  let catAId: number;
  let headers: Record<string, string>;
  const today = new Date().toISOString().slice(0, 10);

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
    const projA = await request.post(`${API_URL}/api/financial/projects`, {
      headers,
      data: { name: tag("Synth Proj"), start_date: today },
    });
    projAId = (await projA.json()).id;
    const catA = await request.post(`${API_URL}/api/financial/categories`, {
      headers,
      data: { name: tag("Synth Cat"), type: "Entrada", nature: "Variável" },
    });
    catAId = (await catA.json()).id;
    await request.post(`${API_URL}/api/financial/transactions`, {
      headers,
      data: {
        date: today,
        type: "Entrada",
        value: 99,
        description: tag("Synth tx"),
        status: "Confirmado",
        project_id: projAId,
        category_id: catAId,
      },
    });
  });

  for (const ep of [
    { path: "/api/reports/by-category", base: "relatorio-por-categoria" },
    { path: "/api/reports/by-project", base: "relatorio-por-projeto" },
  ]) {
    test(`${ep.path} aceita mode=synthetic e nomeia arquivo "${ep.base}-sintetico-*"`, async ({ request }) => {
      const res = await request.get(`${API_URL}${ep.path}`, {
        headers,
        params: { mode: "synthetic", format: "xlsx", start: "2020-01-01", end: "2030-12-31" },
      });
      expect(res.ok()).toBeTruthy();
      const cd = res.headers()["content-disposition"] || "";
      expect(cd).toContain(`${ep.base}-sintetico-`);
      const buf = await res.body();
      expect(buf[0]).toBe(0x50); // P
      expect(buf[1]).toBe(0x4b); // K
    });

    test(`${ep.path} mantém comportamento default (analytic)`, async ({ request }) => {
      const res = await request.get(`${API_URL}${ep.path}`, {
        headers,
        params: { format: "xlsx", start: "2020-01-01", end: "2030-12-31" },
      });
      expect(res.ok()).toBeTruthy();
      const cd = res.headers()["content-disposition"] || "";
      // Filename do analytic NÃO contém "sintetico"
      expect(cd).not.toContain("sintetico");
    });

    test(`${ep.path} mode inválido retorna 422`, async ({ request }) => {
      const res = await request.get(`${API_URL}${ep.path}`, {
        headers,
        params: { mode: "blablabla", format: "xlsx" },
      });
      expect(res.status()).toBe(422);
    });
  }
});
