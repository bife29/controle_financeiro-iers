import json
import io
import re
import tempfile
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, Form, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete as sa_delete
from typing import Optional, List
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
from ...core.database import get_db
from ...core.config import settings
from ...core.security import get_current_user, require_roles, require_permission

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")


def _month_expr(col):
    """Return year-month expression compatible with current DB dialect."""
    if _is_sqlite:
        return func.strftime('%Y-%m', col)
    return func.to_char(col, 'YYYY-MM')
from .models import Category, Project, Transaction, ParticipantEvent, AuditLog
from .schemas import (
    CategoryCreate, CategoryResponse,
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectDashboard,
    TransactionCreate, TransactionUpdate, TransactionResponse, TransactionConfirmPayload,
    ParticipantEventCreate, ParticipantEventUpdate, ParticipantEventResponse,
    AuditLogResponse, FinancialSummary,
    BatchDeleteRequest, RecurringTransactionCreate
)

router = APIRouter(prefix="/api/financial", tags=["Financeiro"])


# ============ CATEGORIES ============

@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = await db.execute(select(Category).where(Category.is_active == True))
    return result.scalars().all()


@router.post("/categories", response_model=CategoryResponse)
async def create_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "create"))
):
    cat = Category(**data.model_dump())
    db.add(cat)
    await db.flush()
    await db.refresh(cat)
    return cat


@router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "edit"))
):
    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    for field, value in data.model_dump().items():
        setattr(cat, field, value)
    await db.flush()
    await db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "delete"))
):
    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    cat.is_active = False
    await db.flush()
    return {"detail": "Categoria desativada"}


# ============ PROJECTS ============

@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = select(Project)
    if status:
        query = query.where(Project.status == status)
    query = query.order_by(Project.start_date.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/projects", response_model=ProjectResponse)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "create"))
):
    project = Project(**data.model_dump())
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "edit"))
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await db.flush()
    await db.refresh(project)
    return project


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "delete"))
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    # Desassociar pagamentos de retiro que referenciam transações deste projeto
    from ..retreat.models import RetreatPayment
    from sqlalchemy import delete as sa_delete, update as sa_update
    tx_ids_result = await db.execute(
        select(Transaction.id).where(Transaction.project_id == project_id)
    )
    tx_ids = [r[0] for r in tx_ids_result.all()]
    if tx_ids:
        await db.execute(
            sa_update(RetreatPayment)
            .where(RetreatPayment.transaction_id.in_(tx_ids))
            .values(transaction_id=None)
        )
        await db.flush()

    # Remove transações vinculadas
    await db.execute(sa_delete(Transaction).where(Transaction.project_id == project_id))
    await db.flush()

    # Remove retiros vinculados a este projeto (se houver)
    from ..retreat.models import Retreat
    retreats_result = await db.execute(
        select(Retreat).where(Retreat.project_id == project_id)
    )
    for retreat in retreats_result.scalars().all():
        retreat.project_id = None
    await db.flush()

    await db.delete(project)
    return {"detail": "Projeto excluído"}


@router.get("/projects/{project_id}/dashboard", response_model=ProjectDashboard)
async def project_dashboard(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    # Total Recebido (Entradas Confirmadas deste projeto)
    income = await db.execute(
        select(func.coalesce(func.sum(Transaction.value), 0))
        .where(
            Transaction.project_id == project_id,
            Transaction.type == "Entrada",
            Transaction.status == "Confirmado",
        )
    )
    total_received = income.scalar()

    # Total Gasto (Saídas Confirmadas deste projeto)
    expense = await db.execute(
        select(func.coalesce(func.sum(Transaction.value), 0))
        .where(
            Transaction.project_id == project_id,
            Transaction.type == "Saída",
            Transaction.status == "Confirmado",
        )
    )
    total_spent = expense.scalar()

    # Participantes — usa status DERIVADO (paid_value calculado das Transactions)
    pes_result = await db.execute(
        select(ParticipantEvent).where(ParticipantEvent.project_id == project_id)
    )
    pes_list = pes_result.scalars().all()
    paid_map = await _compute_pe_paid_values(db, pes_list)
    serialized_pes = [_serialize_pe(pe, paid_map[pe.id]) for pe in pes_list]
    participant_count = len(serialized_pes)
    paid_count = sum(1 for s in serialized_pes if s["status"] == "Pago")
    pending_count = sum(1 for s in serialized_pes if s["status"] == "Pendente")

    return ProjectDashboard(
        project=ProjectResponse.model_validate(project),
        total_received=total_received,
        total_spent=total_spent,
        balance=total_received - total_spent,
        participant_count=participant_count,
        paid_count=paid_count,
        pending_count=pending_count,
    )


# ============ TRANSACTIONS ============

@router.get("/transactions", response_model=list[TransactionResponse])
async def list_transactions(
    response: Response,
    project_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro", "pastor"))
):
    """Lista transações com paginação.

    Retorna o total de registros que casam com os filtros via header HTTP
    `X-Total-Count` (exposto por CORS) para que o frontend possa renderizar
    paginação clássica (Página N de M).
    """
    base = select(Transaction)
    if project_id:
        base = base.where(Transaction.project_id == project_id)
    if type:
        base = base.where(Transaction.type == type)
    if status:
        base = base.where(Transaction.status == status)
    if start_date:
        base = base.where(Transaction.date >= start_date)
    if end_date:
        base = base.where(Transaction.date <= end_date)

    # total (mesmos filtros, sem offset/limit)
    total_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(total_q)).scalar() or 0
    response.headers["X-Total-Count"] = str(total)

    query = base.order_by(Transaction.date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/transactions", response_model=TransactionResponse)
async def create_transaction(
    data: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "create"))
):
    if data.status not in ("Previsto", "Confirmado"):
        raise HTTPException(status_code=400, detail="status deve ser 'Previsto' ou 'Confirmado'")
    payload = data.model_dump()
    # Se já cadastrado como Confirmado e sem payment_date, usa a própria data
    if payload["status"] == "Confirmado":
        payload.setdefault("payment_date", payload["date"])
    transaction = Transaction(**payload, created_by=current_user.id)
    db.add(transaction)
    await db.flush()
    await db.refresh(transaction)

    # Audit log
    log = AuditLog(
        action="create", entity="Transaction", entity_id=transaction.id,
        user_id=current_user.id, after_data=json.dumps(data.model_dump(), default=str)
    )
    db.add(log)
    return transaction


