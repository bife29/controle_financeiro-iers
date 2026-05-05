from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional
from ...core.database import get_db
from ...core.security import get_current_user, require_roles
from .models import Member
from .schemas import MemberCreate, MemberUpdate, MemberResponse, MemberSummary

router = APIRouter(prefix="/api/members", tags=["Membros"])


@router.get("/", response_model=list[MemberResponse])
async def list_members(
    search: Optional[str] = Query(None),
    active_only: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = select(Member)
    if active_only:
        query = query.where(Member.is_active == True)
    if search:
        query = query.where(
            or_(
                Member.name.ilike(f"%{search}%"),
                Member.cpf.ilike(f"%{search}%"),
                Member.cel.ilike(f"%{search}%"),
            )
        )
    query = query.order_by(Member.name).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/summary", response_model=list[MemberSummary])
async def list_members_summary(
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Listagem resumida para uso em selects (Financeiro, Retiro)."""
    query = select(Member).where(Member.is_active == True)
    if search:
        query = query.where(Member.name.ilike(f"%{search}%"))
    query = query.order_by(Member.name).limit(200)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/count")
async def count_members(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = await db.execute(select(func.count(Member.id)).where(Member.is_active == True))
    return {"count": result.scalar()}


@router.get("/by-ficha/{ficha_num}", response_model=MemberResponse)
async def get_member_by_ficha(
    ficha_num: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = await db.execute(select(Member).where(Member.ficha_num == ficha_num))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Membro não encontrado")
    return member


@router.get("/{member_id}", response_model=MemberResponse)
async def get_member(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Membro não encontrado")
    return member


@router.post("/", response_model=MemberResponse)
async def create_member(
    data: MemberCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "pastor", "secretaria"))
):
    # Gerar número de ficha automaticamente se não informado
    if data.ficha_num is None:
        max_ficha = await db.execute(select(func.max(Member.ficha_num)))
        current_max = max_ficha.scalar() or 0
        data_dict = data.model_dump(exclude_unset=True)
        data_dict["ficha_num"] = current_max + 1
    else:
        data_dict = data.model_dump(exclude_unset=True)

    member = Member(**data_dict)
    db.add(member)
    await db.flush()
    await db.refresh(member)
    return member


@router.put("/{member_id}", response_model=MemberResponse)
async def update_member(
    member_id: int,
    data: MemberUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "pastor", "secretaria"))
):
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Membro não encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(member, field, value)

    await db.flush()
    await db.refresh(member)
    return member


@router.delete("/{member_id}")
async def delete_member(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin"))
):
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Membro não encontrado")
    member.is_active = False  # Soft delete
    await db.flush()
    return {"detail": "Membro desativado"}
