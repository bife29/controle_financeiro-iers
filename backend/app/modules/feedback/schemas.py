from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class FeedbackCreate(BaseModel):
    type: str  # sugestao / erro / melhoria
    title: str
    description: str
    priority: str = "media"
    module: Optional[str] = "geral"


class FeedbackUpdate(BaseModel):
    status: Optional[str] = None
    admin_response: Optional[str] = None
    priority: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: int
    type: str
    title: str
    description: str
    priority: str
    status: str
    module: Optional[str] = None
    user_id: int
    admin_response: Optional[str] = None
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True
