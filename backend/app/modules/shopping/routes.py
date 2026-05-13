from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...core.database import get_db
from ...core.security import get_current_user, require_permission
from ..financial.models import Transaction, AuditLog
import json

from .models import (
    ShoppingList, ShoppingListItem,
    PurchaseRequest, PurchaseRequestItem,
    PURCHASE_STATUSES,
)
from .schemas import (
    ShoppingListCreate, ShoppingListUpdate, ShoppingListResponse, ShoppingListDetailResponse,
    ShoppingListItemCreate, ShoppingListItemUpdate, ShoppingListItemResponse,
    PurchaseRequestCreate, PurchaseRequestUpdate, PurchaseRequestResponse, PurchaseRequestDetailResponse,
    PurchaseRequestItemResponse,
    ApprovalPayload, RejectionPayload, ReceivePayload,
)


router = APIRouter(prefix="/api/shopping", tags=["Compras"])


# Permissões granulares (módulo: compras)
_perm_view = require_permission("compras", "view")
_perm_create = require_permission("compras", "create")
_perm_edit = require_permission("compras", "edit")
_perm_delete = require_permission("compras", "delete")
_perm_approve = require_permission("compras", "approve")


# =================== Helpers ===================

def _list_summary(lst: ShoppingList) -> dict:
    items = list(lst.items or [])
    return {
        "items_count": len(items),
        "pending_count": sum(1 for it in items if not it.is_purchased),
    }


def _request_summary(req: PurchaseRequest) -> dict:
    items = list(req.items or [])
    total_est = sum((it.estimated_price or 0) * (it.quantity or 1) for it in items)
    total_fin = sum((it.final_price or 0) * (it.quantity or 1) for it in items)
    return {
        "items_count": len(items),
        "total_estimated": round(total_est, 2),
        "total_final": round(total_fin, 2),
    }


def _serialize_list(lst: ShoppingList, with_items: bool = False) -> dict:
    base = {
        "id": lst.id,
        "name": lst.name,
        "description": lst.description,
        "is_archived": lst.is_archived,
        "created_by_id": lst.created_by_id,
        "created_at": lst.created_at,
        **_list_summary(lst),
    }
    if with_items:
        base["items"] = [
            {
                "id": it.id, "list_id": it.list_id, "description": it.description,
                "quantity": it.quantity, "unit": it.unit,
                "estimated_price": it.estimated_price, "notes": it.notes,
                "is_purchased": it.is_purchased, "added_by_id": it.added_by_id,
                "created_at": it.created_at,
            }
            for it in (lst.items or [])
        ]
    return base


def _serialize_request(req: PurchaseRequest, with_items: bool = False) -> dict:
    base = {
        "id": req.id,
        "list_id": req.list_id,
        "title": req.title,
        "supplier": req.supplier,
        "notes": req.notes,
        "status": req.status,
        "project_id": req.project_id,
        "category_id": req.category_id,
        "requested_by_id": req.requested_by_id,
        "approved_by_id": req.approved_by_id,
        "approved_at": req.approved_at,
        "rejection_reason": req.rejection_reason,
        "received_at": req.received_at,
        "transaction_id": req.transaction_id,
        "created_at": req.created_at,
        **_request_summary(req),
    }
    if with_items:
        base["items"] = [
            {
                "id": it.id, "request_id": it.request_id, "description": it.description,
                "quantity": it.quantity, "unit": it.unit,
                "estimated_price": it.estimated_price, "final_price": it.final_price,
                "notes": it.notes,
            }
            for it in (req.items or [])
        ]
    return base


# =================== ShoppingList ===================

@router.get("/lists", response_model=list[ShoppingListResponse])
async def list_shopping_lists(
    archived: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_view),
):
    q = select(ShoppingList).options(selectinload(ShoppingList.items)).order_by(ShoppingList.id.desc())
    if archived is not None:
        q = q.where(ShoppingList.is_archived == archived)
    rows = (await db.execute(q)).scalars().all()
    return [_serialize_list(r) for r in rows]


@router.post("/lists", response_model=ShoppingListDetailResponse)
async def create_shopping_list(
    data: ShoppingListCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_create),
):
    lst = ShoppingList(
        name=data.name.strip(),
        description=data.description,
        is_archived=data.is_archived,
        created_by_id=current_user.id,
    )
    db.add(lst)
    await db.flush()
    await db.refresh(lst, attribute_names=["items"])
    return _serialize_list(lst, with_items=True)


