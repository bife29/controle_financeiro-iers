import { test, expect } from "@playwright/test";
import { getAuthHeaders, getAuthToken, API_URL } from "../../helpers/auth";
import { tag, tagEmail } from "../../helpers/e2e-tag";

/**
 * Regressão: contrato do endpoint /api/admin/reset-data (Jéssica jun/2026).
 *
 * O endpoint apaga TODOS os dados operacionais preservando usuários, membros
 * e configurações da igreja. Como é altamente destrutivo, este teste só roda
 * com opt-in explícito via env var:
 *
 *   E2E_ALLOW_RESET_DATA=true npx playwright test --grep "reset-data"
 *
 * NUNCA usar em produção (o backend exige ALLOW_PROD_DATA_WIPE também).
 */

const ALLOW_RESET = process.env.E2E_ALLOW_RESET_DATA === "true";

test.describe("Admin - reset-data (regressão Jéssica jun/2026)", () => {
  test.skip(!ALLOW_RESET, "destrutivo — defina E2E_ALLOW_RESET_DATA=true para rodar");
  test.describe.configure({ mode: "serial" });

  let adminHeaders: Record<string, string>;
  let viewerHeaders: Record<string, string>;
  let createdMemberId: number;
  let createdTransactionId: number;

  test.beforeAll(async ({ request }) => {
    adminHeaders = await getAuthHeaders(request);

    // Cria usuário "viewer" para checar bloqueio de RBAC
    const email = tagEmail("reset-viewer");
    const password = "Senha@123!";
    const c = await request.post(`${API_URL}/api/auth/register`, {
      headers: adminHeaders,
      data: { name: tag("Viewer Reset"), email, password, role: "viewer" },
    });
    expect(c.ok()).toBeTruthy();
    const tok = await getAuthToken(request, email, password);
    viewerHeaders = { Authorization: `Bearer ${tok.access_token}` };

    // Cria dado para checar que sobrevive (membro) e dado que deve sumir (transação).
    const m = await request.post("/api/members/", {
      headers: adminHeaders,
      data: { name: tag(`Membro Sobrevivente ${Date.now()}`) },
    });
    expect(m.ok()).toBeTruthy();
    createdMemberId = (await m.json()).id;

    const projectsResp = await request.get("/api/financial/projects", { headers: adminHeaders });
    const projects = await projectsResp.json();
    const project = projects[0];
    expect(project).toBeTruthy();

    const t = await request.post("/api/financial/transactions", {
      headers: adminHeaders,
      data: {
        date: "2026-06-01",
        type: "Entrada",
        value: 50.0,
        description: tag(`Tx Pre-Reset ${Date.now()}`),
        status: "Confirmado",
        payment_date: "2026-06-01",
        project_id: project.id,
      },
    });
    expect(t.ok()).toBeTruthy();
    createdTransactionId = (await t.json()).id;
  });

  test("Sem confirmação correta → 400", async ({ request }) => {
    const r = await request.post(`${API_URL}/api/admin/reset-data`, {
      headers: adminHeaders,
      data: { confirm: "errado" },
    });
    expect(r.status()).toBe(400);
  });

  test("Usuário não-admin é bloqueado com 403", async ({ request }) => {
    const r = await request.post(`${API_URL}/api/admin/reset-data`, {
      headers: viewerHeaders,
      data: { confirm: "LIMPAR TUDO" },
    });
    expect(r.status()).toBe(403);
  });

  test("Reset com confirmação correta apaga dados e preserva usuários/membros", async ({ request }) => {
    const r = await request.post(`${API_URL}/api/admin/reset-data`, {
      headers: adminHeaders,
      data: { confirm: "LIMPAR TUDO" },
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.preserved).toBeDefined();
    expect(body.preserved.users).toBeGreaterThan(0);
    expect(body.preserved.members).toBeGreaterThan(0);
    expect(body.deleted_counts).toBeDefined();
    expect(body.seeded.projects).toBe(1);
    expect(body.seeded.categories).toBeGreaterThan(0);

    // Membro continua existindo
    const m = await request.get(`/api/members/${createdMemberId}`, { headers: adminHeaders });
    expect(m.ok()).toBeTruthy();

    // Transação foi apagada
    const tx = await request.get(`/api/financial/transactions/by-id/${createdTransactionId}`, {
      headers: adminHeaders,
    });
    expect(tx.status()).toBe(404);

    // Projeto padrão e categorias foram re-semeadas
    const projects = await (await request.get("/api/financial/projects", { headers: adminHeaders })).json();
    expect(projects.length).toBeGreaterThanOrEqual(1);
    const categories = await (await request.get("/api/financial/categories", { headers: adminHeaders })).json();
    expect(categories.length).toBeGreaterThanOrEqual(10);
  });
});
