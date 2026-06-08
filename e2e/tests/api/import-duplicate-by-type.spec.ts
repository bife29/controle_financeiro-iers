import { test, expect } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

/**
 * Regressão (relato Jéssica, mai/2026):
 *
 * "Excluindo automaticamente os duplicados na importação OFX, devemos
 *  considerar somente os duplicados de entrada para entrada, e saida para saida"
 *
 * Bug: a deduplicação por `bank_reference` (FITID do OFX) NÃO checava o `type`.
 * Se uma Saída já confirmada tinha o mesmo FITID que uma Entrada do extrato,
 * a Entrada era marcada como "duplicidade" e descartada.
 *
 * Comportamento esperado: a colisão de FITID só conta como duplicidade quando
 * tipo (Entrada/Saída) também coincide.
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

test.describe("Importação OFX - duplicidade por tipo (regressão)", () => {
  let headers: Record<string, string>;
  let projectId: number;
  const FITID = `FXTYP${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
    const projResp = await request.post("/api/financial/projects", {
      headers,
      data: {
        name: tag(`Proj DupType ${Date.now()}`),
        description: tag("Regressão duplicidade por tipo"),
        start_date: "2026-06-01",
      },
    });
    const project = await projResp.json();
    projectId = project.id;

    // Passo 1: importar e CONFIRMAR uma SAÍDA com FITID conhecido
    const ofx1 = buildOfx([
      { fitid: FITID, type: "DEBIT", amount: "-100,00", memo: tag("Saida com FITID"), date: "20260602" },
    ]);
    const r1 = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: { name: "saida.ofx", mimeType: "application/x-ofx", buffer: Buffer.from(ofx1, "utf-8") },
        project_id: String(projectId),
      },
    });
    expect(r1.ok()).toBeTruthy();
    const prev1 = await r1.json();
    expect(prev1.preview.length).toBe(1);
    expect(prev1.preview[0].type).toBe("Saída");
    expect(prev1.preview[0].bank_reference).toBe(FITID);

    const conf = await request.post("/api/financial/import/confirm", {
      headers,
      data: { transactions: prev1.preview, project_id: projectId },
    });
    expect(conf.ok()).toBeTruthy();
  });

  test("Entrada com mesmo FITID de Saída confirmada NÃO é tratada como duplicata", async ({ request }) => {
    // Passo 2: importar uma ENTRADA com o MESMO FITID
    const ofx2 = buildOfx([
      { fitid: FITID, type: "CREDIT", amount: "100,00", memo: tag("Entrada mesmo FITID"), date: "20260602" },
    ]);
    const r2 = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: { name: "entrada.ofx", mimeType: "application/x-ofx", buffer: Buffer.from(ofx2, "utf-8") },
        project_id: String(projectId),
      },
    });
    expect(r2.ok()).toBeTruthy();
    const prev2 = await r2.json();
    console.log("DEBUG prev2:", JSON.stringify(prev2, null, 2));

    // Esperado: Entrada vai para preview como NOVA (não duplicada),
    // porque o tipo é diferente da Saída já confirmada.
    expect(prev2.total_duplicidades).toBe(0);
    expect(prev2.possiveis_duplicidades).toHaveLength(0);
    expect(prev2.preview).toHaveLength(1);
    expect(prev2.preview[0].type).toBe("Entrada");
    expect(prev2.preview[0].bank_reference).toBe(FITID);
  });

  test("Saída com mesmo FITID de Saída confirmada AINDA é tratada como duplicata", async ({ request }) => {
    // Sanidade: a deduplicação correta continua funcionando quando tipo coincide.
    const ofx3 = buildOfx([
      { fitid: FITID, type: "DEBIT", amount: "-100,00", memo: tag("Saida duplicada"), date: "20260602" },
    ]);
    const r3 = await request.post("/api/financial/import", {
      headers,
      multipart: {
        file: { name: "saida2.ofx", mimeType: "application/x-ofx", buffer: Buffer.from(ofx3, "utf-8") },
        project_id: String(projectId),
      },
    });
    expect(r3.ok()).toBeTruthy();
    const prev3 = await r3.json();
    expect(prev3.total_duplicidades).toBeGreaterThanOrEqual(1);
    expect(prev3.possiveis_duplicidades[0].motivo).toBe("bank_reference");
  });
});
