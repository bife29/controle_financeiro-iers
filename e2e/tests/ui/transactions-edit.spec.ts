import { test, expect, Page } from "@playwright/test";
import { getAuthHeaders, API_URL } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Cobre o bug "date: Input should be a valid date / None":
 *  - cria uma transação via API (estado conhecido)
 *  - abre /financeiro/transacoes/{id}/editar
 *  - salva sem mudar nada
 *  - espera que NÃO retorne erro de validação Pydantic
 *
 * O teste teria pego o bug porque o frontend envia campos opcionais como
 * string vazia ("") quando o usuário não preenche, e Pydantic v2 rejeita
 * com 422 "Input should be a valid date".
 */
async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("seu@email.com").fill(process.env.ADMIN_EMAIL || "admin@iers.org");
  await page.getByPlaceholder("••••••••").fill(process.env.ADMIN_PASSWORD || "admin123");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 10000 });
}

test.describe("Editar Transação - UI", () => {
  let txId: number | null = null;

  test.beforeAll(async ({ request }) => {
    const headers = await getAuthHeaders(request);
    // Pega um projeto existente (seed garante "Geral/Dízimos")
    const projectsResp = await request.get(`${API_URL}/api/financial/projects`, {
      headers,
    });
    const projects = await projectsResp.json();
    expect(projects.length).toBeGreaterThan(0);

    const create = await request.post(`${API_URL}/api/financial/transactions`, {
      headers,
      data: {
        date: new Date().toISOString().slice(0, 10),
        type: "Entrada",
        value: 12.34,
        description: tag("Tx para edição UI"),
        payment_method: "Dinheiro",
        project_id: projects[0].id,
        status: "Previsto",
      },
    });
    expect(create.status(), await create.text()).toBe(200);
    const tx = await create.json();
    txId = tx.id;
  });

  test.afterAll(async ({ request }) => {
    if (txId) {
      const headers = await getAuthHeaders(request);
      await request
        .delete(`${API_URL}/api/financial/transactions/${txId}`, { headers })
        .catch(() => undefined);
    }
  });

  test("salvar edição sem mudar nada NÃO retorna erro de validação", async ({
    page,
  }) => {
    expect(txId).not.toBeNull();
    await loginAsAdmin(page);

    // Captura todas as respostas do PUT da transação (com body para diagnóstico)
    const putResults: { status: number; body: string }[] = [];
    page.on("response", async (resp) => {
      const url = resp.url();
      if (
        resp.request().method() === "PUT" &&
        url.includes(`/api/financial/transactions/${txId}`)
      ) {
        let body = "";
        try {
          body = await resp.text();
        } catch {
          /* ignore */
        }
        putResults.push({ status: resp.status(), body });
      }
    });
    page.on("console", (msg) => {
      if (msg.type() === "error")
        console.log("[console.error]", msg.text());
    });
    page.on("pageerror", (err) =>
      console.log("[pageerror]", err.message)
    );

    // Aguarda a resposta do GET by-id ANTES de continuar (caso contrário o
    // form ainda terá value="" e a validação client-side bloqueia o submit
    // sem disparar o PUT — falso negativo do teste em ambiente com latência).
    const byIdPromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/financial/transactions/by-id/${txId}`) &&
        r.request().method() === "GET" &&
        r.status() === 200,
      { timeout: 15000 }
    );
    await page.goto(`/financeiro/transacoes/${txId}/editar`);
    await byIdPromise;

    // Confirma que o input de Valor foi populado pelo useEffect
    const valueInput = page.locator('input[type="number"]').first();
    await expect(valueInput).not.toHaveValue("", { timeout: 5000 });

    // Clica em Salvar (sem alterar nada)
    await page.getByRole("button", { name: /salvar/i }).click();

    // Aguarda PUT acontecer (independente de redirect)
    await expect.poll(() => putResults.length, { timeout: 10000 }).toBeGreaterThan(0);

    // Garante que NENHUM PUT retornou 422 / 4xx (o bug original era 422)
    for (const r of putResults) {
      expect(
        r.status,
        `PUT retornou ${r.status}. Body: ${r.body}`
      ).toBe(200);
    }

    // Após 200, deve redirecionar para a lista
    await page.waitForURL(/financeiro\/transacoes(?!\/.*\/editar)/, {
      timeout: 10000,
    });
  });
});