@router.get("/lists/{list_id}", response_model=ShoppingListDetailResponse)
async def get_shopping_list(
    list_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_view),
):
    lst = (await db.execute(
        select(ShoppingList).options(selectinload(ShoppingList.items)).where(ShoppingList.id == list_id)
    )).scalar_one_or_none()
    if not lst:
        raise HTTPException(404, "Lista não encontrada")
    return _serialize_list(lst, with_items=True)


@router.put("/lists/{list_id}", response_model=ShoppingListDetailResponse)
async def update_shopping_list(
    list_id: int,
    data: ShoppingListUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    lst = (await db.execute(
        select(ShoppingList).options(selectinload(ShoppingList.items)).where(ShoppingList.id == list_id)
    )).scalar_one_or_none()
    if not lst:
        raise HTTPException(404, "Lista não encontrada")
    payload = data.model_dump(exclude_unset=True, exclude_none=True)
    for k, v in payload.items():
        setattr(lst, k, v)
    await db.flush()
    await db.refresh(lst, attribute_names=["items"])
    return _serialize_list(lst, with_items=True)


@router.delete("/lists/{list_id}")
async def delete_shopping_list(
    list_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_delete),
):
    lst = (await db.execute(select(ShoppingList).where(ShoppingList.id == list_id))).scalar_one_or_none()
    if not lst:
        raise HTTPException(404, "Lista não encontrada")
    await db.delete(lst)
    return {"detail": "Lista excluída"}


# =================== ShoppingListItem ===================

@router.post("/lists/{list_id}/items", response_model=ShoppingListItemResponse)
async def add_list_item(
    list_id: int,
    data: ShoppingListItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_create),
):
    lst = (await db.execute(select(ShoppingList).where(ShoppingList.id == list_id))).scalar_one_or_none()
    if not lst:
        raise HTTPException(404, "Lista não encontrada")
    item = ShoppingListItem(
        list_id=list_id,
        description=data.description.strip(),
        quantity=data.quantity,
        unit=data.unit,
        estimated_price=data.estimated_price,
        notes=data.notes,
        is_purchased=data.is_purchased,
        added_by_id=current_user.id,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


@router.put("/lists/{list_id}/items/{item_id}", response_model=ShoppingListItemResponse)
async def update_list_item(
    list_id: int,
    item_id: int,
    data: ShoppingListItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    item = (await db.execute(
        select(ShoppingListItem).where(
            ShoppingListItem.id == item_id, ShoppingListItem.list_id == list_id,
        )
    )).scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item não encontrado")
    payload = data.model_dump(exclude_unset=True, exclude_none=True)
    for k, v in payload.items():
        setattr(item, k, v)
    await db.flush()
    await db.refresh(item)
    return item


@router.delete("/lists/{list_id}/items/{item_id}")
async def delete_list_item(
    list_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_delete),
):
    item = (await db.execute(
        select(ShoppingListItem).where(
            ShoppingListItem.id == item_id, ShoppingListItem.list_id == list_id,
        )
    )).scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item não encontrado")
    await db.delete(item)
    return {"detail": "Item excluído"}


# =================== Generate PurchaseRequest from List ===================

@router.post("/lists/{list_id}/generate-request", response_model=PurchaseRequestDetailResponse)
async def generate_request_from_list(
    list_id: int,
    title: Optional[str] = Query(None, description="Título do pedido (default: nome da lista)"),
    only_pending: bool = Query(True, description="Se True, inclui apenas itens com is_purchased=False"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_create),
):
    lst = (await db.execute(
        select(ShoppingList).options(selectinload(ShoppingList.items)).where(ShoppingList.id == list_id)
    )).scalar_one_or_none()
    if not lst:
        raise HTTPException(404, "Lista não encontrada")
    items_src = [it for it in lst.items if (not only_pending or not it.is_purchased)]
    if not items_src:
        raise HTTPException(400, "Nenhum item disponível na lista para gerar o pedido")

    req = PurchaseRequest(
        list_id=list_id,
        title=(title or f"Pedido — {lst.name}").strip()[:200],
        status="Pendente",
        requested_by_id=current_user.id,
    )
    db.add(req)
    await db.flush()

    for src in items_src:
        db.add(PurchaseRequestItem(
            request_id=req.id,
            description=src.description,
            quantity=src.quantity,
            unit=src.unit,
            estimated_price=src.estimated_price,
            notes=src.notes,
        ))
    await db.flush()
    await db.refresh(req, attribute_names=["items"])
    return _serialize_request(req, with_items=True)


# =================== PurchaseRequest CRUD ===================

@router.get("/requests", response_model=list[PurchaseRequestResponse])
async def list_purchase_requests(
    status: Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_view),
):
    q = select(PurchaseRequest).options(selectinload(PurchaseRequest.items)).order_by(PurchaseRequest.id.desc())
    if status:
        if status not in PURCHASE_STATUSES:
            raise HTTPException(400, f"status inválido. Use um de: {', '.join(PURCHASE_STATUSES)}")
        q = q.where(PurchaseRequest.status == status)
    if project_id:
        q = q.where(PurchaseRequest.project_id == project_id)
    rows = (await db.execute(q)).scalars().all()
    return [_serialize_request(r) for r in rows]


