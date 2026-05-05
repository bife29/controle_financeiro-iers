from fastapi import APIRouter, HTTPException, File, UploadFile, Form
import io
import pandas as pd
from ..application.import_service import ImportService
from ..infrastructure.repositories import InMemoryRepository
from ..domain.entities import Project, ParticipantEvent, Transaction
from ..infrastructure.audit_log import AuditLog

router = APIRouter()
repo = InMemoryRepository()
audit_log = AuditLog()
import_service = ImportService()

@router.get("/audit-logs")
def get_audit_logs():
    return audit_log.get_logs()

# Rotas principais (exemplo inicial)
@router.get("/periods")
def list_periods():
    return repo.periods

@router.get("/categories")
def list_categories():
    return repo.categories

@router.get("/members")
def list_members():
    return repo.members

@router.get("/accounts")
def list_accounts():
    return repo.accounts

@router.get("/transactions")
def list_transactions():
    return repo.transactions

@router.post("/transactions")
def create_transaction(transaction: Transaction):
    # Validação: obrigatoriedade de projeto
    if not hasattr(transaction, 'project_id') or transaction.project_id is None:
        raise HTTPException(status_code=400, detail="Campo 'project_id' é obrigatório para transações.")
    repo.transactions.append(transaction)
    return transaction

@router.put("/transactions/{transaction_id}")
def update_transaction(transaction_id: int, transaction: Transaction):
    for idx, t in enumerate(repo.transactions):
        if t.id == transaction_id:
            before = t.dict() if hasattr(t, 'dict') else t.__dict__
            repo.transactions[idx] = transaction
            after = transaction.dict() if hasattr(transaction, 'dict') else transaction.__dict__
            audit_log.add('edit', 'Transaction', transaction_id, 'system', before, after)
            return transaction
    raise HTTPException(status_code=404, detail="Transaction not found")

@router.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: int):
    for idx, t in enumerate(repo.transactions):
        if t.id == transaction_id:
            before = t.dict() if hasattr(t, 'dict') else t.__dict__
            audit_log.add('delete', 'Transaction', transaction_id, 'system', before, None)
            del repo.transactions[idx]
            return {"detail": "Transaction deleted"}
    raise HTTPException(status_code=404, detail="Transaction not found")

# Rotas para Projetos (Eventos)
@router.get("/projects")
def list_projects():
    return repo.projects

@router.post("/projects")
def create_project(project: Project):
    repo.projects.append(project)
    return project

@router.get("/projects/{project_id}")
def get_project(project_id: int):
    for p in repo.projects:
        if p.id == project_id:
            return p
    raise HTTPException(status_code=404, detail="Project not found")

# Rotas para Participantes de Evento
@router.get("/participant-events")
def list_participant_events():
    return repo.participant_events

@router.post("/participant-events")
def create_participant_event(pe: ParticipantEvent):
    repo.participant_events.append(pe)
    return pe

@router.get("/participant-events/{pe_id}")
def get_participant_event(pe_id: int):
    for pe in repo.participant_events:
        if pe.id == pe_id:
            return pe
    raise HTTPException(status_code=404, detail="ParticipantEvent not found")

from fastapi import APIRouter, HTTPException, File, UploadFile, Form
import io
import pandas as pd
from ..application.import_service import ImportService
from ..infrastructure.repositories import InMemoryRepository
from ..domain.entities import Project, ParticipantEvent, Transaction
from ..infrastructure.audit_log import AuditLog

router = APIRouter()
repo = InMemoryRepository()
audit_log = AuditLog()
import_service = ImportService()

@router.get("/audit-logs")
def get_audit_logs():
    return audit_log.get_logs()

# Endpoint de importação com grade de conferência
@router.post("/import-transactions/")
async def import_transactions(
    file: UploadFile = File(...),
    period_id: int = Form(...),
    project_id: int = Form(...)
):
    content = await file.read()
    filename = file.filename.lower()
    # Detectar tipo de arquivo
    if filename.endswith('.ofx'):
        # Salvar temporário
        temp_path = f"/tmp/{file.filename}"
        with open(temp_path, 'wb') as f:
            f.write(content)
        transactions = import_service.import_ofx(temp_path, period_id, project_id)
        # TODO: aplicar conciliação interativa para OFX se necessário
        preview = transactions
        duplicates = []
    elif filename.endswith('.csv'):
        df = pd.read_csv(io.BytesIO(content))
        transactions = []
        duplicates = []
        for _, row in df.iterrows():
            desc = str(row.get('Descrição', '')).lower()
            if 'dízimo' in desc:
                category_id = 1
            else:
                category_id = 0
            t = {
                'date': row['Data'],
                'type': 'Entrada' if float(row['Valor']) > 0 else 'Saída',
                'value': abs(float(row['Valor'])),
                'payment_method': 'Transferência Bancária',
                'category_id': category_id,
                'member_id': None,
                'project_id': project_id,
                'description': row['Descrição'],
                'period_id': period_id,
                'status': 'Previsto'
            }
            # Conciliação interativa: buscar duplicidade
            found_duplicate = None
            for tr in repo.transactions:
                # Tolerância: valor ±0,03, data ±3 dias
                try:
                    valor_ok = abs(tr.value - t['value']) <= 0.03
                    data_ok = False
                    if hasattr(tr, 'date'):
                        data_ok = abs((pd.to_datetime(tr.date) - pd.to_datetime(t['date'])).days) <= 3
                    desc_ok = tr.description and t['description'] and tr.description.strip().lower() == t['description'].strip().lower()
                    if valor_ok and data_ok and desc_ok:
                        found_duplicate = tr
                        break
                except Exception:
                    continue
            if found_duplicate:
                duplicates.append({'arquivo': t, 'banco': found_duplicate})
            else:
                transactions.append(t)
        preview = transactions
    else:
        raise HTTPException(status_code=400, detail="Formato de arquivo não suportado")
    return {'preview': preview, 'possiveis_duplicidades': duplicates}
