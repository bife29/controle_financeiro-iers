import json
import io
import tempfile
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from datetime import date, datetime, timedelta
from ...core.database import get_db
from ...core.security import get_current_user, require_roles
from .models import Category, Project, Transaction, ParticipantEvent, AuditLog
from .schemas import (
    CategoryCreate, CategoryResponse,
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectDashboard,
    TransactionCreate, TransactionUpdate, TransactionResponse,
    ParticipantEventCreate, ParticipantEventUpdate, ParticipantEventResponse,
    AuditLogResponse, FinancialSummary
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
    current_user=Depends(require_roles("super_admin", "financeiro"))
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
    current_user=Depends(require_roles("super_admin", "financeiro"))
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
    current_user=Depends(require_roles("super_admin", "financeiro"))
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
    current_user=Depends(require_roles("super_admin", "financeiro", "pastor"))
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
    current_user=Depends(require_roles("super_admin", "financeiro"))
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
    current_user=Depends(require_roles("super_admin"))
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    # Remove transações vinculadas primeiro
    await db.execute(
        select(Transaction).where(Transaction.project_id == project_id)
    )
    from sqlalchemy import delete as sa_delete
    await db.execute(sa_delete(Transaction).where(Transaction.project_id == project_id))
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

    # Total Recebido (Entradas conciliadas deste projeto)
    income = await db.execute(
        select(func.coalesce(func.sum(Transaction.value), 0))
        .where(Transaction.project_id == project_id, Transaction.type == "Entrada")
    )
    total_received = income.scalar()

    # Total Gasto (Saídas deste projeto)
    expense = await db.execute(
        select(func.coalesce(func.sum(Transaction.value), 0))
        .where(Transaction.project_id == project_id, Transaction.type == "Saída")
    )
    total_spent = expense.scalar()

    # Participantes
    participants = await db.execute(
        select(func.count(ParticipantEvent.id))
        .where(ParticipantEvent.project_id == project_id)
    )
    participant_count = participants.scalar()

    paid = await db.execute(
        select(func.count(ParticipantEvent.id))
        .where(ParticipantEvent.project_id == project_id, ParticipantEvent.status == "Pago")
    )
    paid_count = paid.scalar()

    pending = await db.execute(
        select(func.count(ParticipantEvent.id))
        .where(ParticipantEvent.project_id == project_id, ParticipantEvent.status == "Pendente")
    )
    pending_count = pending.scalar()

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
    project_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro", "pastor"))
):
    query = select(Transaction)
    if project_id:
        query = query.where(Transaction.project_id == project_id)
    if type:
        query = query.where(Transaction.type == type)
    if start_date:
        query = query.where(Transaction.date >= start_date)
    if end_date:
        query = query.where(Transaction.date <= end_date)
    query = query.order_by(Transaction.date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/transactions", response_model=TransactionResponse)
async def create_transaction(
    data: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro"))
):
    transaction = Transaction(**data.model_dump(), created_by=current_user.id)
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


@router.put("/transactions/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro"))
):
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    before = {c.name: getattr(transaction, c.name) for c in Transaction.__table__.columns}

    for field, value in data.model_dump(exclude_unset=True).items():
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