@router.get("/transactions/by-id/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro", "pastor"))
):
    """Busca uma transação por ID. Necessário para o form de edição não depender
    de listar todas as transações (que era limitado a 500)."""
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    return transaction


# IMPORTANTE: rotas com path estático (/batch) devem vir ANTES das com path param /{id}
# para evitar que o FastAPI capture "batch" como valor do parâmetro transaction_id (Bug 1).
@router.delete("/transactions/batch")
async def batch_delete_transactions(
    data: BatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "delete"))
):
    """Exclui múltiplas transações de uma vez."""
    if not data.ids:
        raise HTTPException(status_code=400, detail="Nenhum ID fornecido")
    if len(data.ids) > 1000:
        raise HTTPException(status_code=400, detail="Máximo de 1000 transações por vez")

    # Verificar se existem
    result = await db.execute(
        select(Transaction).where(Transaction.id.in_(data.ids))
    )
    transactions = result.scalars().all()
    found_ids = [t.id for t in transactions]

    if not found_ids:
        raise HTTPException(status_code=404, detail="Nenhuma transação encontrada")

    # Desreferenciar pagamentos de retiro que apontem para essas transações
    from ..retreat.models import RetreatPayment
    from sqlalchemy import update as sa_update
    await db.execute(
        sa_update(RetreatPayment)
        .where(RetreatPayment.transaction_id.in_(found_ids))
        .values(transaction_id=None)
    )

    # Deletar transações
    await db.execute(sa_delete(Transaction).where(Transaction.id.in_(found_ids)))

    # Audit log
    log = AuditLog(
        action="batch_delete", entity="Transaction", entity_id=0,
        user_id=current_user.id,
        after_data=json.dumps({"deleted_ids": found_ids, "count": len(found_ids)})
    )
    db.add(log)
    await db.flush()

    return {"detail": f"{len(found_ids)} transações excluídas", "count": len(found_ids)}


@router.put("/transactions/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "edit"))
):
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    before = {c.name: getattr(transaction, c.name) for c in Transaction.__table__.columns}

    payload = data.model_dump(exclude_unset=True)
    if "status" in payload and payload["status"] not in ("Previsto", "Confirmado"):
        raise HTTPException(status_code=400, detail="status deve ser 'Previsto' ou 'Confirmado'")
    for field, value in payload.items():
        setattr(transaction, field, value)
    await db.flush()
    await db.refresh(transaction)

    after = {c.name: getattr(transaction, c.name) for c in Transaction.__table__.columns}
    log = AuditLog(
        action="edit", entity="Transaction", entity_id=transaction_id,
        user_id=current_user.id,
        before_data=json.dumps(before, default=str),
        after_data=json.dumps(after, default=str)
    )
    db.add(log)
    return transaction


@router.post("/transactions/{transaction_id}/confirm", response_model=TransactionResponse)
async def confirm_transaction(
    transaction_id: int,
    payload: TransactionConfirmPayload,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "edit"))
):
    """Confirma uma transação Previsto (baixa manual). Mantém o mesmo registro."""
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    if transaction.status == "Confirmado":
        raise HTTPException(status_code=400, detail="Transação já está confirmada")

    before = {c.name: getattr(transaction, c.name) for c in Transaction.__table__.columns}
    transaction.status = "Confirmado"
    transaction.payment_date = payload.payment_date or date.today()
    await db.flush()
    await db.refresh(transaction)

    after = {c.name: getattr(transaction, c.name) for c in Transaction.__table__.columns}
    db.add(AuditLog(
        action="confirm", entity="Transaction", entity_id=transaction_id,
        user_id=current_user.id,
        before_data=json.dumps(before, default=str),
        after_data=json.dumps(after, default=str),
    ))
    return transaction


@router.delete("/transactions/{transaction_id}")
async def delete_transaction(
    transaction_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "delete"))
):
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    before = {c.name: getattr(transaction, c.name) for c in Transaction.__table__.columns}
    log = AuditLog(
        action="delete", entity="Transaction", entity_id=transaction_id,
        user_id=current_user.id, before_data=json.dumps(before, default=str)
    )
    db.add(log)
    await db.delete(transaction)
    return {"detail": "Transação excluída"}


# ----- Edição/exclusão em LOTE de transações recorrentes -----

@router.put("/transactions/recurring/{group_id}", response_model=list[TransactionResponse])
async def update_recurring_group(
    group_id: str,
    data: TransactionUpdate,
    from_date: Optional[date] = Query(
        None,
        description="Se informado, atualiza somente as transações do grupo "
                    "com date >= from_date (edita 'esta e as futuras').",
    ),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "edit"))
):
    """Atualiza várias transações do mesmo grupo de recorrência.

    Use `from_date` para limitar à transação corrente e às futuras.
    Sem `from_date`, todas as transações do grupo são atualizadas.

    O campo `date` é IGNORADO (cada transação tem sua própria data de
    vencimento). Os demais campos do payload TransactionUpdate são
    aplicados em todas as transações afetadas.
    """
    q = select(Transaction).where(Transaction.recurring_group_id == group_id)
    if from_date:
        q = q.where(Transaction.date >= from_date)
    txs = list((await db.execute(q)).scalars().all())
    if not txs:
        raise HTTPException(status_code=404, detail="Nenhuma transação encontrada para o grupo informado")

    payload = data.model_dump(exclude_unset=True, exclude_none=True)
    payload.pop("date", None)  # data é por instância
    payload.pop("payment_date", None)  # payment_date também é individual
    if not payload:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")

    for tx in txs:
        for field, value in payload.items():
            setattr(tx, field, value)

    log = AuditLog(
        action="update_recurring_group",
        entity="Transaction",
        entity_id=txs[0].id,
        user_id=current_user.id,
        after_data=json.dumps({
            "group_id": group_id,
            "from_date": str(from_date) if from_date else None,
            "affected": len(txs),
            "patch": payload,
        }, default=str),
    )
    db.add(log)
    await db.flush()
    for tx in txs:
        await db.refresh(tx)
    return txs


