/**
 * Spec: docs/specs/SPEC-003-retiros-listagem-imprimir-e-revalidar.md
 *
 * Valida os 2 modos de impressão da listagem de participantes de retiro:
 *   - Modo Completa (?modo=completa): todas as colunas + observações +
 *     totais no rodapé + coluna "Paga por" para crianças.
 *   - Modo Ônibus (?modo=onibus): apenas nome, tipo, telefone, status.
 *
 * Cobre AC-1 a AC-5 da SPEC-003.
 * (AC-6 é validação manual em produção — feature já existente de
 *  responsible_participant_id + botão editar.)
 */
import { test, expect } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@iers.org";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

test.describe("SPEC-003 — Impressão de listagem de participantes", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 1366, height: 800 } });

  let adminHeaders: Record<string, string>;
  let retreatId: number;
  let adultId: number;
  let childId: number;
  let visitorAdultName: string;
  let childName: string;

  test.beforeAll(async ({ request }) => {
    adminHeaders = await getAuthHeaders(request);

    // Cria um retiro com 2 participantes (1 adulto + 1 criança dependente)
    const rt = await request.post(`${API_URL}/api/retreats/`, {
      headers: adminHeaders,
      data: {
        name: tag(`SPEC-003 Retiro Print ${Date.now()}`),
        description: tag("Retiro para teste de impressão"),
        location: "Chácara Central",
        start_date: "2026-08-15",
        end_date: "2026-08-17",
        max_participants: 30,
        cost_adult: 250.0,
        cost_child: 100.0,
        total_budget: 5000.0,
      },
    });
    expect(rt.ok(), await rt.text()).toBeTruthy();
    retreatId = (await rt.json()).id;

    visitorAdultName = tag(`AdultoPagante-${Date.now()}`);
    childName = tag(`CriancaDep-${Date.now()}`);

    const adult = await request.post(
      `${API_URL}/api/retreats/${retreatId}/participants`,
      {
        headers: adminHeaders,
        data: {
          retreat_id: retreatId,
          name: visitorAdultName,
          phone: "(11) 99999-0001",
          is_member: false,
          participant_type: "adulto",
          installments_count: 2,
          notes: "Observação do adulto",
        },
      }
    );
    expect(adult.ok(), await adult.text()).toBeTruthy();
    adultId = (await adult.json()).id;

    const child = await request.post(
      `${API_URL}/api/retreats/${retreatId}/participants`,
      {
        headers: adminHeaders,
        data: {
          retreat_id: retreatId,
          name: childName,
          phone: "(11) 99999-0002",
          is_member: false,
          participant_type: "crianca",
          installments_count: 0,
          payment_status: "Pendente",
          responsible_participant_id: adultId,
          notes: "Filha do pagante",
        },
      }
    );
    expect(child.ok(), await child.text()).toBeTruthy();
    childId = (await child.json()).id;
  });

  test.afterAll(async ({ request }) => {
    if (childId) {
      await request
        .delete(`${API_URL}/api/retreats/${retreatId}/participants/${childId}`, {
          headers: adminHeaders,
        })
        .catch(() => undefined);
    }
    if (adultId) {
      await request
        .delete(`${API_URL}/api/retreats/${retreatId}/participants/${adultId}`, {
          headers: adminHeaders,
        })
        .catch(() => undefined);
    }
    if (retreatId) {
      await request
        .delete(`${API_URL}/api/retreats/${retreatId}`, {
          headers: adminHeaders,
        })
        .catch(() => undefined);
    }
  });

  async function login(page: any) {
    await page.goto("/");
    await page.getByPlaceholder("seu@email.com").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("••••••••").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.locator("aside")).toBeAttached({ timeout: 15000 });
  }

  test("AC-1 — botão 'Imprimir completa' abre view em nova aba com todas as colunas + totais", async ({
    page,
    context,
  }) => {
    await login(page);

    // Bloqueia window.print() para não emperrar o teste
    await page.addInitScript(() => {
      // @ts-ignore
      window.print = () => undefined;
    });
    await context.addInitScript(() => {
      // @ts-ignore
      window.print = () => undefined;
    });

    await page.goto(`/retiros/${retreatId}/participantes`);

    // Espera a linha do adulto aparecer (nome pode aparecer 2x: na linha
    // própria e no badge "Paga: <adulto>" da linha da criança).
    await expect(page.getByText(visitorAdultName).first()).toBeVisible({
      timeout: 10000,
    });

    // Clica no botão de impressão completa (abre popup)
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.getByTestId("print-completa-button").click(),
    ]);

    await popup.waitForLoadState("domcontentloaded");
    await expect(popup).toHaveURL(
      new RegExp(`/retiros/${retreatId}/participantes/impressao\\?.*modo=completa`)
    );

    // Cabeçalho da view
    await expect(popup.getByTestId("print-view")).toHaveAttribute(
      "data-mode",
      "completa"
    );
    await expect(popup.getByTestId("print-title")).toHaveText(
      "Listagem de Participantes"
    );

    // Tabela completa presente + colunas específicas do modo completa
    const table = popup.getByTestId("print-table-completa");
    await expect(table).toBeVisible();
    await expect(table).toContainText("Paga por");
    await expect(table).toContainText("Ônibus");
    await expect(table).toContainText("Observações");
    // 2 participantes: adulto + criança
    await expect(popup.getByTestId("print-count")).toHaveText("2");

    // Rodapé com totais existentes (esperado, pago, pendente)
    await expect(popup.getByTestId("print-total-expected")).toBeVisible();
    await expect(popup.getByTestId("print-total-paid")).toBeVisible();
    await expect(popup.getByTestId("print-total-pending")).toBeVisible();
  });

  test("AC-2 — botão 'Lista de ônibus' abre view enxuta", async ({
    page,
    context,
  }) => {
    await login(page);
    await context.addInitScript(() => {
      // @ts-ignore
      window.print = () => undefined;
    });

    await page.goto(`/retiros/${retreatId}/participantes`);
    await expect(page.getByText(visitorAdultName).first()).toBeVisible({
      timeout: 10000,
    });

    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.getByTestId("print-onibus-button").click(),
    ]);

    await popup.waitForLoadState("domcontentloaded");
    await expect(popup).toHaveURL(
      new RegExp(`/retiros/${retreatId}/participantes/impressao\\?.*modo=onibus`)
    );
    await expect(popup.getByTestId("print-view")).toHaveAttribute(
      "data-mode",
      "onibus"
    );
    await expect(popup.getByTestId("print-title")).toHaveText("Lista de Ônibus");

    // Modo ônibus: só tabela enxuta, sem totais, sem "Paga por"/"Observações"
    const table = popup.getByTestId("print-table-onibus");
    await expect(table).toBeVisible();
    await expect(table).toContainText("Nome");
    await expect(table).toContainText("Tipo");
    await expect(table).toContainText("Telefone");
    await expect(table).toContainText("Presente");
    await expect(table).not.toContainText("Observações");
    await expect(table).not.toContainText("Paga por");

    // Não tem tabela completa nem totais
    await expect(popup.getByTestId("print-table-completa")).toHaveCount(0);
    await expect(popup.getByTestId("print-total-expected")).toHaveCount(0);

    await expect(popup.getByTestId("print-count")).toHaveText("2");
  });

  test("AC-3 — filtro de busca aplicado é respeitado na impressão via URL param q=", async ({
    page,
    context,
  }) => {
    await login(page);
    await context.addInitScript(() => {
      // @ts-ignore
      window.print = () => undefined;
    });

    await page.goto(`/retiros/${retreatId}/participantes`);
    await expect(page.getByText(visitorAdultName).first()).toBeVisible({
      timeout: 10000,
    });

    // Aplica filtro que casa APENAS com o adulto (nome único)
    await page
      .getByPlaceholder(/buscar participante/i)
      .fill(visitorAdultName);

    // Após filtro, só o adulto aparece na tabela principal
    await expect(page.getByText(childName)).toBeHidden({ timeout: 3000 });

    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.getByTestId("print-completa-button").click(),
    ]);

    await popup.waitForLoadState("domcontentloaded");
    // A URL da nova aba precisa carregar q=<nome do adulto>
    const url = new URL(popup.url());
    expect(url.searchParams.get("q")).toBe(visitorAdultName);

    // Só uma linha na impressão
    await expect(popup.getByTestId("print-count")).toHaveText("1");
    await expect(popup.getByTestId(`print-row-${adultId}`)).toBeVisible();
    await expect(popup.getByTestId(`print-row-${childId}`)).toHaveCount(0);
  });

  test("AC-4 — modo completa mostra 'Paga por: <adulto>' na linha da criança", async ({
    page,
    context,
  }) => {
    await login(page);
    await context.addInitScript(() => {
      // @ts-ignore
      window.print = () => undefined;
    });

    await page.goto(
      `/retiros/${retreatId}/participantes/impressao?modo=completa`
    );

    await expect(page.getByTestId("print-view")).toBeVisible();

    const childRow = page.getByTestId(`print-row-${childId}`);
    await expect(childRow).toBeVisible();
    await expect(childRow).toContainText(childName);
    // A célula "Paga por" mostra o nome do adulto responsável
    await expect(childRow).toContainText(visitorAdultName);
  });

  test("AC-5 — dois botões de impressão estão visíveis na tela de participantes", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`/retiros/${retreatId}/participantes`);
    await expect(page.getByText(visitorAdultName).first()).toBeVisible({
      timeout: 10000,
    });

    await expect(page.getByTestId("print-completa-button")).toBeVisible();
    await expect(page.getByTestId("print-onibus-button")).toBeVisible();
  });
});