@router.post("/requests", response_model=PurchaseRequestDetailResponse)
async def create_purchase_request(
    data: PurchaseRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_create),
):
    req = PurchaseRequest(
        list_id=data.list_id,
        title=data.title.strip(),
        supplier=data.supplier,
        notes=data.notes,
        project_id=data.project_id,
        category_id=data.category_id,
        status="Pendente",
        requested_by_id=current_user.id,
    )
    db.add(req)
    await db.flush()
    for it in data.items:
        db.add(PurchaseRequestItem(
            request_id=req.id,
            description=it.description, quantity=it.quantity, unit=it.unit,
            estimated_price=it.estimated_price, final_price=it.final_price, notes=it.notes,
        ))
    await db.flush()
    await db.refresh(req, attribute_names=["items"])
    return _serialize_request(req, with_items=True)


@router.get("/requests/{request_id}", response_model=PurchaseRequestDetailResponse)
async def get_purchase_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_view),
):
    req = (await db.execute(
        select(PurchaseRequest).options(selectinload(PurchaseRequest.items)).where(PurchaseRequest.id == request_id)
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Pedido não encontrado")
    return _serialize_request(req, with_items=True)


@router.put("/requests/{request_id}", response_model=PurchaseRequestDetailResponse)
async def update_purchase_request(
    request_id: int,
    data: PurchaseRequestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    req = (await db.execute(
        select(PurchaseRequest).options(selectinload(PurchaseRequest.items)).where(PurchaseRequest.id == request_id)
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Pedido não encontrado")
    if req.status not in ("Pendente", "Aprovado"):
        raise HTTPException(400, f"Pedido em status '{req.status}' não pode ser editado")

    payload = data.model_dump(exclude_unset=True)
    new_items = payload.pop("items", None)
    for k, v in payload.items():
        if v is not None:
            setattr(req, k, v)
    if new_items is not None:
        # substitui itens
        for old in list(req.items):
            await db.delete(old)
        await db.flush()
        for it in new_items:
            db.add(PurchaseRequestItem(
                request_id=req.id,
                description=it["description"], quantity=it.get("quantity", 1.0),
                unit=it.get("unit"), estimated_price=it.get("estimated_price"),
                final_price=it.get("final_price"), notes=it.get("notes"),
            ))
    await db.flush()
    await db.refresh(req, attribute_names=["items"])
    return _serialize_request(req, with_items=True)


@router.delete("/requests/{request_id}")
async def delete_purchase_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_delete),
):
    req = (await db.execute(select(PurchaseRequest).where(PurchaseRequest.id == request_id))).scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Pedido não encontrado")
    if req.status == "Recebido":
        raise HTTPException(400, "Pedido já recebido — exclua a transação financeira primeiro se necessário")
    await db.delete(req)
    return {"detail": "Pedido excluído"}


# =================== Workflow: Approve / Reject / Receive ===================

@router.post("/requests/{request_id}/approve", response_model=PurchaseRequestDetailResponse)
async def approve_request(
    request_id: int,
    data: Optional[ApprovalPayload] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_approve),
):
    req = (await db.execute(
        select(PurchaseRequest).options(selectinload(PurchaseRequest.items)).where(PurchaseRequest.id == request_id)
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Pedido não encontrado")
    if req.status != "Pendente":
        raise HTTPException(400, f"Apenas pedidos Pendentes podem ser aprovados (atual: {req.status})")
    req.status = "Aprovado"
    req.approved_by_id = current_user.id
    req.approved_at = datetime.utcnow()
    if data and data.notes:
        req.notes = (req.notes + "\n" if req.notes else "") + f"[Aprovação] {data.notes}"
    db.add(AuditLog(
        action="approve_purchase",
        entity="PurchaseRequest",
        entity_id=req.id,
        user_id=current_user.id,
        after_data=json.dumps({"approved_by": current_user.id}, default=str),
    ))
    await db.flush()
    await db.refresh(req, attribute_names=["items"])
    return _serialize_request(req, with_items=True)


@router.post("/requests/{request_id}/reject", response_model=PurchaseRequestDetailResponse)
async def reject_request(
    request_id: int,
    data: RejectionPayload,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_approve),
):
    req = (await db.execute(
        select(PurchaseRequest).options(selectinload(PurchaseRequest.items)).where(PurchaseRequest.id == request_id)
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Pedido não encontrado")
    if req.status != "Pendente":
        raise HTTPException(400, f"Apenas pedidos Pendentes podem ser rejeitados (atual: {req.status})")
    req.status = "Rejeitado"
    req.approved_by_id = current_user.id
    req.approved_at = datetime.utcnow()
    req.rejection_reason = data.reason
    db.add(AuditLog(
        action="reject_purchase",
        entity="PurchaseRequest",
        entity_id=req.id,
        user_id=current_user.id,
        after_data=json.dumps({"reason": data.reason}, default=str),
    ))
    await db.flush()
    await db.refresh(req, attribute_names=["items"])
    return _serialize_request(req, with_items=True)


@router.post("/requests/{request_id}/receive", response_model=PurchaseRequestDetailResponse)
async def receive_request(
    request_id: int,
    data: ReceivePayload,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    req = (await db.execute(
        select(PurchaseRequest).options(selectinload(PurchaseRequest.items)).where(PurchaseRequest.id == request_id)
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Pedido não encontrado")
    if req.status != "Aprovado":
        raise HTTPException(400, f"Apenas pedidos Aprovados podem ser recebidos (atual: {req.status})")
    if not req.items:
        raise HTTPException(400, "Pedido sem itens")

    # Atualiza final_price dos itens, se fornecido
    if data.items:
        finals = {int(x["id"]): float(x.get("final_price") or 0) for x in data.items if x.get("id") is not None}
        for it in req.items:
            if it.id in finals:
                it.final_price = finals[it.id]

    # Calcula total final (usa estimated quando final ausente)
    total = sum(((it.final_price if it.final_price is not None else (it.estimated_price or 0)) * (it.quantity or 1)) for it in req.items)
    if total <= 0:
        raise HTTPException(400, "Total do pedido é zero — informe final_price ou estimated_price nos itens")

    # Cria Transaction Saída
    pay_date: Optional[date] = None
    if data.payment_date:
        try:
            pay_date = date.fromisoformat(data.payment_date)
        except ValueError:
            raise HTTPException(400, "payment_date deve ser ISO (YYYY-MM-DD)")
    tx_status = data.status if data.status in ("Previsto", "Confirmado") else "Confirmado"
    tx = Transaction(
        date=pay_date or date.today(),
        type="Saída",
        value=round(total, 2),
        description=f"Compra: {req.title}" + (f" — {req.supplier}" if req.supplier else ""),
        payment_method=data.payment_method,
        category_id=req.category_id,
        project_id=req.project_id,
        status=tx_status,
        payment_date=pay_date or date.today() if tx_status == "Confirmado" else None,
        created_by=current_user.id,
        imported_from="compras",
    )
    db.add(tx)
    await db.flush()

    req.status = "Recebido"
    req.received_at = datetime.utcnow()
    req.transaction_id = tx.id
    db.add(AuditLog(
        action="receive_purchase",
        entity="PurchaseRequest",
        entity_id=req.id,
        user_id=current_user.id,
        after_data=json.dumps({"transaction_id": tx.id, "total": round(total, 2)}, default=str),
    ))
    await db.flush()
    await db.refresh(req, attribute_names=["items"])
    return _serialize_request(req, with_items=True)


# =================== Dashboard ===================

@router.get("/dashboard")
async def shopping_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_view),
):
    """KPIs simples: contagem por status + total recebido no mês."""
    rows = (await db.execute(
        select(PurchaseRequest.status, func.count(PurchaseRequest.id)).group_by(PurchaseRequest.status)
    )).all()
    by_status = {s: 0 for s in PURCHASE_STATUSES}
    for s, c in rows:
        by_status[s] = c

    today = date.today()
    first = today.replace(day=1)
    received_month = (await db.execute(
        select(func.coalesce(func.sum(Transaction.value), 0)).where(
            Transaction.imported_from == "compras",
            Transaction.date >= first,
        )
    )).scalar_one() or 0

    return {
        "by_status": by_status,
        "received_month_total": float(received_month),
    }
