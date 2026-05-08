from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...core.database import get_db
from ...core.security import get_current_user, require_roles, require_permission
from ..financial.models import Transaction
from .models import Asset, AssetCategory, AssetLocation, AssetMaintenance
from .schemas import (
    AssetCategoryCreate, AssetCategoryResponse, AssetCategoryUpdate,
    AssetLocationCreate, AssetLocationResponse, AssetLocationUpdate,
    AssetCreate, AssetUpdate, AssetResponse, AssetDetailResponse,
    AssetMaintenanceCreate, AssetMaintenanceUpdate, AssetMaintenanceResponse,
    MaintenanceReturn, WriteOffPayload,
    PatrimonyDashboard, AssetAlert, StatusCount,
)


router = APIRouter(prefix="/api/patrimony", tags=["Patrimônio"])

WRITE_ROLES = ("super_admin", "pastor", "secretaria", "financeiro")
DELETE_ROLES = ("super_admin", "pastor")

# Helpers de permissao granular (modulo patrimonio)
_perm_create = require_permission("patrimonio", "create")
_perm_edit = require_permission("patrimonio", "edit")
_perm_delete = require_permission("patrimonio", "delete")


# =================== Helpers ===================
async def _next_code(db: AsyncSession) -> str:
    """Gera o próximo código no formato PAT-0001."""
    last = (
        await db.execute(
            select(Asset.code).where(Asset.code.like("PAT-%")).order_by(Asset.id.desc()).limit(50)
        )
    ).scalars().all()
    max_n = 0
    for c in last:
        try:
            n = int(c.replace("PAT-", ""))
            if n > max_n:
                max_n = n
        except (ValueError, AttributeError):
            continue
    return f"PAT-{max_n + 1:04d}"


