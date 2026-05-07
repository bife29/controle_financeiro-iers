from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, extract
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
from datetime import date
from pydantic import BaseModel
from ...core.database import get_db
from ...core.security import get_current_user, require_roles
from .models import Member
from .schemas import (
    MemberCreate, MemberUpdate, MemberResponse, MemberSummary,
    BirthdayItem, AgeGroupCount,
)
from .utils import (
    AGE_GROUPS, AGE_GROUP_KEYS,
    calc_age, compute_age_group, effective_age_group,
)

router = APIRouter(prefix="/api/members", tags=["Membros"])


def _integrity_message(exc: IntegrityError) -> str:
    """Translate DB integrity error into a friendly message."""
    raw = str(exc.orig if exc.orig else exc).lower()
    if "cpf" in raw:
        return "Já existe um membro cadastrado com este CPF."
    if "ficha_num" in raw or "ficha" in raw:
        return "Já existe um membro com este número de ficha."
    if "email" in raw:
        return "Já existe um membro com este e-mail."
    return "Violação de unicidade: registro duplicado."


class PhotoUpload(BaseModel):
    foto_perfil: str  # base64 data URI


class BulkDeleteRequest(BaseModel):
    ids: List[int]


def _enrich(member: Member) -> Member:
    """Anexa atributos derivados (age, age_group) ao objeto antes de serializar.
    Pydantic com from_attributes lê esses atributos diretamente."""
    setattr(member, "age", calc_age(member.data_nascimento))
    setattr(member, "age_group", effective_age_group(member))
    return member


