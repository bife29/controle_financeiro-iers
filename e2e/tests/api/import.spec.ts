import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
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
    expect(result.preview[0].status).toBe("Confirmado");
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
      expect(t.status).toBe("Confirmado");
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

  // ============ OFX SANTANDER REAL (FITID vazio, vírgula decimal) ============

  test("POST /api/financial/import aceita OFX Santander com FITID vazio e vírgula decimal", async ({ request }) => {
    // Fixture baseada em extrato real do Santander BR
    const fixturePath = path.resolve(__dirname, "../../fixtures/extrato_santander_marco.ofx");
    const ofxBuffer = fs.readFileSync(fixturePath);

    const response = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: {
          name: "extrato_santander.ofx",
          mimeType: "application/x-ofx",
          buffer: ofxBuffer,
        },
        project_id: String(projectId),
      },
    });

    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    // Fixture tem 16 transações (9 créditos, 7 débitos)
    expect(result.preview.length).toBe(16);
    expect(result.total_importado).toBe(16);

    // Verifica parsing correto de vírgula decimal
    const pix20 = result.preview.find((t: any) => t.value === 20.0 && t.type === "Entrada");
    expect(pix20).toBeDefined();
    expect(pix20.description).toContain("Pix Recebido");

    // Verifica valores com centavos (vírgula BR: 33,09 → 33.09)
    const pix33 = result.preview.find((t: any) => t.value === 33.09);
    expect(pix33).toBeDefined();

    // Verifica débitos
    const debitos = result.preview.filter((t: any) => t.type === "Saída");
    expect(debitos.length).toBe(7);

    // Verifica detecção do banco Santander
    const withBank = result.preview.find((t: any) => t.bank_origin);
    if (withBank) {
      expect(withBank.bank_origin).toContain("SANTANDER");
    }

    // Todos devem ser marcados como imported_from=ofx
    for (const t of result.preview) {
      expect(t.imported_from).toBe("ofx");
      expect(t.status).toBe("Confirmado");
    }
  });

  test("POST /api/financial/import/confirm salva transações Santander no banco", async ({ request }) => {
    // Confirmar subset das transações Santander
    const transactions = [
      { date: "2026-03-02", type: "Entrada", value: 1000.0, description: "Pix Recebido 00077788899", imported_from: "ofx" },
      { date: "2026-03-02", type: "Saída", value: 50.0, description: "Pix Enviado Joao da Silva", imported_from: "ofx" },
      { date: "2026-03-02", type: "Saída", value: 9.9, description: "Tarifa Avulsa Envio Pix 27/02/2026", imported_from: "ofx" },
    ];

    const response = await request.post("/api/financial/import/confirm", {
      headers,
      data: { transactions, project_id: projectId },
    });

    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    expect(result.count).toBe(3);
  });

  test("OFX Santander com FITID vazio não gera erro 400", async ({ request }) => {
    // OFX inline com FITID e CHECKNUM vazios (padrão Santander BR)
    const ofxSantander = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE
<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>20260409[-3:GMT]<LANGUAGE>ENG<FI><ORG>SANTANDER<FID>SANTANDER</FI></SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><TRNUID>1<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS><CURDEF>BRL
<BANKACCTFROM><BANKID>033<ACCTID>0000130012345<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260301000000[-3:GMT]<DTEND>20260331000000[-3:GMT]
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260302000000[-3:GMT]<TRNAMT>150,50<FITID><CHECKNUM><PAYEEID>0<MEMO>Pix Recebido - Dizimo</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260305000000[-3:GMT]<TRNAMT>-89,90<FITID><CHECKNUM><PAYEEID>0<MEMO>Pix Enviado Fornecedor</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1000,00<DTASOF>20260409[-3:GMT]</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

    const response = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: {
          name: "santander_fitid_vazio.ofx",
          mimeType: "application/x-ofx",
          buffer: Buffer.from(ofxSantander, "latin1"),
        },
        project_id: String(projectId),
      },
    });

    // Deve funcionar sem erro (antes daria 400: "Empty FIT id")
    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    expect(result.preview.length).toBe(2);
    // Vírgula decimal: 150,50 → 150.5
    expect(result.preview[0].value).toBe(150.5);
    expect(result.preview[0].type).toBe("Entrada");
    // Débito: 89,90
    expect(result.preview[1].value).toBe(89.9);
    expect(result.preview[1].type).toBe("Saída");
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