@router.delete("/transactions/recurring/{group_id}")
async def delete_recurring_group(
    group_id: str,
    from_date: Optional[date] = Query(
        None,
        description="Se informado, exclui somente as transações do grupo "
                    "com date >= from_date (exclui 'esta e as futuras').",
    ),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "delete"))
):
    """Exclui várias transações do mesmo grupo de recorrência."""
    q = select(Transaction).where(Transaction.recurring_group_id == group_id)
    if from_date:
        q = q.where(Transaction.date >= from_date)
    txs = list((await db.execute(q)).scalars().all())
    if not txs:
        raise HTTPException(status_code=404, detail="Nenhuma transação encontrada para o grupo informado")

    deleted_ids = [tx.id for tx in txs]
    for tx in txs:
        await db.delete(tx)

    log = AuditLog(
        action="delete_recurring_group",
        entity="Transaction",
        entity_id=deleted_ids[0],
        user_id=current_user.id,
        before_data=json.dumps({
            "group_id": group_id,
            "from_date": str(from_date) if from_date else None,
            "deleted_ids": deleted_ids,
        }, default=str),
    )
    db.add(log)
    return {"detail": "Transações excluídas", "deleted": len(deleted_ids)}


@router.post("/transactions/recurring", response_model=list[TransactionResponse])
async def create_recurring_transactions(
    data: RecurringTransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "create"))
):
    """
    Cria transações recorrentes (previstos).
    Gera N instâncias com status 'Previsto', uma por mês.
    """
    if data.recurrence_count < 1 or data.recurrence_count > 60:
        raise HTTPException(status_code=400, detail="Recorrência deve ser entre 1 e 60 meses")

    group_id = str(uuid.uuid4())
    day = data.recurrence_day or data.date.day
    created = []

    for i in range(data.recurrence_count):
        tx_date = data.date + relativedelta(months=i)
        # Ajustar dia do mês (se dia > último dia do mês, usa último dia)
        try:
            tx_date = tx_date.replace(day=day)
        except ValueError:
            # Mês não tem esse dia (ex: 31 em fevereiro) → último dia
            next_month = tx_date.replace(day=1) + relativedelta(months=1)
            tx_date = next_month - timedelta(days=1)

        tx = Transaction(
            date=tx_date,
            type=data.type,
            value=data.value,
            description=data.description,
            payment_method=data.payment_method,
            category_id=data.category_id,
            member_id=data.member_id,
            project_id=data.project_id,
            status="Previsto",
            imported_from="recorrente",
            is_recurring=True,
            recurring_group_id=group_id,
            created_by=current_user.id,
        )
        db.add(tx)
        created.append(tx)

    await db.flush()
    for tx in created:
        await db.refresh(tx)

    # Audit log
    log = AuditLog(
        action="create_recurring", entity="Transaction", entity_id=created[0].id,
        user_id=current_user.id,
        after_data=json.dumps({
            "group_id": group_id,
            "count": len(created),
            "value": data.value,
            "description": data.description,
        })
    )
    db.add(log)

    return created


# ============ EXPORT / BACKUP ============

@router.get("/export")
async def export_financial_data(
    format: str = Query("json", regex="^(json|csv)$"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro"))
):
    """
    Exporta todos os dados financeiros para backup.
    Formatos: json ou csv.
    """
    # Buscar todos os dados
    transactions = (await db.execute(
        select(Transaction).order_by(Transaction.date.desc())
    )).scalars().all()
    categories = (await db.execute(select(Category))).scalars().all()
    projects = (await db.execute(select(Project))).scalars().all()
    participants = (await db.execute(select(ParticipantEvent))).scalars().all()

    if format == "json":
        export_data = {
            "exported_at": datetime.now().isoformat(),
            "exported_by": current_user.email,
            "summary": {
                "total_transactions": len(transactions),
                "total_categories": len(categories),
                "total_projects": len(projects),
                "total_participants": len(participants),
            },
            "categories": [
                {"id": c.id, "name": c.name, "type": c.type, "nature": c.nature, "is_active": c.is_active}
                for c in categories
            ],
            "projects": [
                {"id": p.id, "name": p.name, "description": p.description,
                 "start_date": str(p.start_date), "end_date": str(p.end_date) if p.end_date else None,
                 "financial_goal": p.financial_goal, "status": p.status}
                for p in projects
            ],
            "transactions": [
                {"id": t.id, "date": str(t.date), "type": t.type, "value": t.value,
                 "description": t.description, "payment_method": t.payment_method,
                 "category_id": t.category_id, "member_id": t.member_id,
                 "project_id": t.project_id, "status": t.status,
                 "imported_from": t.imported_from, "is_recurring": t.is_recurring,
                 "recurring_group_id": t.recurring_group_id}
                for t in transactions
            ],
            "participant_events": [
                {"id": pe.id, "member_id": pe.member_id, "project_id": pe.project_id,
                 "agreed_value": pe.agreed_value, "paid_value": pe.paid_value, "status": pe.status}
                for pe in participants
            ],
        }
        content = json.dumps(export_data, ensure_ascii=False, indent=2)
        filename = f"backup_financeiro_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8")),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    else:  # CSV
        import csv
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "ID", "Data", "Tipo", "Valor", "Descrição", "Forma Pagamento",
            "Categoria ID", "Membro ID", "Projeto ID", "Status", "Importado de",
            "Recorrente", "Grupo Recorrência"
        ])
        for t in transactions:
            writer.writerow([
                t.id, str(t.date), t.type, t.value, t.description or "",
                t.payment_method or "", t.category_id or "", t.member_id or "",
                t.project_id or "", t.status, t.imported_from or "",
                t.is_recurring, t.recurring_group_id or ""
            ])
        content = output.getvalue()
        filename = f"backup_transacoes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8-sig")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )


# ============ PARTICIPANT EVENTS ============

async def _compute_pe_paid_values(
    db: AsyncSession,
    pes: list[ParticipantEvent],
) -> dict[int, float]:
    """Calcula paid_value real por ParticipantEvent agregando Transactions.

    Soma transactions Confirmadas tipo Entrada com mesmo (member_id, project_id).
    Retorna dict {pe_id: paid_value}.
    """
    if not pes:
        return {}
    # Agrupa transações por (member_id, project_id) das chaves dos PEs
    keys = {(pe.member_id, pe.project_id) for pe in pes}
    sums: dict[tuple[int, int], float] = {}
    if keys:
        # Um único query agregado filtrando os pares relevantes
        member_ids = list({k[0] for k in keys})
        project_ids = list({k[1] for k in keys})
        agg_q = (
            select(
                Transaction.member_id,
                Transaction.project_id,
                func.coalesce(func.sum(Transaction.value), 0),
            )
            .where(
                Transaction.member_id.in_(member_ids),
                Transaction.project_id.in_(project_ids),
                Transaction.type == "Entrada",
                Transaction.status == "Confirmado",
            )
            .group_by(Transaction.member_id, Transaction.project_id)
        )
        rows = (await db.execute(agg_q)).all()
        for member_id, project_id, total in rows:
            sums[(member_id, project_id)] = float(total or 0)
    return {pe.id: sums.get((pe.member_id, pe.project_id), 0.0) for pe in pes}


