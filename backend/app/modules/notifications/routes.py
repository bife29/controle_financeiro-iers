from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user
from .models import Notification
from .schemas import NotificationResponse, NotificationListResponse

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


async def create_notification(
    db: AsyncSession,
    *,
    user_id: int,
    type: str,
    title: str,
    link: Optional[str] = None,
    message: Optional[str] = None,
) -> Notification:
    """Cria uma notificação para um usuário. Não faz commit (caller controla a transação)."""
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        link=link,
    )
    db.add(notif)
    await db.flush()
    return notif


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    only_unread: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(Notification).where(Notification.user_id == current_user.id)
    if only_unread:
        q = q.where(Notification.is_read == False)  # noqa: E712
    q = q.order_by(Notification.created_at.desc()).limit(limit)
    rows = (await db.execute(q)).scalars().all()

    unread_count = (await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
    )).scalar_one()

    return {"items": [NotificationResponse.model_validate(r) for r in rows], "unread_count": unread_count}


@router.patch("/{notif_id}/read", response_model=NotificationResponse)
async def mark_read(
    notif_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    notif = (await db.execute(
        select(Notification).where(
            Notification.id == notif_id,
            Notification.user_id == current_user.id,
        )
    )).scalar_one_or_none()
    if not notif:
        raise HTTPException(404, "Notificação não encontrada")
    notif.is_read = True
    await db.flush()
    return notif


@router.post("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    return {"detail": "ok"}
