from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from ...core.database import get_db
from ...core.security import get_current_user, require_roles
from .models import Feedback
from .schemas import FeedbackCreate, FeedbackUpdate, FeedbackResponse

router = APIRouter(prefix="/api/feedback", tags=["Feedback"])


@router.get("/", response_model=list[FeedbackResponse])
async def list_feedbacks(
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = select(Feedback)
    # Não-admins veem apenas seus próprios feedbacks
    if current_user.role not in ("super_admin", "pastor"):
        query = query.where(Feedback.user_id == current_user.id)
    if type:
        query = query.where(Feedback.type == type)
    if status:
        query = query.where(Feedback.status == status)
    if module:
        query = query.where(Feedback.module == module)
    query = query.order_by(Feedback.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=FeedbackResponse)
async def create_feedback(
    data: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    feedback = Feedback(**data.model_dump(), user_id=current_user.id)
    db.add(feedback)
    await db.flush()
    await db.refresh(feedback)
    return feedback


@router.put("/{feedback_id}", response_model=FeedbackResponse)
async def update_feedback(
    feedback_id: int,
    data: FeedbackUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin"))
):
    """Apenas super_admin pode responder/atualizar status dos feedbacks."""
    result = await db.execute(select(Feedback).where(Feedback.id == feedback_id))
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback não encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(feedback, field, value)

    if data.status == "resolvido":
        feedback.resolved_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(feedback)
    return feedback


@router.delete("/{feedback_id}")
async def delete_feedback(
    feedback_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin"))
):
    result = await db.execute(select(Feedback).where(Feedback.id == feedback_id))
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback não encontrado")
    await db.delete(feedback)
    return {"detail": "Feedback excluído"}