def _serialize_pe(pe: ParticipantEvent, computed_paid: float) -> dict:
    """Serializa ParticipantEvent com paid_value/status calculados.

    Regras de status derivado:
    - "Isento" preserva o valor armazenado (decisão administrativa).
    - paid >= agreed (e agreed > 0) → "Pago".
    - paid > 0 → "Parcial".
    - caso contrário → "Pendente".
    """
    stored_status = pe.status or "Pendente"
    if stored_status == "Isento":
        derived = "Isento"
    elif pe.agreed_value > 0 and computed_paid >= pe.agreed_value:
        derived = "Pago"
    elif computed_paid > 0:
        derived = "Parcial"
    else:
        derived = "Pendente"
    return {
        "id": pe.id,
        "member_id": pe.member_id,
        "project_id": pe.project_id,
        "agreed_value": float(pe.agreed_value or 0),
        "paid_value": round(computed_paid, 2),
        "status": derived,
        "created_at": pe.created_at,
    }


@router.get("/participant-events", response_model=list[ParticipantEventResponse])
async def list_participant_events(
    project_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = select(ParticipantEvent)
    if project_id:
        query = query.where(ParticipantEvent.project_id == project_id)
    result = await db.execute(query)
    pes = result.scalars().all()
    paid_map = await _compute_pe_paid_values(db, pes)
    serialized = [_serialize_pe(pe, paid_map[pe.id]) for pe in pes]
    if status:
        serialized = [s for s in serialized if s["status"] == status]
    return serialized


@router.post("/participant-events", response_model=ParticipantEventResponse)
async def create_participant_event(
    data: ParticipantEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "create"))
):
    pe = ParticipantEvent(**data.model_dump())
    db.add(pe)
    await db.flush()
    await db.refresh(pe)
    paid_map = await _compute_pe_paid_values(db, [pe])
    return _serialize_pe(pe, paid_map[pe.id])


@router.put("/participant-events/{pe_id}", response_model=ParticipantEventResponse)
async def update_participant_event(
    pe_id: int,
    data: ParticipantEventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "edit"))
):
    result = await db.execute(select(ParticipantEvent).where(ParticipantEvent.id == pe_id))
    pe = result.scalar_one_or_none()
    if not pe:
        raise HTTPException(status_code=404, detail="Participante não encontrado")

    payload = data.model_dump(exclude_unset=True)
    # paid_value passou a ser calculado a partir das Transactions vinculadas
    # ao par (member_id, project_id). O campo no payload é ignorado para
    # manter o sistema com fonte única de verdade.
    payload.pop("paid_value", None)
    # status "Isento" pode ser definido manualmente; demais valores são derivados
    # automaticamente em _serialize_pe e o que vier no payload é apenas registrado.
    for field, value in payload.items():
        setattr(pe, field, value)
    await db.flush()
    await db.refresh(pe)
    paid_map = await _compute_pe_paid_values(db, [pe])
    return _serialize_pe(pe, paid_map[pe.id])


@router.delete("/participant-events/{pe_id}")
async def delete_participant_event(
    pe_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("financeiro", "delete"))
):
    result = await db.execute(select(ParticipantEvent).where(ParticipantEvent.id == pe_id))
    pe = result.scalar_one_or_none()
    if not pe:
        raise HTTPException(status_code=404, detail="Participante não encontrado")
    await db.delete(pe)
    await db.flush()
    return {"detail": "Participante removido"}


# ============ DASHBOARD ============

@router.get("/dashboard", response_model=FinancialSummary)
async def financial_dashboard(
    project_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    forecast_days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro", "pastor"))
):
    # Caixa real: somente Confirmados
    base_confirmed = [Transaction.status == "Confirmado"]

    income_query = select(func.coalesce(func.sum(Transaction.value), 0)).where(
        Transaction.type == "Entrada", *base_confirmed
    )
    expense_query = select(func.coalesce(func.sum(Transaction.value), 0)).where(
        Transaction.type == "Saída", *base_confirmed
    )
    count_query = select(func.count(Transaction.id)).where(*base_confirmed)

    if project_id:
        income_query = income_query.where(Transaction.project_id == project_id)
        expense_query = expense_query.where(Transaction.project_id == project_id)
        count_query = count_query.where(Transaction.project_id == project_id)
    if start_date:
        income_query = income_query.where(Transaction.date >= start_date)
        expense_query = expense_query.where(Transaction.date >= start_date)
        count_query = count_query.where(Transaction.date >= start_date)
    if end_date:
        income_query = income_query.where(Transaction.date <= end_date)
        expense_query = expense_query.where(Transaction.date <= end_date)
        count_query = count_query.where(Transaction.date <= end_date)

    total_income = (await db.execute(income_query)).scalar()
    total_expense = (await db.execute(expense_query)).scalar()
    total_count = (await db.execute(count_query)).scalar()

    # Forecast: Previstos com data <= hoje + forecast_days
    today = date.today()
    horizon = today + timedelta(days=forecast_days)
    forecast_filter = [
        Transaction.status == "Previsto",
        Transaction.date <= horizon,
    ]
    if project_id:
        forecast_filter.append(Transaction.project_id == project_id)

    fc_in_q = select(
        func.coalesce(func.sum(Transaction.value), 0),
        func.count(Transaction.id),
    ).where(Transaction.type == "Entrada", *forecast_filter)
    fc_out_q = select(
        func.coalesce(func.sum(Transaction.value), 0),
        func.count(Transaction.id),
    ).where(Transaction.type == "Saída", *forecast_filter)

    fc_in_row = (await db.execute(fc_in_q)).first()
    fc_out_row = (await db.execute(fc_out_q)).first()
    forecast_in = float(fc_in_row[0] or 0)
    forecast_in_count = int(fc_in_row[1] or 0)
    forecast_out = float(fc_out_row[0] or 0)
    forecast_out_count = int(fc_out_row[1] or 0)

    # Contas a receber pendentes — soma (agreed_value - paid_calculado) de
    # ParticipantEvents não Isentos. paid_calculado vem das Transactions
    # vinculadas (member_id+project_id), que é a fonte única de verdade.
    pes_all = (
        await db.execute(select(ParticipantEvent).where(ParticipantEvent.status != "Isento"))
    ).scalars().all()
    paid_map_all = await _compute_pe_paid_values(db, pes_all)
    pending_receivables = 0.0
    for pe in pes_all:
        outstanding = float(pe.agreed_value or 0) - paid_map_all.get(pe.id, 0.0)
        if outstanding > 0:
            pending_receivables += outstanding
    pending_receivables = round(pending_receivables, 2)

    return FinancialSummary(
        total_income=total_income,
        total_expense=total_expense,
        balance=total_income - total_expense,
        total_transactions=total_count,
        forecast_in=forecast_in,
        forecast_out=forecast_out,
        forecast_in_count=forecast_in_count,
        forecast_out_count=forecast_out_count,
        pending_receivables=pending_receivables,
        pending_payables=forecast_out,
    )


