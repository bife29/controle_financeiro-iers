import { test, expect } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";

const FORMATS: Array<"pdf" | "xlsx"> = ["pdf", "xlsx"];

const ENDPOINTS = [
  { path: "/api/reports/cashbook", name: "Livro Caixa" },
  { path: "/api/reports/by-category", name: "Por Categoria" },
  { path: "/api/reports/by-project", name: "Por Projeto" },
  { path: "/api/reports/projects-by-member", name: "Pagamentos por Membro" },
  { path: "/api/reports/payables-receivables", name: "A Pagar / A Receber" },
];

test.describe("Relatórios — geração de arquivos", () => {
  for (const ep of ENDPOINTS) {
    for (const fmt of FORMATS) {
      test(`${ep.name} gera ${fmt.toUpperCase()}`, async ({ request }) => {
        const headers = await getAuthHeaders(request);
        const res = await request.get(ep.path, {
          headers,
          params: { format: fmt, start: "2020-01-01", end: "2030-12-31" },
        });
        expect(res.ok()).toBeTruthy();

        const ct = res.headers()["content-type"] || "";
        if (fmt === "pdf") {
          expect(ct).toContain("application/pdf");
        } else {
          expect(ct).toContain(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );
        }

        const buf = await res.body();
        // Conteúdo mínimo: PDF ~1KB, XLSX ~3KB
        expect(buf.length).toBeGreaterThan(500);

        // Magic numbers
        if (fmt === "pdf") {
          expect(buf.slice(0, 4).toString()).toBe("%PDF");
        } else {
          // XLSX é um zip → começa com PK
          expect(buf[0]).toBe(0x50);
          expect(buf[1]).toBe(0x4b);
        }

        // Header de download
        const cd = res.headers()["content-disposition"] || "";
        expect(cd).toContain("attachment");
        expect(cd).toContain(`.${fmt}`);
      });
    }
  }

  test("format inválido retorna 400", async ({ request }) => {
    const headers = await getAuthHeaders(request);
    const res = await request.get("/api/reports/cashbook", {
      headers,
      params: { format: "csv" },
    });
    expect(res.status()).toBe(400);
  });

  test("sem token retorna 401", async ({ request }) => {
    const res = await request.get("/api/reports/cashbook", {
      params: { format: "pdf" },
    });
    expect(res.status()).toBe(401);
  });
});