def _validate_age_group_key(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    if value not in AGE_GROUP_KEYS:
        raise HTTPException(
            status_code=400,
            detail=f"age_group inválido. Válidos: {', '.join(AGE_GROUP_KEYS)}",
        )
    return value


@router.get("/", response_model=list[MemberResponse])
async def list_members(
    search: Optional[str] = Query(None),
    active_only: bool = Query(True),
    age_group: Optional[str] = Query(None, description="Filtra por faixa: criancas, pre_adolescentes, adolescentes, jovens, adultos, indefinido"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    age_group = _validate_age_group_key(age_group)
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
    query = query.order_by(Member.name)
    result = await db.execute(query)
    members = list(result.scalars().all())
    if age_group:
        members = [m for m in members if effective_age_group(m) == age_group]
    # paginate após filtrar por age_group (filtro é calculado em runtime)
    members = members[skip : skip + limit]
    return [_enrich(m) for m in members]


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


@router.get("/birthdays", response_model=list[BirthdayItem])
async def list_birthdays(
    month: Optional[int] = Query(None, ge=1, le=12, description="Mês (1-12). Padrão: mês corrente"),
    year: Optional[int] = Query(None, description="Ano de referência para idade. Padrão: ano corrente"),
    upcoming_days: Optional[int] = Query(
        None, ge=1, le=366,
        description="Se informado, ignora 'month' e retorna aniversariantes nos próximos N dias",
    ),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Aniversariantes do mês (ou janela de N dias). Ordenados por dia.

    Considera apenas membros ativos com data_nascimento preenchida.
    """
    today = date.today()
    ref_year = year or today.year

    # Carrega só membros ativos com data_nascimento (filtramos em Python pra
    # ter compatibilidade SQLite/Postgres sem usar EXTRACT condicional).
    q = select(Member).where(
        Member.is_active == True,  # noqa: E712
        Member.data_nascimento.isnot(None),
    )
    rows = (await db.execute(q)).scalars().all()

    items: list[BirthdayItem] = []
    if upcoming_days:
        # próximos N dias (incluindo hoje)
        for m in rows:
            assert m.data_nascimento is not None
            this_year_bday = date(today.year, m.data_nascimento.month, _safe_day(m.data_nascimento))
            if this_year_bday < today:
                this_year_bday = date(today.year + 1, m.data_nascimento.month, _safe_day(m.data_nascimento))
            delta = (this_year_bday - today).days
            if 0 <= delta <= upcoming_days:
                items.append(_birthday_item(m, this_year_bday.year))
        items.sort(key=lambda b: (b.month, b.day, b.name))
    else:
        target_month = month or today.month
        for m in rows:
            assert m.data_nascimento is not None
            if m.data_nascimento.month == target_month:
                items.append(_birthday_item(m, ref_year))
        items.sort(key=lambda b: (b.day, b.name))

    return items


@router.get("/age-groups", response_model=list[AgeGroupCount])
async def get_age_groups_summary(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Quantidade de membros ativos por faixa etária."""
    rows = (await db.execute(
        select(Member).where(Member.is_active == True)  # noqa: E712
    )).scalars().all()
    counts: dict[str, int] = {g["key"]: 0 for g in AGE_GROUPS}
    for m in rows:
        counts[effective_age_group(m)] = counts.get(effective_age_group(m), 0) + 1
    return [
        AgeGroupCount(key=g["key"], label=g["label"], count=counts.get(g["key"], 0))
        for g in AGE_GROUPS
    ]


def _safe_day(birth: date) -> int:
    """Trata 29/fev em ano não-bissexto: usa 28."""
    from calendar import isleap
    if birth.month == 2 and birth.day == 29 and not isleap(date.today().year):
        return 28
    return birth.day


def _birthday_item(m: Member, ref_year: int) -> BirthdayItem:
    bday = m.data_nascimento
    assert bday is not None
    age_turning = ref_year - bday.year
    name = m.name or ""
    return BirthdayItem(
        id=m.id,
        name=name,
        cel=m.cel,
        data_nascimento=bday,
        day=bday.day,
        month=bday.month,
        age_turning=max(0, age_turning),
        age_group=effective_age_group(m),
    )


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
    return _enrich(member)


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
    return _enrich(member)


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

    _validate_age_group_key(data_dict.get("age_group_override"))

    member = Member(**data_dict)
    db.add(member)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail=_integrity_message(exc))
    await db.refresh(member)
    return _enrich(member)


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

    payload = data.model_dump(exclude_unset=True)
    _validate_age_group_key(payload.get("age_group_override"))
    for field, value in payload.items():
        setattr(member, field, value)

    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail=_integrity_message(exc))
    await db.refresh(member)
    return _enrich(member)


@router.delete("/{member_id}")
async def delete_member(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "pastor"))
):
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Membro não encontrado")
    member.is_active = False  # Soft delete
    await db.flush()
    return {"detail": "Membro desativado"}


@router.post("/bulk-delete")
async def bulk_delete_members(
    data: BulkDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "pastor"))
):
    if not data.ids or len(data.ids) > 100:
        raise HTTPException(status_code=400, detail="Envie entre 1 e 100 IDs")
    result = await db.execute(select(Member).where(Member.id.in_(data.ids)))
    members = result.scalars().all()
    count = 0
    for member in members:
        if member.is_active:
            member.is_active = False
            count += 1
    await db.flush()
    return {"detail": f"{count} membro(s) desativado(s)"}


@router.put("/{member_id}/photo")
async def upload_member_photo(
    member_id: int,
    data: PhotoUpload,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "pastor", "secretaria"))
):
    # Validar que é um data URI de imagem válido
    if not data.foto_perfil.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Formato inválido. Envie data:image/...")
    # Limitar tamanho (~50KB base64 = imagem razoável)
    if len(data.foto_perfil) > 100_000:
        raise HTTPException(status_code=400, detail="Imagem muito grande. Máximo ~50KB após compressão")
    
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Membro não encontrado")
    
    member.foto_perfil = data.foto_perfil
    await db.flush()
    await db.refresh(member)
    return {"detail": "Foto atualizada", "foto_perfil": member.foto_perfil}


@router.delete("/{member_id}/photo")
async def delete_member_photo(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "pastor", "secretaria"))
):
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Membro não encontrado")
    member.foto_perfil = None
    await db.flush()
    return {"detail": "Foto removida"}
