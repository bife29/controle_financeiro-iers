"""Endpoints de relatórios analíticos.

Cada relatório aceita ?format=pdf|xlsx (default pdf) e devolve o arquivo
binário pronto para download.

Permissões: super_admin, pastor, financeiro.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...core.database import get_db
from ...core.security import require_roles
from ..financial.models import Category, Project, Transaction
from ..members.models import Member
from .renderers import render_pdf, render_xlsx, streaming_response

router = APIRouter(prefix="/api/reports", tags=["Relatórios"])

ROLES = ("super_admin", "pastor", "financeiro")
auth_dep = require_roles(*ROLES)


# ---------- helpers ----------

def _br_date(d) -> str:
    if d is None:
        return ""
    if isinstance(d, datetime):
        d = d.date()
    return d.strftime("%d/%m/%Y")


def _period_subtitle(start: Optional[date], end: Optional[date]) -> str:
    if start and end:
        return f"Período: {_br_date(start)} a {_br_date(end)}"
    if start:
        return f"A partir de {_br_date(start)}"
    if end:
        return f"Até {_br_date(end)}"
    return "Período: todos os lançamentos"


def _build(fmt: str, *, title: str, subtitle: str, columns=None, rows=None,
           totals=None, sections=None, filename_base: str = "relatorio"):
    fmt = (fmt or "pdf").lower()
    if fmt not in ("pdf", "xlsx"):
        raise HTTPException(status_code=400, detail="format deve ser pdf ou xlsx")
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    filename = f"{filename_base}-{stamp}.{fmt}"
    if fmt == "xlsx":
        content = render_xlsx(title, subtitle, columns or [], rows or [], totals=totals, sections=sections)
    else:
        content = render_pdf(title, subtitle, columns or [], rows or [], totals=totals, sections=sections)
    return streaming_response(content, filename, fmt)


async def _filter_transactions(
    db: AsyncSession,
    *,
    start: Optional[date] = None,
    end: Optional[date] = None,
    type_: Optional[str] = None,
    status: Optional[str] = None,
    project_id: Optional[int] = None,
    category_id: Optional[int] = None,
    member_id: Optional[int] = None,
) -> list[Transaction]:
    q = select(Transaction).options(
        selectinload(Transaction.category),
        selectinload(Transaction.project),
    )
    if start:
        q = q.where(Transaction.date >= start)
    if end:
        q = q.where(Transaction.date <= end)
    if type_:
        q = q.where(Transaction.type == type_)
    if status:
        q = q.where(Transaction.status == status)
    if project_id:
        q = q.where(Transaction.project_id == project_id)
    if category_id:
        q = q.where(Transaction.category_id == category_id)
    if member_id:
        q = q.where(Transaction.member_id == member_id)
    q = q.order_by(Transaction.date.asc(), Transaction.id.asc())
    res = await db.execute(q)
    return list(res.scalars().all())


# ============================================================
# 1) LIVRO CAIXA / DIÁRIO — transações por período
# ============================================================

@router.get("/cashbook")
async def report_cashbook(
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    status: Optional[str] = Query("Confirmado"),
    format: str = Query("pdf"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(auth_dep),
):
    txs = await _filter_transactions(db, start=start, end=end, status=status or None)

    columns = [
        ("Data", "date", "center"),
        ("Tipo", "type", "center"),
        ("Categoria", "category", "left"),
        ("Projeto", "project", "left"),
        ("Descrição", "description", "left"),
        ("Status", "status", "center"),
        ("Entrada", "income", "right"),
        ("Saída", "expense", "right"),
    ]
    rows = []
    total_in = 0.0
    total_out = 0.0
    for t in txs:
        income = t.value if t.type == "Entrada" else None
        expense = t.value if t.type == "Saída" else None
        if income:
            total_in += income
        if expense:
            total_out += expense
        rows.append({
            "date": _br_date(t.date),
            "type": t.type,
            "category": t.category.name if t.category else "—",
            "project": t.project.name if t.project else "—",
            "description": t.description or "",
            "status": t.status,
            "income": income,
            "expense": expense,
        })

    totals = {
        "date": "TOTAL",
        "income": round(total_in, 2),
        "expense": round(total_out, 2),
        "description": f"Saldo: {total_in - total_out:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
    }

    status_label = status or "Todos"
    subtitle = f"{_period_subtitle(start, end)} • Status: {status_label}"

    return _build(
        format,
        title="Livro Caixa",
        subtitle=subtitle,
        columns=columns,
        rows=rows,
        totals=totals,
        filename_base="livro-caixa",
    )


# ============================================================
# 2) RELATÓRIO POR CATEGORIA
# ============================================================

@router.get("/by-category")
async def report_by_category(
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    type: Optional[str] = Query(None, description="Entrada / Saída / vazio = ambos"),
    status: Optional[str] = Query("Confirmado"),
    format: str = Query("pdf"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(auth_dep),
):
    txs = await _filter_transactions(db, start=start, end=end, type_=type, status=status or None)

    # agrupa por categoria
    grouped: dict[str, list[Transaction]] = defaultdict(list)
    for t in txs:
        key = t.category.name if t.category else "(Sem categoria)"
        grouped[key].append(t)

    columns = [
        ("Data", "date", "center"),
        ("Tipo", "type", "center"),
        ("Projeto", "project", "left"),
        ("Descrição", "description", "left"),
        ("Status", "status", "center"),
        ("Valor", "value", "right"),
    ]

    sections = []
    grand_total = 0.0
    for cat_name in sorted(grouped.keys()):
        items = grouped[cat_name]
        rows = []
        subtotal = 0.0
        for t in items:
            signed = t.value if t.type == "Entrada" else -t.value
            subtotal += signed
            rows.append({
                "date": _br_date(t.date),
                "type": t.type,
                "project": t.project.name if t.project else "—",
                "description": t.description or "",
                "status": t.status,
                "value": round(t.value, 2) * (1 if t.type == "Entrada" else -1),
            })
        grand_total += subtotal
        sections.append({
            "title": f"{cat_name}  —  {len(items)} lançamento(s)",
            "columns": columns,
            "rows": rows,
            "totals": {"date": "Subtotal", "value": round(subtotal, 2)},
        })

    if not sections:
        sections.append({
            "title": "Sem lançamentos no período",
            "columns": columns,
            "rows": [],
        })

    subtitle = f"{_period_subtitle(start, end)} • Tipo: {type or 'Todos'} • Status: {status or 'Todos'}"
    subtitle += f" • Total geral: {grand_total:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    return _build(
        format,
        title="Relatório por Categoria",
        subtitle=subtitle,
        sections=sections,
        filename_base="relatorio-por-categoria",
    )


# ============================================================
# 3) RELATÓRIO POR PROJETO / EVENTO
# ============================================================

@router.get("/by-project")
async def report_by_project(
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    project_id: Optional[int] = Query(None),
    status: Optional[str] = Query("Confirmado"),
    format: str = Query("pdf"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(auth_dep),
):
    txs = await _filter_transactions(db, start=start, end=end, project_id=project_id, status=status or None)

    grouped: dict[str, list[Transaction]] = defaultdict(list)
    for t in txs:
        key = t.project.name if t.project else "(Sem projeto)"
        grouped[key].append(t)

    columns = [
        ("Data", "date", "center"),
        ("Tipo", "type", "center"),
        ("Categoria", "category", "left"),
        ("Descrição", "description", "left"),
        ("Status", "status", "center"),
        ("Entrada", "income", "right"),
        ("Saída", "expense", "right"),
    ]

    sections = []
    grand_in = grand_out = 0.0
    for proj_name in sorted(grouped.keys()):
        items = grouped[proj_name]
        rows = []
        sub_in = sub_out = 0.0
        for t in items:
            inc = t.value if t.type == "Entrada" else None
            exp = t.value if t.type == "Saída" else None
            if inc:
                sub_in += inc
            if exp:
                sub_out += exp
            rows.append({
                "date": _br_date(t.date),
                "type": t.type,
                "category": t.category.name if t.category else "—",
                "description": t.description or "",
                "status": t.status,
                "income": inc,
                "expense": exp,
            })
        grand_in += sub_in
        grand_out += sub_out
        sections.append({
            "title": f"{proj_name}  —  {len(items)} lançamento(s) • Saldo: {sub_in - sub_out:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
            "columns": columns,
            "rows": rows,
            "totals": {
                "date": "Subtotal",
                "income": round(sub_in, 2),
                "expense": round(sub_out, 2),
            },
        })

    if not sections:
        sections.append({"title": "Sem lançamentos no período", "columns": columns, "rows": []})

    subtitle = f"{_period_subtitle(start, end)} • Status: {status or 'Todos'}"
    subtitle += f" • Total entradas: {grand_in:,.2f} • Total saídas: {grand_out:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    return _build(
        format,
        title="Relatório por Projeto / Evento",
        subtitle=subtitle,
        sections=sections,
        filename_base="relatorio-por-projeto",
    )


# ============================================================
# 4) PROJETOS POR MEMBRO — pagamentos realizados por pessoa
# ============================================================

@router.get("/projects-by-member")
async def report_projects_by_member(
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    member_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    format: str = Query("pdf"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(auth_dep),
):
    # apenas Entradas Confirmadas com member_id preenchido
    q = select(Transaction).options(
        selectinload(Transaction.category),
        selectinload(Transaction.project),
    ).where(
        Transaction.type == "Entrada",
        Transaction.status == "Confirmado",
        Transaction.member_id.is_not(None),
    )
    if start:
        q = q.where(Transaction.date >= start)
    if end:
        q = q.where(Transaction.date <= end)
    if member_id:
        q = q.where(Transaction.member_id == member_id)
    if project_id:
        q = q.where(Transaction.project_id == project_id)
    q = q.order_by(Transaction.member_id.asc(), Transaction.date.asc())
    res = await db.execute(q)
    txs = list(res.scalars().all())

    member_ids = {t.member_id for t in txs if t.member_id}
    members_map: dict[int, str] = {}
    if member_ids:
        mres = await db.execute(select(Member.id, Member.name).where(Member.id.in_(member_ids)))
        members_map = {row[0]: row[1] for row in mres.all()}

    grouped: dict[str, list[Transaction]] = defaultdict(list)
    for t in txs:
        key = members_map.get(t.member_id, f"(Membro #{t.member_id})") if t.member_id else "(Sem membro)"
        grouped[key].append(t)

    columns = [
        ("Data", "date", "center"),
        ("Projeto/Evento", "project", "left"),
        ("Categoria", "category", "left"),
        ("Descrição", "description", "left"),
        ("Forma pagto", "method", "center"),
        ("Valor pago", "value", "right"),
    ]

    sections = []
    grand_total = 0.0
    for member_name in sorted(grouped.keys()):
        items = grouped[member_name]
        rows = []
        subtotal = 0.0
        for t in items:
            subtotal += t.value
            rows.append({
                "date": _br_date(t.date),
                "project": t.project.name if t.project else "—",
                "category": t.category.name if t.category else "—",
                "description": t.description or "",
                "method": t.payment_method or "—",
                "value": round(t.value, 2),
            })
        grand_total += subtotal
        sections.append({
            "title": f"{member_name}  —  {len(items)} pagamento(s)",
            "columns": columns,
            "rows": rows,
            "totals": {"date": "Subtotal", "value": round(subtotal, 2)},
        })

    if not sections:
        sections.append({"title": "Nenhum pagamento de membro no período", "columns": columns, "rows": []})

    subtitle = f"{_period_subtitle(start, end)}"
    subtitle += f" • Total geral: {grand_total:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    return _build(
        format,
        title="Pagamentos por Membro (Projetos / Eventos)",
        subtitle=subtitle,
        sections=sections,
        filename_base="pagamentos-por-membro",
    )


# ============================================================
# 5) CONTAS A PAGAR / A RECEBER (Previstos) por período
# ============================================================

@router.get("/payables-receivables")
async def report_payables_receivables(
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    type: Optional[str] = Query(None, description="Entrada (a receber) / Saída (a pagar) / vazio = ambos"),
    format: str = Query("pdf"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(auth_dep),
):
    txs = await _filter_transactions(db, start=start, end=end, type_=type, status="Previsto")

    columns = [
        ("Vencimento", "date", "center"),
        ("Tipo", "type", "center"),
        ("Categoria", "category", "left"),
        ("Projeto", "project", "left"),
        ("Descrição", "description", "left"),
        ("Recorrente", "recurring", "center"),
        ("Valor", "value", "right"),
    ]

    receivables = [t for t in txs if t.type == "Entrada"]
    payables = [t for t in txs if t.type == "Saída"]

    def _to_rows(items):
        rows = []
        total = 0.0
        for t in items:
            total += t.value
            rows.append({
                "date": _br_date(t.date),
                "type": t.type,
                "category": t.category.name if t.category else "—",
                "project": t.project.name if t.project else "—",
                "description": t.description or "",
                "recurring": "Sim" if t.is_recurring else "Não",
                "value": round(t.value, 2),
            })
        return rows, total

    sections = []
    if type in (None, "Entrada"):
        rows, total = _to_rows(receivables)
        sections.append({
            "title": f"Contas a Receber  —  {len(receivables)} item(ns)",
            "columns": columns,
            "rows": rows,
            "totals": {"date": "Subtotal a Receber", "value": round(total, 2)},
        })
    if type in (None, "Saída"):
        rows, total = _to_rows(payables)
        sections.append({
            "title": f"Contas a Pagar  —  {len(payables)} item(ns)",
            "columns": columns,
            "rows": rows,
            "totals": {"date": "Subtotal a Pagar", "value": round(total, 2)},
        })

    total_in = sum(t.value for t in receivables)
    total_out = sum(t.value for t in payables)
    subtitle = f"{_period_subtitle(start, end)}"
    subtitle += f" • A receber: {total_in:,.2f} • A pagar: {total_out:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    return _build(
        format,
        title="Contas a Pagar e a Receber",
        subtitle=subtitle,
        sections=sections,
        filename_base="contas-pagar-receber",
    )
