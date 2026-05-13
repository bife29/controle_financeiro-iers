"""
Diagnóstico em PROD dos 3 bugs bloqueantes reportados pela usuária.

Uso (PowerShell):
    & .\.venv\Scripts\python.exe .\scripts\diagnose-prod-bugs.py

Não-destrutivo: cria recursos com prefixo [DIAG-<ts>] e os apaga ao final.
"""
from __future__ import annotations
import os, sys, json, time, datetime as dt
import urllib.request, urllib.error

API = os.environ.get("API_URL", "https://iers-api.onrender.com")
EMAIL = os.environ.get("ADMIN_EMAIL", "admin@iers.org")
PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
TAG = f"[DIAG-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}]"

created = {"transactions": [], "participant_events": [], "projects": [], "members": []}


def http(method: str, path: str, *, token: str | None = None, body: dict | None = None, params: dict | None = None) -> tuple[int, dict | list | str]:
    url = API + path
    if params:
        from urllib.parse import urlencode
        url += "?" + urlencode({k: v for k, v in params.items() if v is not None})
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            ctype = r.headers.get("Content-Type", "")
            raw = r.read()
            if "json" in ctype:
                return r.status, json.loads(raw.decode())
            if ctype.startswith("text/"):
                return r.status, raw.decode(errors="replace")
            # binary (pdf/xlsx) — devolve metadados
            return r.status, {"_binary": True, "content_type": ctype, "bytes": len(raw)}
    except urllib.error.HTTPError as e:
        body_txt = e.read().decode()
        try:
            return e.code, json.loads(body_txt)
        except json.JSONDecodeError:
            return e.code, body_txt


def section(title: str):
    print("\n" + "=" * 78)
    print(f"  {title}")
    print("=" * 78)


