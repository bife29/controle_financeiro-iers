import { test, expect } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Regressão (relato Jéssica, jun/2026):
 *
 * Fluxo da usuária: ao receber o comprovante de pagamento de um evento,
 * ela já lança a transação como Confirmada manualmente. Quando depois o
 * extrato OFX chega contendo a mesma transação, o sistema NÃO detectava
 * duplicidade — porque a descrição do lançamento manual ("Retiro João") é
 * diferente da descrição do banco ("PIX REC TEDxxx").
 *
 * Resultado: o sistema duplicava o lançamento (valor entrava 2x no caixa).
 *
 * Fix: além da regra forte (valor + tipo + ±dias + descrição igual), passamos
 * a marcar como "possível duplicidade" linhas que coincidem em valor + tipo
 * + ±dias, mesmo quando a descrição diverge. A usuária decide se aceita ou
 * descarta na tela de pré-visualização.
 */

function buildOfx(transactions: Array<{ fitid: string; type: "CREDIT" | "DEBIT"; amount: string; memo: string; date: string }>): string {
  const txBlocks = transactions
    .map(
      (t) => `
					<STMTTRN>
						<TRNTYPE>${t.type}
						<DTPOSTED>${t.date}000000[-3:GMT]
						<TRNAMT>${t.amount}
						<FITID>${t.fitid}
						<CHECKNUM>
						<PAYEEID>0
						<MEMO>${t.memo}
					</STMTTRN>`,
    )
    .join("");

  return `OFXHEADER:100
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
			<STATUS><CODE>0<SEVERITY>INFO</STATUS>
			<DTSERVER>20260601110000[-3:GMT]
			<LANGUAGE>ENG
			<FI><ORG>SANTANDER<FID>SANTANDER</FI>
		</SONRS>
	</SIGNONMSGSRSV1>
	<BANKMSGSRSV1>
		<STMTTRNRS>
			<TRNUID>1
			<STATUS><CODE>0<SEVERITY>INFO</STATUS>
			<STMTRS>
				<CURDEF>BRL
				<BANKACCTFROM>
					<BANKID>033
					<ACCTID>0000130012345
					<ACCTTYPE>CHECKING
				</BANKACCTFROM>
				<BANKTRANLIST>
					<DTSTART>20260601000000[-3:GMT]
					<DTEND>20260630000000[-3:GMT]${txBlocks}
				</BANKTRANLIST>
				<LEDGERBAL><BALAMT>0,00<DTASOF>20260601000000[-3:GMT]</LEDGERBAL>
			</STMTRS>
		</STMTTRNRS>
	</BANKMSGSRSV1>
</OFX>`;
}

test.describe("Importação OFX - duplicidade fraca por valor+data (regressão Jéssica jun/2026)", () => {
  test.describe.configure({ mode: "serial" });

  let headers: Record<string, string>;
  let projectId: number;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
    const projResp = await request.post("/api/financial/projects", {
      headers,
      data: {
        name: tag(`Proj WeakDup ${Date.now()}`),
        description: tag("Regressão duplicidade fraca valor+data"),
        start_date: "2026-06-01",
      },
    });
    const project = await projResp.json();
    projectId = project.id;
  });

  test("Transação manual Confirmada bloqueia importação de OFX com mesmo valor/data e descrição diferente", async ({ request }) => {
    // Passo 1: usuária lança manualmente uma Entrada Confirmada
    // (cenário típico: recebeu comprovante PIX antes do extrato chegar).
    const manualDesc = tag(`Retiro João ${Date.now()}`);
    const manual = await request.post("/api/financial/transactions", {
      headers,
      data: {
        date: "2026-06-15",
        type: "Entrada",
        value: 137.77,
        description: manualDesc,
        status: "Confirmado",
        payment_date: "2026-06-15",
        project_id: projectId,
      },
    });
    expect(manual.ok()).toBeTruthy();
    const manualTx = await manual.json();
    expect(manualTx.id).toBeGreaterThan(0);

    // Passo 2: importa OFX com mesma data e valor MAS descrição do banco
    const bankMemo = tag(`PIX REC TED ${Date.now()}`);
    const ofx = buildOfx([
      { fitid: `WEAK${Date.now()}`, type: "CREDIT", amount: "137,77", memo: bankMemo, date: "20260615" },
    ]);
    const r = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: { name: "extrato_pix.ofx", mimeType: "application/x-ofx", buffer: Buffer.from(ofx, "utf-8") },
        project_id: String(projectId),
      },
    });
    expect(r.ok()).toBeTruthy();
    const result = await r.json();

    // Esperado: a linha do OFX vai para "possível duplicidade" (não para preview).
    // Motivo deve ser "valor+data" (regra fraca) — descrição diverge.
    expect(result.total_duplicidades).toBeGreaterThanOrEqual(1);
    const dup = result.possiveis_duplicidades.find(
      (d: any) => d.existente_id === manualTx.id
    );
    expect(dup).toBeTruthy();
    expect(dup.motivo).toBe("valor+data");

    // E a linha NÃO deve aparecer no preview (não vai ser criada se a usuária confirmar).
    expect(result.preview.length).toBe(0);
  });

  test("Mesma transação com descrição igual continua marcada como duplicidade forte (valor+data+descricao)", async ({ request }) => {
    // Sanidade: a regra forte continua funcionando.
    const sameDesc = tag(`Forte ${Date.now()}`);
    const manual = await request.post("/api/financial/transactions", {
      headers,
      data: {
        date: "2026-06-20",
        type: "Entrada",
        value: 99.99,
        description: sameDesc,
        status: "Confirmado",
        payment_date: "2026-06-20",
        project_id: projectId,
      },
    });
    expect(manual.ok()).toBeTruthy();

    const ofx = buildOfx([
      { fitid: `STRONG${Date.now()}`, type: "CREDIT", amount: "99,99", memo: sameDesc, date: "20260620" },
    ]);
    const r = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: { name: "extrato_strong.ofx", mimeType: "application/x-ofx", buffer: Buffer.from(ofx, "utf-8") },
        project_id: String(projectId),
      },
    });
    expect(r.ok()).toBeTruthy();
    const result = await r.json();
    expect(result.total_duplicidades).toBeGreaterThanOrEqual(1);
    const dup = result.possiveis_duplicidades.find(
      (d: any) => d.arquivo.description === sameDesc
    );
    expect(dup).toBeTruthy();
    expect(dup.motivo).toBe("valor+data+descricao");
  });

  test("Valor diferente NÃO é tratado como duplicidade fraca", async ({ request }) => {
    // Garante que a heurística não está "vazando" para casos legítimos.
    const desc = tag(`Sem dup ${Date.now()}`);
    const ofx = buildOfx([
      { fitid: `UNIQUE${Date.now()}`, type: "CREDIT", amount: "500,00", memo: desc, date: "20260622" },
    ]);
    const r = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: { name: "extrato_novo.ofx", mimeType: "application/x-ofx", buffer: Buffer.from(ofx, "utf-8") },
        project_id: String(projectId),
      },
    });
    expect(r.ok()).toBeTruthy();
    const result = await r.json();
    // Deve entrar como NOVA — não há transação Confirmada de 500,00 em 22/06.
    expect(result.preview.find((p: any) => p.description === desc)).toBeTruthy();
    expect(
      result.possiveis_duplicidades.find((d: any) => d.arquivo?.description === desc)
    ).toBeFalsy();
  });
});
