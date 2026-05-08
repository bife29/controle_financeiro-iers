"""Rotas do módulo Secretaria."""
from datetime import date, timedelta
from calendar import isleap
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from ...core.database import get_db
from ...core.security import get_current_user, require_roles, require_permission
from ..members.models import Member
from ..members.utils import effective_age_group
from .models import Event, WhatsappGroup, MessageTemplate, ChurchSettings
from .schemas import (
    EventCreate, EventUpdate, EventResponse,
    WhatsappGroupCreate, WhatsappGroupUpdate, WhatsappGroupResponse,
    MessageTemplateCreate, MessageTemplateUpdate, MessageTemplateResponse,
    ChurchSettingsUpdate, ChurchSettingsResponse,
    SecretariaDashboard, DashboardBirthday, DashboardEvent,
)


router = APIRouter(prefix="/api/secretaria", tags=["Secretaria"])


SECRETARY_ROLES = ("super_admin", "pastor", "secretaria")

# Helpers de permissao granular (modulo secretaria)
_perm_create = require_permission("secretaria", "create")
_perm_edit = require_permission("secretaria", "edit")
_perm_delete = require_permission("secretaria", "delete")


# =================== EVENTOS ===================
@router.get("/events", response_model=list[EventResponse])
async def list_events(
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(Event)
    if active_only:
        q = q.where(Event.is_active == True)  # noqa: E712
    if start:
        q = q.where(Event.date >= start)
    if end:
        q = q.where(Event.date <= end)
    q = q.order_by(Event.date)
    return (await db.execute(q)).scalars().all()


@router.get("/events/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    return event


@router.post("/events", response_model=EventResponse)
async def create_event(
    data: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    event = Event(**data.model_dump(exclude_unset=True))
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


@router.put("/events/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    data: EventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(event, k, v)
    await db.flush()
    await db.refresh(event)
    return event


@router.delete("/events/{event_id}")
async def delete_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    await db.delete(event)
    return {"detail": "Evento excluído"}


# =================== WHATSAPP GROUPS ===================
@router.get("/whatsapp-groups", response_model=list[WhatsappGroupResponse])
async def list_whatsapp_groups(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(WhatsappGroup)
    if active_only:
        q = q.where(WhatsappGroup.is_active == True)  # noqa: E712
    q = q.order_by(WhatsappGroup.name)
    return (await db.execute(q)).scalars().all()


@router.post("/whatsapp-groups", response_model=WhatsappGroupResponse)
async def create_whatsapp_group(
    data: WhatsappGroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    group = WhatsappGroup(**data.model_dump(exclude_unset=True))
    db.add(group)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Já existe um grupo com este nome.")
    await db.refresh(group)
    return group


@router.put("/whatsapp-groups/{group_id}", response_model=WhatsappGroupResponse)
async def update_whatsapp_group(
    group_id: int,
    data: WhatsappGroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    group = (await db.execute(select(WhatsappGroup).where(WhatsappGroup.id == group_id))).scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(group, k, v)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Já existe um grupo com este nome.")
    await db.refresh(group)
    return group


@router.delete("/whatsapp-groups/{group_id}")
async def delete_whatsapp_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    group = (await db.execute(select(WhatsappGroup).where(WhatsappGroup.id == group_id))).scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")
    await db.delete(group)
    return {"detail": "Grupo excluído"}


# =================== MESSAGE TEMPLATES ===================
@router.get("/message-templates", response_model=list[MessageTemplateResponse])
async def list_templates(
    kind: Optional[str] = Query(None, description="birthday | event_reminder | generic"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(MessageTemplate).where(MessageTemplate.is_active == True)  # noqa: E712
    if kind:
        q = q.where(MessageTemplate.kind == kind)
    q = q.order_by(MessageTemplate.kind, MessageTemplate.title)
    return (await db.execute(q)).scalars().all()


@router.post("/message-templates", response_model=MessageTemplateResponse)
async def create_template(
    data: MessageTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    if data.is_default:
        # garantir um único default por kind
        await _clear_defaults(db, data.kind)
    tpl = MessageTemplate(**data.model_dump(exclude_unset=True))
    db.add(tpl)
    await db.flush()
    await db.refresh(tpl)
    return tpl


@router.put("/message-templates/{tpl_id}", response_model=MessageTemplateResponse)
async def update_template(
    tpl_id: int,
    data: MessageTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    tpl = (await db.execute(select(MessageTemplate).where(MessageTemplate.id == tpl_id))).scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    payload = data.model_dump(exclude_unset=True)
    if payload.get("is_default"):
        await _clear_defaults(db, payload.get("kind") or tpl.kind, exclude_id=tpl.id)
    for k, v in payload.items():
        setattr(tpl, k, v)
    await db.flush()
    await db.refresh(tpl)
    return tpl


@router.delete("/message-templates/{tpl_id}")
async def delete_template(
    tpl_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    tpl = (await db.execute(select(MessageTemplate).where(MessageTemplate.id == tpl_id))).scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    await db.delete(tpl)
    return {"detail": "Template excluído"}


async def _clear_defaults(db: AsyncSession, kind: str, exclude_id: Optional[int] = None):
    q = select(MessageTemplate).where(
        MessageTemplate.kind == kind,
        MessageTemplate.is_default == True,  # noqa: E712
    )
    if exclude_id is not None:
        q = q.where(MessageTemplate.id != exclude_id)
    rows = (await db.execute(q)).scalars().all()
    for r in rows:
        r.is_default = False


# =================== SETTINGS ===================
@router.get("/settings", response_model=ChurchSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    settings = await _get_or_create_settings(db)
    return settings


@router.put("/settings", response_model=ChurchSettingsResponse)
async def update_settings(
    data: ChurchSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_perm_edit),
):
    settings = await _get_or_create_settings(db)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(settings, k, v)
    await db.flush()
    await db.refresh(settings)
    return settings


async def _get_or_create_settings(db: AsyncSession) -> ChurchSettings:
    res = await db.execute(select(ChurchSettings).where(ChurchSettings.id == 1))
    settings = res.scalar_one_or_none()
    if settings is None:
        settings = ChurchSettings(
            id=1,
            birthday_alert_days=2,
            event_alert_days=2,
        )
        db.add(settings)
        await db.flush()
        await db.refresh(settings)
    return settings


# =================== DASHBOARD ===================
@router.get("/dashboard", response_model=SecretariaDashboard)
async def secretaria_dashboard(
    days: Optional[int] = Query(None, ge=1, le=60, description="Janela de antecedência (sobrescreve config padrão)"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    today = date.today()
    settings = await _get_or_create_settings(db)
    window = days or max(settings.birthday_alert_days, settings.event_alert_days, 2)

    # Aniversariantes nos próximos `window` dias
    members = (await db.execute(
        select(Member).where(
            Member.is_active == True,  # noqa: E712
            Member.data_nascimento.isnot(None),
        )
    )).scalars().all()

    birthdays: list[DashboardBirthday] = []
    for m in members:
        bday = m.data_nascimento
        assert bday is not None
        day = bday.day
        if bday.month == 2 and day == 29 and not isleap(today.year):
            day = 28
        next_bday = date(today.year, bday.month, day)
        if next_bday < today:
            next_bday = date(today.year + 1, bday.month, day)
        delta = (next_bday - today).days
        if delta <= window:
            birthdays.append(DashboardBirthday(
                id=m.id,
                name=m.name,
                cel=m.cel,
                data_nascimento=bday,
                day=bday.day,
                month=bday.month,
                age_turning=next_bday.year - bday.year,
                age_group=effective_age_group(m),
                days_until=delta,
            ))
    birthdays.sort(key=lambda b: (b.days_until, b.name))

    # Eventos nos próximos `window` dias
    horizon = today + timedelta(days=window)
    events_q = select(Event).where(
        Event.is_active == True,  # noqa: E712
        Event.date >= today,
        Event.date <= horizon,
    ).order_by(Event.date)
    events_rows = (await db.execute(events_q)).scalars().all()
    events = [
        DashboardEvent(
            id=e.id, title=e.title, date=e.date, type=e.type,
            location=e.location, days_until=(e.date - today).days,
        )
        for e in events_rows
    ]

    # Contagens auxiliares
    total_members = (await db.execute(
        select(func.count(Member.id)).where(Member.is_active == True)  # noqa: E712
    )).scalar() or 0
    bdays_this_month = sum(
        1 for m in members
        if m.data_nascimento and m.data_nascimento.month == today.month
    )
    events_this_month_q = select(func.count(Event.id)).where(
        Event.is_active == True,  # noqa: E712
        Event.date >= today.replace(day=1),
    )
    # próximo mês: 1º dia do mês seguinte
    if today.month == 12:
        next_month_start = date(today.year + 1, 1, 1)
    else:
        next_month_start = date(today.year, today.month + 1, 1)
    events_this_month_q = events_this_month_q.where(Event.date < next_month_start)
    events_this_month = (await db.execute(events_this_month_q)).scalar() or 0

    return SecretariaDashboard(
        today=today,
        upcoming_birthdays=birthdays,
        upcoming_events=events,
        counts={
            "total_members": total_members,
            "birthdays_this_month": bdays_this_month,
            "events_this_month": events_this_month,
        },
    )