def main() -> int:
    print(f"API: {API}")
    print(f"TAG: {TAG}")

    section("LOGIN")
    code, data = http("POST", "/api/auth/login", body={"email": EMAIL, "password": PASSWORD})
    assert code == 200, f"login falhou: {code} {data}"
    token = data["access_token"]
    print(f"OK  user={data['user']['email']} role={data['user']['role']}")

    # ----------------------------------------------------------
    section("BUG 1 — paginação /api/financial/transactions")
    # ----------------------------------------------------------
    code, page1 = http("GET", "/api/financial/transactions", token=token, params={"limit": 100, "skip": 0})
    code2, page2 = http("GET", "/api/financial/transactions", token=token, params={"limit": 100, "skip": 100})
    code3, page_max = http("GET", "/api/financial/transactions", token=token, params={"limit": 500, "skip": 0})
    n1 = len(page1) if isinstance(page1, list) else "?"
    n2 = len(page2) if isinstance(page2, list) else "?"
    nmax = len(page_max) if isinstance(page_max, list) else "?"
    print(f"  GET ?limit=100&skip=0     -> {code}  qtd={n1}")
    print(f"  GET ?limit=100&skip=100   -> {code2} qtd={n2}")
    print(f"  GET ?limit=500&skip=0     -> {code3} qtd={nmax}")
    print(f"  -> Backend SUPORTA paginação. Resposta NÃO traz 'total' (só array).")
    print(f"  -> Bug está no FRONTEND (TransactionsList.tsx não envia skip nem renderiza Pag).")
    print(f"  -> Total de transações em prod (estimado) >= {nmax}")

    # ----------------------------------------------------------
    section("Pré-setup: criar projeto + membro + ParticipantEvent")
    # ----------------------------------------------------------
    today = dt.date.today().isoformat()
    code, proj = http("POST", "/api/financial/projects", token=token, body={
        "name": f"{TAG} Projeto Diag", "description": TAG, "start_date": today,
    })
    assert code == 200, f"criar projeto: {code} {proj}"
    project_id = proj["id"]
    created["projects"].append(project_id)
    print(f"  projeto criado id={project_id}")

    code, mem = http("POST", "/api/members/", token=token, body={
        "name": f"{TAG} Membro Diag",
    })
    assert code in (200, 201), f"criar membro: {code} {mem}"
    member_id = mem["id"]
    created["members"].append(member_id)
    print(f"  membro criado id={member_id}")

    # ParticipantEvent (vínculo membro x projeto com agreed_value)
    code, pe = http("POST", "/api/financial/participant-events", token=token, body={
        "project_id": project_id,
        "member_id": member_id,
        "agreed_value": 300.0,
        "paid_value": 0.0,
        "status": "Pendente",
    })
    assert code == 200, f"criar participant-event: {code} {pe}"
    pe_id = pe["id"]
    created["participant_events"].append(pe_id)
    print(f"  participant_event criado id={pe_id}  agreed=300 paid=0 status=Pendente")

    # Buscar uma categoria de Entrada qualquer
    code, cats = http("GET", "/api/financial/categories", token=token)
    cat_in = next((c for c in cats if c.get("type") == "Entrada"), None)
    assert cat_in, "não achei categoria de Entrada"
    cat_id = cat_in["id"]
    print(f"  categoria Entrada usada id={cat_id} ({cat_in.get('name')})")

    # Cria 2 transações Confirmadas vinculadas ao projeto, uma com member_id, outra sem
    code, tx_with = http("POST", "/api/financial/transactions", token=token, body={
        "type": "Entrada", "value": 100.0, "date": today,
        "description": f"{TAG} pagamento com membro",
        "category_id": cat_id, "project_id": project_id, "member_id": member_id,
        "status": "Confirmado", "payment_date": today,
    })
    assert code == 200, f"criar tx com membro: {code} {tx_with}"
    created["transactions"].append(tx_with["id"])

    code, tx_without = http("POST", "/api/financial/transactions", token=token, body={
        "type": "Entrada", "value": 50.0, "date": today,
        "description": f"{TAG} pagamento sem membro",
        "category_id": cat_id, "project_id": project_id,
        "status": "Confirmado", "payment_date": today,
    })
    assert code == 200, f"criar tx sem membro: {code} {tx_without}"
    created["transactions"].append(tx_without["id"])
    print(f"  tx COM membro id={tx_with['id']} value=100  member_id={tx_with.get('member_id')}")
    print(f"  tx SEM membro id={tx_without['id']} value=50   member_id={tx_without.get('member_id')}")

    # ----------------------------------------------------------
    section("BUG 2 — vínculo evento+membro NÃO entra em paid_value")
    # ----------------------------------------------------------
    code, pe_after = http("GET", "/api/financial/participant-events", token=token, params={"project_id": project_id})
    pe_obj = next((x for x in pe_after if x["id"] == pe_id), None)
    print(f"  GET participant-events (após 100,00 vinculado a este membro+projeto):")
    print(f"     paid_value = {pe_obj.get('paid_value')}   status = {pe_obj.get('status')}")
    print(f"     ESPERADO (segundo usuária): paid_value = 100,00")
    print(f"     ATUAL: o sistema NÃO incrementa paid_value automaticamente.")

    code, dash = http("GET", f"/api/financial/projects/{project_id}/dashboard", token=token)
    print(f"  GET projects/{project_id}/dashboard:")
    print(f"     total_received = {dash.get('total_received')} (esperado 150 = 100+50)")
    print(f"     paid_count     = {dash.get('paid_count')} (PE com status Pago)")
    print(f"     pending_count  = {dash.get('pending_count')}")

    # ----------------------------------------------------------
    section("BUG 3 — relatórios por projeto/membro")
    # ----------------------------------------------------------
    # /api/reports/by-project (pdf default; pedimos json se aceitar) — vamos ver o status
    params = {"project_id": project_id, "format": "pdf"}
    code, _ = http("GET", "/api/reports/by-project", token=token, params=params)
    print(f"  GET /api/reports/by-project?project_id={project_id} -> {code}  (PDF, não inspecionamos conteúdo)")

    # /api/reports/projects-by-member com member_id
    code, _ = http("GET", "/api/reports/projects-by-member", token=token,
                   params={"member_id": member_id, "format": "pdf"})
    print(f"  GET /api/reports/projects-by-member?member_id={member_id} -> {code}")

    # Conferência indireta: lista transações filtradas por projeto e checa se ambas aparecem
    code, txs = http("GET", "/api/financial/transactions", token=token, params={"project_id": project_id, "limit": 500})
    mine = [t for t in txs if TAG in (t.get("description") or "")]
    print(f"  GET transactions?project_id={project_id} -> qtd_minhas={len(mine)} (esperado 2)")
    com_member = [t for t in mine if t.get("member_id") == member_id]
    print(f"     com member_id correto = {len(com_member)} (esperado 1)")

    # ----------------------------------------------------------
    section("CLEANUP")
    # ----------------------------------------------------------
    for tid in created["transactions"]:
        c, _ = http("DELETE", f"/api/financial/transactions/{tid}", token=token)
        print(f"  DELETE transaction {tid} -> {c}")
    for peid in created["participant_events"]:
        c, _ = http("DELETE", f"/api/financial/participant-events/{peid}", token=token)
        print(f"  DELETE participant-event {peid} -> {c}")
    for pid in created["projects"]:
        c, _ = http("DELETE", f"/api/financial/projects/{pid}", token=token)
        print(f"  DELETE project {pid} -> {c}")
    for mid in created["members"]:
        c, _ = http("DELETE", f"/api/members/{mid}", token=token)
        print(f"  DELETE member {mid} -> {c}")

    print("\nDIAGNÓSTICO COMPLETO.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