# ============ CHART DATA ============

@router.get("/charts/monthly")
async def chart_monthly(
    months: int = Query(6, ge=1, le=24),
    project_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro", "pastor"))
):
    """Entradas vs Saídas agrupadas por mês (últimos N meses)."""
    today = date.today()
    start = date(today.year, today.month, 1) - timedelta(days=(months - 1) * 30)
    start = date(start.year, start.month, 1)

    month_col = _month_expr(Transaction.date)
    query = select(
        month_col.label('month'),
        Transaction.type,
        func.sum(Transaction.value).label('total')
    ).where(
        Transaction.date >= start,
        Transaction.status == "Confirmado",
    )

    if project_id:
        query = query.where(Transaction.project_id == project_id)

    query = query.group_by(
        month_col,
        Transaction.type
    ).order_by(month_col)

    rows = (await db.execute(query)).all()

    # Agrupar por mês
    months_map: dict = {}
    for row in rows:
        m = row.month
        if m not in months_map:
            months_map[m] = {"month": m, "entradas": 0, "saidas": 0}
        if row.type == "Entrada":
            months_map[m]["entradas"] = round(row.total, 2)
        else:
            months_map[m]["saidas"] = round(row.total, 2)

    return list(months_map.values())


@router.get("/charts/pending-monthly")
async def chart_pending_monthly(
    months: int = Query(6, ge=1, le=24,
                        description="Quantos meses para frente a partir do mês atual"),
    project_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro", "pastor"))
):
    """Totalizador mensal de Contas a Pagar (CP) e Contas a Receber (CR).

    Soma o valor dos lançamentos com status=Previsto agrupados pelo mês
    de vencimento (campo date), considerando do mês atual até `months`-1
    meses à frente. Devolve sempre todos os meses do intervalo (mesmo
    com total zero) para facilitar consumo na UI.
    """
    today = date.today()
    start = date(today.year, today.month, 1)
    # último mês incluído
    last_year = today.year + (today.month - 1 + months - 1) // 12
    last_month = (today.month - 1 + months - 1) % 12 + 1
    end_month_first = date(last_year, last_month, 1)
    # primeiro dia do mês seguinte ao último
    if last_month == 12:
        horizon = date(last_year + 1, 1, 1)
    else:
        horizon = date(last_year, last_month + 1, 1)

    month_col = _month_expr(Transaction.date)
    query = select(
        month_col.label('month'),
        Transaction.type,
        func.coalesce(func.sum(Transaction.value), 0).label('total'),
        func.count(Transaction.id).label('count'),
    ).where(
        Transaction.status == "Previsto",
        Transaction.date >= start,
        Transaction.date < horizon,
    )
    if project_id:
        query = query.where(Transaction.project_id == project_id)
    query = query.group_by(month_col, Transaction.type).order_by(month_col)

    rows = (await db.execute(query)).all()

    # Inicializa todos os meses do intervalo com zero
    months_map: dict[str, dict] = {}
    cursor_year, cursor_month = start.year, start.month
    for _ in range(months):
        key = f"{cursor_year:04d}-{cursor_month:02d}"
        months_map[key] = {
            "month": key,
            "receivable": 0.0,
            "payable": 0.0,
            "balance": 0.0,
            "receivable_count": 0,
            "payable_count": 0,
        }
        cursor_month += 1
        if cursor_month > 12:
            cursor_month = 1
            cursor_year += 1

    for row in rows:
        bucket = months_map.setdefault(row.month, {
            "month": row.month,
            "receivable": 0.0,
            "payable": 0.0,
            "balance": 0.0,
            "receivable_count": 0,
            "payable_count": 0,
        })
        if row.type == "Entrada":
            bucket["receivable"] = round(float(row.total), 2)
            bucket["receivable_count"] = int(row.count)
        else:
            bucket["payable"] = round(float(row.total), 2)
            bucket["payable_count"] = int(row.count)
        bucket["balance"] = round(bucket["receivable"] - bucket["payable"], 2)

    return sorted(months_map.values(), key=lambda x: x["month"])


@router.get("/charts/by-project")
async def chart_by_project(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro", "pastor"))
):
    """Distribuição de valores por projeto."""
    query = (
        select(
            Project.name.label('project_name'),
            func.coalesce(func.sum(Transaction.value), 0).label('total')
        )
        .join(Transaction, Transaction.project_id == Project.id)
        .where(Transaction.status == "Confirmado")
    )

    if start_date:
        query = query.where(Transaction.date >= start_date)
    if end_date:
        query = query.where(Transaction.date <= end_date)

    query = query.group_by(Project.id, Project.name).order_by(func.sum(Transaction.value).desc())
    rows = (await db.execute(query)).all()

    return [{"name": row.project_name, "value": round(row.total, 2)} for row in rows]


@router.get("/charts/by-category")
async def chart_by_category(
    project_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro", "pastor"))
):
    """Distribuição de valores por categoria (entrada e saída separados)."""
    query = (
        select(
            Category.name.label('category_name'),
            Transaction.type,
            func.coalesce(func.sum(Transaction.value), 0).label('total')
        )
        .join(Category, Transaction.category_id == Category.id)
        .where(Transaction.status == "Confirmado")
    )
    if project_id:
        query = query.where(Transaction.project_id == project_id)
    if start_date:
        query = query.where(Transaction.date >= start_date)
    if end_date:
        query = query.where(Transaction.date <= end_date)

    query = query.group_by(Category.id, Category.name, Transaction.type)
    rows = (await db.execute(query)).all()

    return [{"name": row.category_name, "type": row.type, "value": round(row.total, 2)} for row in rows]


