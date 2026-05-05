import { test, expect } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";

test.describe("Importação OFX/CSV - API", () => {
  let headers: Record<string, string>;
  let projectId: number;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);

    // Criar projeto para importação
    const projResp = await request.post("/api/financial/projects", {
      headers,
      data: {
        name: `Projeto Import E2E ${Date.now()}`,
        description: "Para testes de importação",
        start_date: "2026-01-01",
      },
    });
    const project = await projResp.json();
    projectId = project.id;
  });

  test.describe.configure({ mode: "serial" });

  // ============ CSV IMPORT ============

  test("POST /api/financial/import aceita CSV válido", async ({ request }) => {
    const csvContent = `Data,Valor,Descrição
2026-03-01,150.00,Dízimo Março - João
2026-03-01,200.00,Oferta Culto Domingo
2026-03-05,-50.00,Compra Material Limpeza
2026-03-10,80.00,Dízimo Março - Maria
2026-03-15,-120.00,Conta de Luz`;

    const response = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: {
          name: "extrato_marco.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csvContent, "utf-8"),
        },
        project_id: String(projectId),
      },
    });

    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    expect(result.preview).toBeDefined();
    expect(result.preview.length).toBe(5);
    expect(result.total_importado).toBe(5);
    expect(result.total_duplicidades).toBe(0);

    // Verifica tipos corretos
    const entradas = result.preview.filter((t: any) => t.type === "Entrada");
    const saidas = result.preview.filter((t: any) => t.type === "Saída");
    expect(entradas.length).toBe(3);
    expect(saidas.length).toBe(2);

    // Verifica campos
    expect(result.preview[0].date).toBe("2026-03-01");
    expect(result.preview[0].value).toBe(150.0);
    expect(result.preview[0].description).toBe("Dízimo Março - João");
    expect(result.preview[0].imported_from).toBe("csv");
    expect(result.preview[0].status).toBe("Previsto");
  });

  test("POST /api/financial/import/confirm salva transações CSV no banco", async ({ request }) => {
    const transactions = [
      { date: "2026-04-01", type: "Entrada", value: 300.0, description: "Dízimo Confirmado E2E", imported_from: "csv" },
      { date: "2026-04-02", type: "Saída", value: 75.0, description: "Despesa Confirmada E2E", imported_from: "csv" },
    ];

    const response = await request.post("/api/financial/import/confirm", {
      headers,
      data: { transactions, project_id: projectId },
    });

    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    expect(result.count).toBe(2);
    expect(result.transactions.length).toBe(2);
    expect(result.transactions[0].id).toBeGreaterThan(0);
  });

  test("CSV importado aparece nas transações do projeto", async ({ request }) => {
    const response = await request.get(
      `/api/financial/transactions?project_id=${projectId}`,
      { headers }
    );

    expect(response.ok()).toBeTruthy();

    const transactions = await response.json();
    const imported = transactions.filter((t: any) => t.imported_from === "csv");
    expect(imported.length).toBeGreaterThanOrEqual(2);
  });

  test("POST /api/financial/import detecta duplicidades CSV", async ({ request }) => {
    // Enviar CSV com mesma transação que já foi confirmada
    const csvDuplicate = `Data,Valor,Descrição
2026-04-01,300.00,Dízimo Confirmado E2E
2026-04-10,500.00,Nova Entrada Abril`;

    const response = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: {
          name: "extrato_duplicado.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csvDuplicate, "utf-8"),
        },
        project_id: String(projectId),
      },
    });

    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    expect(result.total_duplicidades).toBeGreaterThanOrEqual(1);
    expect(result.possiveis_duplicidades.length).toBeGreaterThanOrEqual(1);
    // A transação não-duplicada deve estar no preview
    const novas = result.preview.filter((t: any) => t.description === "Nova Entrada Abril");
    expect(novas.length).toBe(1);
  });

  // ============ OFX IMPORT ============

  test("POST /api/financial/import aceita OFX válido", async ({ request }) => {
    // OFX mínimo válido (formato SGML)
    const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20260301120000[-3:BRT]
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>001
<ACCTID>12345-6
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260301120000[-3:BRT]
<DTEND>20260331120000[-3:BRT]
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260305120000[-3:BRT]
<TRNAMT>1500.00
<FITID>20260305001
<MEMO>TED RECEBIDA - DIZIMO MARCO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260310120000[-3:BRT]
<TRNAMT>-350.00
<FITID>20260310001
<MEMO>PAGTO CONTA LUZ
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260315120000[-3:BRT]
<TRNAMT>800.00
<FITID>20260315001
<MEMO>PIX RECEBIDO - OFERTA ESPECIAL
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>5250.00
<DTASOF>20260331120000[-3:BRT]
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const response = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: {
          name: "extrato_banco.ofx",
          mimeType: "application/x-ofx",
          buffer: Buffer.from(ofxContent, "utf-8"),
        },
        project_id: String(projectId),
      },
    });

    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    expect(result.preview.length).toBe(3);
    expect(result.total_importado).toBe(3);

    // Verifica parsing correto
    const entradas = result.preview.filter((t: any) => t.type === "Entrada");
    const saidas = result.preview.filter((t: any) => t.type === "Saída");
    expect(entradas.length).toBe(2);
    expect(saidas.length).toBe(1);

    // Verifica campos OFX
    expect(result.preview[0].imported_from).toBe("ofx");
    expect(result.preview[0].value).toBe(1500.0);
    expect(result.preview[0].payment_method).toBe("Transferência Bancária");
  });

  test("POST /api/financial/import/confirm salva transações OFX no banco", async ({ request }) => {
    const transactions = [
      { date: "2026-03-05", type: "Entrada", value: 1500.0, description: "TED RECEBIDA - DIZIMO MARCO", imported_from: "ofx" },
      { date: "2026-03-10", type: "Saída", value: 350.0, description: "PAGTO CONTA LUZ", imported_from: "ofx" },
    ];

    const response = await request.post("/api/financial/import/confirm", {
      headers,
      data: { transactions, project_id: projectId },
    });

    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    expect(result.count).toBe(2);
    expect(result.message).toContain("2 transações importadas");
  });

  test("OFX importado aparece nas transações com imported_from=ofx", async ({ request }) => {
    const response = await request.get(
      `/api/financial/transactions?project_id=${projectId}`,
      { headers }
    );

    expect(response.ok()).toBeTruthy();

    const transactions = await response.json();
    const ofxImported = transactions.filter((t: any) => t.imported_from === "ofx");
    expect(ofxImported.length).toBeGreaterThanOrEqual(2);

    // Verifica rastreabilidade
    for (const t of ofxImported) {
      expect(t.project_id).toBe(projectId);
      expect(t.status).toBe("Previsto");
      expect(t.payment_method).toBe("Transferência Bancária");
    }
  });

  test("importação impacta o dashboard financeiro", async ({ request }) => {
    const response = await request.get(
      `/api/financial/dashboard?project_id=${projectId}`,
      { headers }
    );

    expect(response.ok()).toBeTruthy();

    const dashboard = await response.json();
    // Deve ter entradas e saídas das importações
    expect(dashboard.total_income).toBeGreaterThan(0);
    expect(dashboard.total_expense).toBeGreaterThan(0);
    expect(dashboard.total_transactions).toBeGreaterThanOrEqual(4); // 2 CSV + 2 OFX
  });

  // ============ VALIDAÇÕES ============

  test("POST /api/financial/import rejeita formato não suportado", async ({ request }) => {
    const response = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: {
          name: "arquivo.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("conteudo fake", "utf-8"),
        },
        project_id: String(projectId),
      },
    });

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.detail).toContain("Formato não suportado");
  });

  test("POST /api/financial/import rejeita CSV sem colunas obrigatórias", async ({ request }) => {
    const badCsv = `Nome,Email,Telefone
João,joao@test.com,21999998888`;

    const response = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: {
          name: "membros.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(badCsv, "utf-8"),
        },
        project_id: String(projectId),
      },
    });

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.detail).toContain("colunas");
  });

  test("POST /api/financial/import rejeita projeto inexistente", async ({ request }) => {
    const csvContent = `Data,Valor,Descrição
2026-01-01,100.00,Teste`;

    const response = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: {
          name: "test.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csvContent, "utf-8"),
        },
        project_id: "99999",
      },
    });

    expect(response.status()).toBe(404);
  });

  test("POST /api/financial/import sem auth retorna 401", async ({ request }) => {
    const csvContent = `Data,Valor,Descrição
2026-01-01,100.00,Teste`;

    const response = await request.post("/api/financial/import", {
      multipart: {
        file: {
          name: "test.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csvContent, "utf-8"),
        },
        project_id: String(projectId),
      },
    });

    expect(response.status()).toBe(401);
  });
});