def _add_months(d: date, months: int) -> date:
    """Soma meses preservando o dia (ajustado para o último dia do mês quando necessário)."""
    if not d or not months:
        return d
    total = d.month - 1 + months
    year = d.year + total // 12
    month = total % 12 + 1
    # Ajusta dia para não estourar
    day = min(d.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
                       31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return date(year, month, day)


def _recalc_next_maintenance(asset: Asset) -> None:
    """Recalcula next_maintenance_due baseado em last_maintenance_date + interval ou aquisição."""
    if asset.maintenance_interval_months and asset.maintenance_interval_months > 0:
        base = asset.last_maintenance_date or asset.acquisition_date
        if base:
            asset.next_maintenance_due = _add_months(base, asset.maintenance_interval_months)
        else:
            asset.next_maintenance_due = None
    else:
        asset.next_maintenance_due = None


# =================== Categorias ===================
@router.get("/categories", response_model=list[AssetCategoryResponse])
async def list_categories(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(AssetCategory).order_by(AssetCategory.name)
    if active_only:
        q = q.where(AssetCategory.is_active == True)  # noqa: E712
    return (await db.execute(q)).scalars().all()


@router.post("/categories", response_model=AssetCategoryResponse)
async def create_category(
    data: AssetCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    exists = (await db.execute(
        select(AssetCategory).where(func.lower(AssetCategory.name) == data.name.strip().lower())
    )).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=409, detail="Categoria já existe")
    cat = AssetCategory(name=data.name.strip(), is_active=data.is_active)
    db.add(cat)
    await db.flush()
    await db.refresh(cat)
    return cat


@router.put("/categories/{cat_id}", response_model=AssetCategoryResponse)
async def update_category(
    cat_id: int,
    data: AssetCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    cat = (await db.execute(select(AssetCategory).where(AssetCategory.id == cat_id))).scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(cat, k, v.strip() if isinstance(v, str) else v)
    await db.flush()
    await db.refresh(cat)
    return cat


@router.delete("/categories/{cat_id}")
async def delete_category(
    cat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_delete),
):
    cat = (await db.execute(select(AssetCategory).where(AssetCategory.id == cat_id))).scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    in_use = (await db.execute(
        select(func.count(Asset.id)).where(Asset.category_id == cat_id)
    )).scalar()
    if in_use:
        raise HTTPException(status_code=409, detail=f"Categoria em uso por {in_use} bem(ns). Inative-a no lugar.")
    await db.delete(cat)
    return {"detail": "Categoria excluída"}


# =================== Locais ===================
@router.get("/locations", response_model=list[AssetLocationResponse])
async def list_locations(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(AssetLocation).order_by(AssetLocation.name)
    if active_only:
        q = q.where(AssetLocation.is_active == True)  # noqa: E712
    return (await db.execute(q)).scalars().all()


@router.post("/locations", response_model=AssetLocationResponse)
async def create_location(
    data: AssetLocationCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    exists = (await db.execute(
        select(AssetLocation).where(func.lower(AssetLocation.name) == data.name.strip().lower())
    )).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=409, detail="Local já existe")
    loc = AssetLocation(name=data.name.strip(), is_active=data.is_active)
    db.add(loc)
    await db.flush()
    await db.refresh(loc)
    return loc


@router.put("/locations/{loc_id}", response_model=AssetLocationResponse)
async def update_location(
    loc_id: int,
    data: AssetLocationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    loc = (await db.execute(select(AssetLocation).where(AssetLocation.id == loc_id))).scalar_one_or_none()
    if not loc:
        raise HTTPException(status_code=404, detail="Local não encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(loc, k, v.strip() if isinstance(v, str) else v)
    await db.flush()
    await db.refresh(loc)
    return loc


@router.delete("/locations/{loc_id}")
async def delete_location(
    loc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_delete),
):
    loc = (await db.execute(select(AssetLocation).where(AssetLocation.id == loc_id))).scalar_one_or_none()
    if not loc:
        raise HTTPException(status_code=404, detail="Local não encontrado")
    in_use = (await db.execute(
        select(func.count(Asset.id)).where(Asset.location_id == loc_id)
    )).scalar()
    if in_use:
        raise HTTPException(status_code=409, detail=f"Local em uso por {in_use} bem(ns). Inative-o no lugar.")
    await db.delete(loc)
    return {"detail": "Local excluído"}


# =================== Bens (Assets) ===================
@router.get("", response_model=list[AssetResponse])
async def list_assets(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    location_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(Asset).options(
        selectinload(Asset.category), selectinload(Asset.location)
    ).order_by(Asset.code)
    if search:
        like = f"%{search.strip()}%"
        q = q.where(or_(
            Asset.name.ilike(like),
            Asset.code.ilike(like),
            Asset.invoice_number.ilike(like),
        ))
    if status:
        q = q.where(Asset.status == status)
    if category_id:
        q = q.where(Asset.category_id == category_id)
    if location_id:
        q = q.where(Asset.location_id == location_id)
    return (await db.execute(q)).scalars().all()


@router.get("/{asset_id}", response_model=AssetDetailResponse)
async def get_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    asset = (await db.execute(
        select(Asset).options(
            selectinload(Asset.category),
            selectinload(Asset.location),
            selectinload(Asset.maintenances),
        ).where(Asset.id == asset_id)
    )).scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Bem não encontrado")
    return asset


@router.post("", response_model=AssetResponse)
async def create_asset(
    data: AssetCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    payload = data.model_dump(exclude={"create_financial_transaction",
                                        "financial_project_id",
                                        "financial_category_id"})
    code = (payload.get("code") or "").strip()
    if not code:
        code = await _next_code(db)
    else:
        # Verificar duplicidade
        dup = (await db.execute(select(Asset).where(Asset.code == code))).scalar_one_or_none()
        if dup:
            raise HTTPException(status_code=409, detail=f"Código {code} já existe")
    payload["code"] = code

    asset = Asset(**payload)
    _recalc_next_maintenance(asset)
    db.add(asset)
    await db.flush()

    # Integração financeira opcional
    if data.create_financial_transaction and asset.value and asset.value > 0:
        tx = Transaction(
            date=asset.acquisition_date or date.today(),
            type="Saída",
            value=float(asset.value),
            description=f"Aquisição patrimônio {asset.code} - {asset.name}",
            project_id=data.financial_project_id,
            category_id=data.financial_category_id,
            created_by=current_user.id,
            status="Concluído",
        )
        db.add(tx)

    await db.flush()
    asset = (await db.execute(
        select(Asset).options(
            selectinload(Asset.category), selectinload(Asset.location)
        ).where(Asset.id == asset.id)
    )).scalar_one()
    return asset


@router.put("/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: int,
    data: AssetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    asset = (await db.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Bem não encontrado")
    payload = data.model_dump(exclude_unset=True)
    if "code" in payload:
        new_code = (payload["code"] or "").strip()
        if new_code and new_code != asset.code:
            dup = (await db.execute(
                select(Asset).where(Asset.code == new_code, Asset.id != asset_id)
            )).scalar_one_or_none()
            if dup:
                raise HTTPException(status_code=409, detail=f"Código {new_code} já existe")
            payload["code"] = new_code
        else:
            payload.pop("code", None)
    for k, v in payload.items():
        setattr(asset, k, v)
    _recalc_next_maintenance(asset)
    await db.flush()
    asset = (await db.execute(
        select(Asset).options(
            selectinload(Asset.category), selectinload(Asset.location)
        ).where(Asset.id == asset.id)
    )).scalar_one()
    return asset


@router.delete("/{asset_id}")
async def delete_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_delete),
):
    asset = (await db.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Bem não encontrado")
    await db.delete(asset)
    return {"detail": "Bem excluído"}


# =================== Ações: Manutenção e Baixa ===================
@router.post("/{asset_id}/maintenances", response_model=AssetMaintenanceResponse)
async def send_to_maintenance(
    asset_id: int,
    data: AssetMaintenanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    """Envia o bem para manutenção. Cria registro e altera status para in_maintenance."""
    asset = (await db.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Bem não encontrado")
    if asset.status == "decommissioned":
        raise HTTPException(status_code=400, detail="Bem baixado não pode ir para manutenção")
    if asset.status == "in_maintenance":
        raise HTTPException(status_code=400, detail="Bem já está em manutenção")

    m = AssetMaintenance(asset_id=asset_id, **data.model_dump(exclude_unset=True))
    asset.status = "in_maintenance"
    db.add(m)
    await db.flush()
    await db.refresh(m)
    return m


@router.put("/{asset_id}/maintenances/{maint_id}", response_model=AssetMaintenanceResponse)
async def update_maintenance(
    asset_id: int,
    maint_id: int,
    data: AssetMaintenanceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    m = (await db.execute(
        select(AssetMaintenance).where(
            AssetMaintenance.id == maint_id, AssetMaintenance.asset_id == asset_id
        )
    )).scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Manutenção não encontrada")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(m, k, v)
    await db.flush()
    await db.refresh(m)
    return m


@router.post("/{asset_id}/maintenances/{maint_id}/return", response_model=AssetMaintenanceResponse)
async def return_from_maintenance(
    asset_id: int,
    maint_id: int,
    data: MaintenanceReturn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    """Registra retorno da manutenção. Atualiza last_maintenance_date e recalcula próximo vencimento."""
    asset = (await db.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Bem não encontrado")
    m = (await db.execute(
        select(AssetMaintenance).where(
            AssetMaintenance.id == maint_id, AssetMaintenance.asset_id == asset_id
        )
    )).scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Manutenção não encontrada")
    if m.returned_date is not None:
        raise HTTPException(status_code=400, detail="Manutenção já foi finalizada")

    m.returned_date = data.returned_date
    if data.service_warranty_until is not None:
        m.service_warranty_until = data.service_warranty_until
    if data.cost is not None:
        m.cost = data.cost
    if data.notes is not None:
        m.notes = data.notes

    asset.status = data.new_status
    asset.last_maintenance_date = data.returned_date
    _recalc_next_maintenance(asset)

    await db.flush()
    await db.refresh(m)
    return m


@router.delete("/{asset_id}/maintenances/{maint_id}")
async def delete_maintenance(
    asset_id: int,
    maint_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_delete),
):
    m = (await db.execute(
        select(AssetMaintenance).where(
            AssetMaintenance.id == maint_id, AssetMaintenance.asset_id == asset_id
        )
    )).scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Manutenção não encontrada")
    await db.delete(m)
    return {"detail": "Manutenção excluída"}


@router.post("/{asset_id}/write-off", response_model=AssetResponse)
async def write_off_asset(
    asset_id: int,
    data: WriteOffPayload,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_delete),
):
    """Dá baixa no bem (status decommissioned)."""
    asset = (await db.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Bem não encontrado")
    if data.reason == "other" and not (data.other_text and data.other_text.strip()):
        raise HTTPException(status_code=400, detail="Justificativa obrigatória quando motivo é 'outro'")
    asset.status = "decommissioned"
    asset.decommission_reason = data.reason
    asset.decommission_other = (data.other_text or None) if data.reason == "other" else None
    asset.decommission_date = data.decommission_date or date.today()
    await db.flush()
    asset = (await db.execute(
        select(Asset).options(
            selectinload(Asset.category), selectinload(Asset.location)
        ).where(Asset.id == asset.id)
    )).scalar_one()
    return asset


@router.post("/{asset_id}/reactivate", response_model=AssetResponse)
async def reactivate_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_delete),
):
    """Reverte uma baixa (volta para active_in_use)."""
    asset = (await db.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Bem não encontrado")
    asset.status = "active_in_use"
    asset.decommission_reason = None
    asset.decommission_other = None
    asset.decommission_date = None
    await db.flush()
    asset = (await db.execute(
        select(Asset).options(
            selectinload(Asset.category), selectinload(Asset.location)
        ).where(Asset.id == asset.id)
    )).scalar_one()
    return asset


# =================== Dashboard ===================
@router.get("/dashboard/summary", response_model=PatrimonyDashboard)
async def dashboard(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    today = date.today()
    horizon = today + timedelta(days=days)

    total_assets = (await db.execute(select(func.count(Asset.id)))).scalar() or 0
    total_value = (await db.execute(
        select(func.coalesce(func.sum(Asset.value), 0)).where(Asset.status != "decommissioned")
    )).scalar() or 0

    rows = (await db.execute(
        select(Asset.status, func.count(Asset.id)).group_by(Asset.status)
    )).all()
    counts_by_status = [StatusCount(status=r[0], count=r[1]) for r in rows]

    in_maint = (await db.execute(
        select(func.count(Asset.id)).where(Asset.status == "in_maintenance")
    )).scalar() or 0

    # Próximas manutenções
    upcoming_m_rows = (await db.execute(
        select(Asset).where(
            Asset.next_maintenance_due.isnot(None),
            Asset.next_maintenance_due <= horizon,
            Asset.status != "decommissioned",
        ).order_by(Asset.next_maintenance_due)
    )).scalars().all()
    upcoming_maintenance = [
        AssetAlert(
            asset_id=a.id, code=a.code, name=a.name,
            days_until=(a.next_maintenance_due - today).days,
            due_date=a.next_maintenance_due, kind="maintenance",
        ) for a in upcoming_m_rows
    ]

    # Próximas garantias do produto
    upcoming_w_rows = (await db.execute(
        select(Asset).where(
            Asset.warranty_until.isnot(None),
            Asset.warranty_until <= horizon,
            Asset.warranty_until >= today,
            Asset.status != "decommissioned",
        ).order_by(Asset.warranty_until)
    )).scalars().all()
    upcoming_warranty = [
        AssetAlert(
            asset_id=a.id, code=a.code, name=a.name,
            days_until=(a.warranty_until - today).days,
            due_date=a.warranty_until, kind="warranty",
        ) for a in upcoming_w_rows
    ]

    # Manutenções com previsão de retorno vencida (ainda não retornaram)
    overdue_m = (await db.execute(
        select(AssetMaintenance, Asset).join(Asset, AssetMaintenance.asset_id == Asset.id).where(
            AssetMaintenance.returned_date.is_(None),
            AssetMaintenance.expected_return.isnot(None),
            AssetMaintenance.expected_return < today,
        ).order_by(AssetMaintenance.expected_return)
    )).all()
    overdue_returns = [
        AssetAlert(
            asset_id=a.id, code=a.code, name=a.name,
            days_until=(m.expected_return - today).days,
            due_date=m.expected_return, kind="expected_return",
        ) for (m, a) in overdue_m
    ]

    return PatrimonyDashboard(
        total_assets=total_assets,
        total_value=float(total_value),
        counts_by_status=counts_by_status,
        in_maintenance=in_maint,
        upcoming_maintenance=upcoming_maintenance,
        upcoming_warranty=upcoming_warranty,
        overdue_returns=overdue_returns,
    )