@router.get("/charts/by-payment-method")
async def chart_by_payment_method(
    project_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro", "pastor"))
):
    """Distribuição de valores por forma de pagamento."""
    method_col = func.coalesce(Transaction.payment_method, 'Não informado')
    query = select(
        method_col.label('method'),
        func.sum(Transaction.value).label('total'),
        func.count(Transaction.id).label('count')
    ).where(Transaction.status == "Confirmado")
    if project_id:
        query = query.where(Transaction.project_id == project_id)
    if start_date:
        query = query.where(Transaction.date >= start_date)
    if end_date:
        query = query.where(Transaction.date <= end_date)

    query = query.group_by(Transaction.payment_method)
    rows = (await db.execute(query)).all()

    return [{"name": row.method, "value": round(row.total, 2), "count": row.count} for row in rows]


@router.post("/import/suggest-categories")
async def suggest_categories(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro"))
):
    """
    Inteligência Preditiva: sugere categorias para transações importadas
    baseando-se no histórico de descrições, beneficiários e valores.
    Body: { "transactions": [{"description": str, "value": float, "type": str}, ...] }
    """
    transactions = payload.get("transactions", [])
    if not transactions:
        return []

    # Buscar histórico de transações com categoria definida
    history_result = await db.execute(
        select(Transaction.description, Transaction.value, Transaction.type, Transaction.category_id)
        .where(Transaction.category_id.isnot(None))
        .order_by(Transaction.created_at.desc())
        .limit(500)
    )
    history = history_result.all()

    # Buscar categorias
    cats_result = await db.execute(select(Category).where(Category.is_active == True))
    categories = {c.id: {"id": c.id, "name": c.name, "type": c.type} for c in cats_result.scalars().all()}

    suggestions = []
    for tx in transactions:
        desc = (tx.get("description") or "").strip().lower()
        tx_value = tx.get("value", 0)
        tx_type = tx.get("type", "")
        best_cat_id = None
        best_score = 0

        for h in history:
            if h.type != tx_type:
                continue
            score = 0
            h_desc = (h.description or "").strip().lower()

            # Score por descrição (palavras em comum)
            if h_desc and desc:
                words_tx = set(desc.split())
                words_h = set(h_desc.split())
                common = words_tx & words_h
                if common:
                    score += len(common) / max(len(words_tx), 1) * 70

            # Score por valor similar (±10%)
            if h.value and tx_value:
                ratio = min(h.value, tx_value) / max(h.value, tx_value) if max(h.value, tx_value) > 0 else 0
                if ratio > 0.9:
                    score += 30

            if score > best_score and h.category_id in categories:
                best_score = score
                best_cat_id = h.category_id

        suggestion = {"index": len(suggestions), "category_id": None, "category_name": None, "confidence": 0}
        if best_cat_id and best_score >= 30:
            suggestion["category_id"] = best_cat_id
            suggestion["category_name"] = categories[best_cat_id]["name"]
            suggestion["confidence"] = min(round(best_score), 100)
        suggestions.append(suggestion)

    return suggestions


@router.post("/import/match-receivables")
async def match_receivables(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro"))
):
    """
    Match Bidirecional: cruza transações importadas com:
    - Entradas → Contas a Receber (ParticipantEvent pendentes + RetreatPayment pendentes)
    - Saídas → Transações provisionadas (status=Previsto, tipo=Saída)
    Body: { "transactions": [...], "project_id": int }
    """
    from ..retreat.models import RetreatPayment, RetreatParticipant, Retreat

    transactions = payload.get("transactions", [])
    matches = []

    # Buscar contas a receber pendentes (parcelas de retiro)
    pending_payments = await db.execute(
        select(RetreatPayment, RetreatParticipant, Retreat)
        .join(RetreatParticipant, RetreatPayment.participant_id == RetreatParticipant.id)
        .join(Retreat, RetreatPayment.retreat_id == Retreat.id)
        .where(RetreatPayment.status == "Pendente")
    )
    receivables = pending_payments.all()

    # Buscar saídas provisionadas
    provisioned = await db.execute(
        select(Transaction)
        .where(Transaction.status == "Previsto", Transaction.type == "Saída")
    )
    provisioned_list = provisioned.scalars().all()

    for idx, tx in enumerate(transactions):
        tx_value = tx.get("value", 0)
        tx_type = tx.get("type", "")
        tx_desc = (tx.get("description") or "").lower()
        match_info = None

        if tx_type == "Entrada":
            # Tentar match com parcelas pendentes (valor exato)
            for payment, participant, retreat in receivables:
                if round(payment.value, 2) == round(tx_value, 2):
                    p_name = participant.name or f"Membro #{participant.member_id}"
                    match_info = {
                        "type": "receivable",
                        "entity": "RetreatPayment",
                        "entity_id": payment.id,
                        "description": f"{retreat.name} - {p_name} - Parcela {payment.installment_number}",
                        "expected_value": payment.value,
                    }
                    break

        elif tx_type == "Saída":
            # Tentar match com provisionados (valor exato)
            for prov in provisioned_list:
                value_ok = round(prov.value, 2) == round(tx_value, 2)
                desc_ok = False
                if tx_desc and prov.description:
                    prov_desc = prov.description.lower()
                    words = set(tx_desc.split()) & set(prov_desc.split())
                    desc_ok = len(words) >= 2 or tx_desc in prov_desc or prov_desc in tx_desc

                if value_ok and desc_ok:
                    match_info = {
                        "type": "provisioned",
                        "entity": "Transaction",
                        "entity_id": prov.id,
                        "description": prov.description,
                        "expected_value": prov.value,
                        "expected_date": str(prov.date),
                    }
                    break
                elif value_ok:
                    match_info = {
                        "type": "provisioned_value_only",
                        "entity": "Transaction",
                        "entity_id": prov.id,
                        "description": prov.description,
                        "expected_value": prov.value,
                        "expected_date": str(prov.date),
                    }

        matches.append({"index": idx, "match": match_info})

    return matches


# ============ AUDIT LOGS ============