@router.delete("/transactions/{transaction_id}")
async def delete_transaction(
    transaction_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro"))
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


# ============ PARTICIPANT EVENTS ============

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
    if status:
        query = query.where(ParticipantEvent.status == status)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/participant-events", response_model=ParticipantEventResponse)
async def create_participant_event(
    data: ParticipantEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro"))
):
    pe = ParticipantEvent(**data.model_dump())
    db.add(pe)
    await db.flush()
    await db.refresh(pe)
    return pe


@router.put("/participant-events/{pe_id}", response_model=ParticipantEventResponse)
async def update_participant_event(
    pe_id: int,
    data: ParticipantEventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro"))
):
    result = await db.execute(select(ParticipantEvent).where(ParticipantEvent.id == pe_id))
    pe = result.scalar_one_or_none()
    if not pe:
        raise HTTPException(status_code=404, detail="Participante não encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(pe, field, value)
    await db.flush()
    await db.refresh(pe)
    return pe


# ============ DASHBOARD ============

@router.get("/dashboard", response_model=FinancialSummary)
async def financial_dashboard(
    project_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro", "pastor"))
):
    # Filtros base
    income_query = select(func.coalesce(func.sum(Transaction.value), 0)).where(Transaction.type == "Entrada")
    expense_query = select(func.coalesce(func.sum(Transaction.value), 0)).where(Transaction.type == "Saída")
    count_query = select(func.count(Transaction.id))

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

    # Contas a receber pendentes (participantes pendentes)
    receivables = await db.execute(
        select(func.coalesce(func.sum(ParticipantEvent.agreed_value - ParticipantEvent.paid_value), 0))
        .where(ParticipantEvent.status == "Pendente")
    )
    pending_receivables = receivables.scalar()

    return FinancialSummary(
        total_income=total_income,
        total_expense=total_expense,
        balance=total_income - total_expense,
        total_transactions=total_count,
        pending_receivables=pending_receivables,
        pending_payables=0,  # Implementar quando contas a pagar forem adicionadas
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

    query = select(
        func.strftime('%Y-%m', Transaction.date).label('month'),
        Transaction.type,
        func.sum(Transaction.value).label('total')
    ).where(Transaction.date >= start)

    if project_id:
        query = query.where(Transaction.project_id == project_id)

    query = query.group_by(
        func.strftime('%Y-%m', Transaction.date),
        Transaction.type
    ).order_by(func.strftime('%Y-%m', Transaction.date))

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
    query = select(
        func.coalesce(Transaction.payment_method, 'Não informado').label('method'),
        func.sum(Transaction.value).label('total'),
        func.count(Transaction.id).label('count')
    )
    if project_id:
        query = query.where(Transaction.project_id == project_id)
    if start_date:
        query = query.where(Transaction.date >= start_date)
    if end_date:
        query = query.where(Transaction.date <= end_date)

    query = query.group_by(func.coalesce(Transaction.payment_method, 'Não informado'))
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
            # Tentar match com parcelas pendentes
            for payment, participant, retreat in receivables:
                if abs(payment.value - tx_value) <= 0.03:
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
            # Tentar match com provisionados
            for prov in provisioned_list:
                value_ok = abs(prov.value - tx_value) <= 0.03
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
    project_id: int = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro"))
):
    """
    Importa transações de arquivo OFX ou CSV.
    Retorna preview das transações e possíveis duplicidades.
    """
    content = await file.read()
    filename = (file.filename or "").lower()

    if not filename.endswith((".ofx", ".csv")):
        raise HTTPException(status_code=400, detail="Formato não suportado. Use .ofx ou .csv")

    # Verificar projeto existe
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    preview = []
    duplicates = []

    if filename.endswith(".ofx"):
        import ofxparse
        try:
            ofx = ofxparse.OfxParser.parse(io.BytesIO(content))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Erro ao parsear OFX: {str(e)}")

        if ofx.account and ofx.account.statement:
            for t in ofx.account.statement.transactions:
                tx_date = t.date.date() if hasattr(t.date, 'date') else t.date
                tx_type = "Entrada" if t.amount > 0 else "Saída"
                preview.append({
                    "date": str(tx_date),
                    "type": tx_type,
                    "value": abs(float(t.amount)),
                    "description": t.memo or t.payee or "",
                    "payment_method": "Transferência Bancária",
                    "status": "Previsto",
                    "imported_from": "ofx",
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
                "value": abs(valor),
                "description": str(row["Descrição"]),
                "payment_method": "Transferência Bancária",
                "status": "Previsto",
                "imported_from": "csv",
            })

    # Verificar duplicidades (transações existentes do mesmo projeto com valores/datas similares)
    existing_result = await db.execute(
        select(Transaction).where(Transaction.project_id == project_id)
    )
    existing = existing_result.scalars().all()

    confirmed = []
    for tx in preview:
        is_dup = False
        for ex in existing:
            try:
                valor_ok = abs(ex.value - tx["value"]) <= 0.03
                tx_date = datetime.strptime(tx["date"], "%Y-%m-%d").date() if isinstance(tx["date"], str) else tx["date"]
                data_ok = abs((ex.date - tx_date).days) <= 3
                desc_ok = (ex.description or "").strip().lower() == tx["description"].strip().lower()
                if valor_ok and data_ok and desc_ok:
                    is_dup = True
                    duplicates.append({
                        "arquivo": tx,
                        "existente_id": ex.id,
                        "existente": {
                            "id": ex.id,
                            "date": str(ex.date),
                            "type": ex.type,
                            "value": ex.value,
                            "description": ex.description,
                            "status": ex.status,
                        }
                    })
                    break
            except Exception:
                continue
        if not is_dup:
            confirmed.append(tx)

    return {
        "preview": confirmed,
        "possiveis_duplicidades": duplicates,
        "total_importado": len(confirmed),
        "total_duplicidades": len(duplicates),
    }


@router.post("/import/confirm")
async def confirm_import(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "financeiro"))
):
    """
    Confirma e salva as transações importadas no banco de dados.
    Body: { "transactions": [...], "project_id": int }
    """
    transactions = payload.get("transactions", [])
    project_id = payload.get("project_id")
    if not transactions or not project_id:
        raise HTTPException(status_code=400, detail="transactions e project_id são obrigatórios")
    created = []
    for tx_data in transactions:
        tx = Transaction(
            date=datetime.strptime(tx_data["date"], "%Y-%m-%d").date() if isinstance(tx_data["date"], str) else tx_data["date"],
            type=tx_data["type"],
            value=tx_data["value"],
            description=tx_data.get("description"),
            payment_method=tx_data.get("payment_method", "Transferência Bancária"),
            category_id=tx_data.get("category_id"),
            project_id=project_id,
            status=tx_data.get("status", "Previsto"),
            imported_from=tx_data.get("imported_from", "manual"),
            created_by=current_user.id,
        )
        db.add(tx)
        created.append(tx)

    await db.flush()
    for tx in created:
        await db.refresh(tx)

    return {
        "message": f"{len(created)} transações importadas com sucesso",
        "count": len(created),
        "transactions": [{"id": t.id, "date": str(t.date), "value": t.value, "type": t.type} for t in created],
    }
