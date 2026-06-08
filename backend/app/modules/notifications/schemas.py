from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    type: str
    title: str
    message: Optional[str] = None
    link: Optional[str] = None
    is_read: bool
    created_at: Optional[datetime] = None


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    unread_count: int