@router.get("/audit-logs", response_model=list[AuditLogResponse])
async def list_audit_logs(
    entity: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin"))
):
    query = select(AuditLog)
    if entity:
        query = query.where(AuditLog.entity == entity)
    query = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


# ============ IMPORTAÇÃO OFX/CSV ============

@router.post("/import")
async def import_transactions(
    file: UploadFile = File(...),
    project_id: Optional[int] = Form(None),
    category_id: Optional[int] = Form(None),
    member_id: Optional[int] = Form(None),
    bank_origin: Optional[str] = Form(None),
    type_filter: Optional[str] = Form(None),
    skip_duplicates: Optional[bool] = Form(False),
    duplicate_days: int = Form(
        3, ge=0, le=30,
        description="Tolerancia em dias para casar com Previstos e detectar duplicatas (0..30, default 3)",
    ),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro"))
):
    """
    Importa transações de arquivo OFX ou CSV.
    Retorna preview das transações e possíveis duplicidades.
    Projeto, categoria, membro e banco são opcionais.
    type_filter: 'Entrada' ou 'Saída' para importar somente um tipo.
    skip_duplicates: True para ignorar verificação de duplicatas.
    """
    content = await file.read()
    filename = (file.filename or "").lower()

    if not filename.endswith((".ofx", ".csv")):
        raise HTTPException(status_code=400, detail="Formato não suportado. Use .ofx ou .csv")

    # Verificar projeto se informado
    if project_id:
        project = await db.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Projeto não encontrado")

    preview = []
    duplicates = []

    if filename.endswith(".ofx"):
        import ofxparse
        try:
            # Pré-processar OFX: bancos brasileiros (ex: Santander) geram
            # FITID e CHECKNUM vazios, o que causa erro no ofxparse.
            content_str = content.decode('latin-1', errors='replace')
            _auto_counter = [0]
            def _fill_empty_tag(tag_name):
                def replacer(match):
                    _auto_counter[0] += 1
                    return f'<{tag_name}>AUTO{_auto_counter[0]:08d}'
                return replacer
            content_str = re.sub(r'<FITID>\s*(?=<)', _fill_empty_tag('FITID'), content_str)
            content_str = re.sub(r'<CHECKNUM>\s*(?=<)', _fill_empty_tag('CHECKNUM'), content_str)

            ofx = ofxparse.OfxParser.parse(io.BytesIO(content_str.encode('latin-1')))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Erro ao parsear OFX: {str(e)}")

        if ofx.account and ofx.account.statement:
            # Tentar extrair nome do banco do OFX
            detected_bank = bank_origin
            if not detected_bank:
                try:
                    if hasattr(ofx.account, 'institution') and ofx.account.institution:
                        detected_bank = getattr(ofx.account.institution, 'organization', None)
                except Exception:
                    pass

            for t in ofx.account.statement.transactions:
                tx_date = t.date.date() if hasattr(t.date, 'date') else t.date
                tx_type = "Entrada" if t.amount > 0 else "Saída"
                preview.append({
                    "date": str(tx_date),
                    "type": tx_type,
                    "value": round(abs(float(t.amount)), 2),
                    "description": t.memo or t.payee or "",
                    "payment_method": "Transferência Bancária",
                    "status": "Confirmado",
                    "imported_from": "ofx",
                    "bank_origin": detected_bank,
                    "bank_reference": getattr(t, 'id', None) or None,
                })

    elif filename.endswith(".csv"):
        import pandas as pd
        try:
            df = pd.read_csv(io.BytesIO(content))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Erro ao ler CSV: {str(e)}")

        required_cols = {"Data", "Valor", "Descrição"}
        if not required_cols.issubset(set(df.columns)):
            raise HTTPException(
                status_code=400,
                detail=f"CSV deve conter colunas: {', '.join(required_cols)}. Encontradas: {', '.join(df.columns)}"
            )

        for _, row in df.iterrows():
            valor = float(row["Valor"])
            preview.append({
                "date": str(row["Data"]),
                "type": "Entrada" if valor > 0 else "Saída",
                "value": round(abs(valor), 2),
                "description": str(row["Descrição"]),
                "payment_method": "Transferência Bancária",
                "status": "Confirmado",
                "imported_from": "csv",
                "bank_origin": bank_origin,
                "bank_reference": None,
            })

    # Aplicar filtro de tipo (Entrada ou Saída)
    if type_filter and type_filter in ("Entrada", "Saída"):
        preview = [tx for tx in preview if tx["type"] == type_filter]

    # ----- Match e detecção de duplicidade -----
    # Carregar Previstos e Confirmados recentes (janela ampla para cobrir ±3 dias)
    if not preview:
        return {
            "preview": [], "possiveis_duplicidades": [],
            "matches_previstos": [], "ambiguos": [],
            "total_importado": 0, "total_duplicidades": 0,
        }

    preview_dates = [
        (datetime.strptime(tx["date"], "%Y-%m-%d").date() if isinstance(tx["date"], str) else tx["date"])
        for tx in preview
    ]
    min_d = min(preview_dates) - timedelta(days=duplicate_days)
    max_d = max(preview_dates) + timedelta(days=duplicate_days)

    candidate_q = select(Transaction).where(
        Transaction.date >= min_d, Transaction.date <= max_d
    )
    if project_id:
        candidate_q = candidate_q.where(Transaction.project_id == project_id)
    candidates = (await db.execute(candidate_q)).scalars().all()

    # Coletar bank_references já confirmados (deduplicacao forte)
    confirmed_refs = {
        c.bank_reference for c in candidates
        if c.status == "Confirmado" and c.bank_reference
    }

    confirmed_list: list[dict] = []
    duplicates: list[dict] = []
    matches_previstos: list[dict] = []
    ambiguos: list[dict] = []
    used_previstos: set[int] = set()

    for tx, tx_date in zip(preview, preview_dates):
        # 1) Duplicidade forte por bank_reference
        if tx.get("bank_reference") and tx["bank_reference"] in confirmed_refs:
            ex = next(
                (c for c in candidates
                 if c.status == "Confirmado" and c.bank_reference == tx["bank_reference"]),
                None,
            )
            if ex:
                duplicates.append({
                    "arquivo": tx,
                    "existente_id": ex.id,
                    "motivo": "bank_reference",
                    "existente": _existing_dict(ex),
                })
                continue

        # 2) Procurar match com Previstos (valor exato, tipo igual, ±3 dias)
        previstos_match = [
            c for c in candidates
            if c.status == "Previsto"
            and c.id not in used_previstos
            and c.type == tx["type"]
            and round(c.value, 2) == round(tx["value"], 2)
            and abs((c.date - tx_date).days) <= duplicate_days
        ]

        if len(previstos_match) == 1:
            chosen = previstos_match[0]
            used_previstos.add(chosen.id)
            matches_previstos.append({
                "arquivo": tx,
                "previsto_id": chosen.id,
                "previsto": _existing_dict(chosen),
            })
            continue

        if len(previstos_match) > 1:
            ambiguos.append({
                "arquivo": tx,
                "candidatos": [_existing_dict(c) for c in previstos_match],
            })
            continue

        # 3) Duplicidade contra Confirmadas (valor exato, tipo igual, ±3 dias, descrição igual)
        is_dup = False
        for ex in candidates:
            if ex.status != "Confirmado":
                continue
            if ex.type != tx["type"]:
                continue
            if round(ex.value, 2) != round(tx["value"], 2):
                continue
            if abs((ex.date - tx_date).days) > duplicate_days:
                continue
            ex_desc = (ex.description or "").strip().lower()
            tx_desc = (tx["description"] or "").strip().lower()
            if ex_desc and tx_desc and ex_desc == tx_desc:
                duplicates.append({
                    "arquivo": tx,
                    "existente_id": ex.id,
                    "motivo": "valor+data+descricao",
                    "existente": _existing_dict(ex),
                })
                is_dup = True
                break
        if is_dup:
            continue

        # 4) Linha nova → confirmada
        confirmed_list.append(tx)

    # Se skip_duplicates, libera as duplicatas tambem
    if skip_duplicates:
        confirmed_list = [d["arquivo"] for d in duplicates] + confirmed_list
        duplicates = []

    return {
        "preview": confirmed_list,
        "possiveis_duplicidades": duplicates,
        "matches_previstos": matches_previstos,
        "ambiguos": ambiguos,
        "total_importado": len(confirmed_list),
        "total_duplicidades": len(duplicates),
        "total_matches_previstos": len(matches_previstos),
        "total_ambiguos": len(ambiguos),
    }


def _existing_dict(tx) -> dict:
    return {
        "id": tx.id,
        "date": str(tx.date),
        "type": tx.type,
        "value": tx.value,
        "description": tx.description,
        "status": tx.status,
        "category_id": tx.category_id,
        "project_id": tx.project_id,
    }


@router.post("/import/confirm")
async def confirm_import(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro"))
):
    """
    Confirma e salva as transações importadas.
    Body: {
      "transactions": [...],            # novas (Confirmadas)
      "matches_previstos": [...],       # itens com match: atualizam Previstos existentes
      "project_id": int | null,
      "category_id": int | null,
      "member_id": int | null,
      "bank_origin": str | null
    }
    """
    transactions = payload.get("transactions", [])
    matches_previstos = payload.get("matches_previstos", [])
    project_id = payload.get("project_id")
    global_category_id = payload.get("category_id")
    global_member_id = payload.get("member_id")
    global_bank_origin = payload.get("bank_origin")

    if not transactions and not matches_previstos:
        raise HTTPException(status_code=400, detail="Nenhuma transação ou match informado")

    created: list[Transaction] = []
    updated: list[Transaction] = []

    # 1) Atualizar Previstos com base nos matches escolhidos pelo usuário
    for m in matches_previstos:
        previsto_id = m.get("previsto_id")
        tx_data = m.get("arquivo") or {}
        if not previsto_id:
            continue
        prev = await db.get(Transaction, int(previsto_id))
        if not prev or prev.status != "Previsto":
            # Se já foi confirmado por outra rota, pula sem erro
            continue
        prev_before = {c.name: getattr(prev, c.name) for c in Transaction.__table__.columns}

        prev.status = "Confirmado"
        new_date = tx_data.get("date")
        if isinstance(new_date, str):
            try:
                new_date = datetime.strptime(new_date, "%Y-%m-%d").date()
            except ValueError:
                new_date = prev.date
        prev.payment_date = new_date or date.today()
        if tx_data.get("bank_reference"):
            prev.bank_reference = tx_data["bank_reference"]
        if tx_data.get("bank_origin") or global_bank_origin:
            prev.bank_origin = tx_data.get("bank_origin") or global_bank_origin
        prev.imported_from = tx_data.get("imported_from", prev.imported_from)
        await db.flush()
        await db.refresh(prev)
        updated.append(prev)

        db.add(AuditLog(
            action="confirm_via_import", entity="Transaction", entity_id=prev.id,
            user_id=current_user.id,
            before_data=json.dumps(prev_before, default=str),
            after_data=json.dumps(
                {c.name: getattr(prev, c.name) for c in Transaction.__table__.columns},
                default=str,
            ),
        ))

    # 2) Criar novas transações Confirmadas
    for tx_data in transactions:
        tx = Transaction(
            date=datetime.strptime(tx_data["date"], "%Y-%m-%d").date() if isinstance(tx_data["date"], str) else tx_data["date"],
            type=tx_data["type"],
            value=tx_data["value"],
            description=tx_data.get("description"),
            payment_method=tx_data.get("payment_method", "Transferência Bancária"),
            category_id=tx_data.get("category_id") or global_category_id,
            member_id=tx_data.get("member_id") or global_member_id,
            project_id=tx_data.get("project_id") or project_id,
            status=tx_data.get("status", "Confirmado"),
            imported_from=tx_data.get("imported_from", "manual"),
            bank_origin=tx_data.get("bank_origin") or global_bank_origin,
            bank_reference=tx_data.get("bank_reference"),
            payment_date=datetime.strptime(tx_data["date"], "%Y-%m-%d").date() if isinstance(tx_data["date"], str) else tx_data["date"],
            created_by=current_user.id,
        )
        db.add(tx)
        created.append(tx)

    await db.flush()
    for tx in created:
        await db.refresh(tx)

    return {
        "message": f"{len(created)} transações criadas, {len(updated)} previstos confirmados",
        "count": len(created) + len(updated),
        "created_count": len(created),
        "updated_count": len(updated),
        "transactions": [
            {"id": t.id, "date": str(t.date), "value": t.value, "type": t.type, "status": t.status}
            for t in (created + updated)
        ],
    }
