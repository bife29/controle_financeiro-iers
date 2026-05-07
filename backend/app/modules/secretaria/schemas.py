from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import date, datetime


def _empty_to_none(v):
    if isinstance(v, str) and v.strip() == "":
        return None
    return v


# ---------------- Events ----------------
class EventCreate(BaseModel):
    title: str
    date: date
    type: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None

    @field_validator("type", "description", "location", mode="before")
    @classmethod
    def _empty(cls, v):
        return _empty_to_none(v)


class EventUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[date] = None
    type: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("type", "description", "location", mode="before")
    @classmethod
    def _empty(cls, v):
        return _empty_to_none(v)


class EventResponse(BaseModel):
    id: int
    title: str
    date: date
    type: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------------- WhatsApp Groups ----------------
class WhatsappGroupCreate(BaseModel):
    name: str
    kind: Optional[str] = None
    invite_link: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("kind", "invite_link", "notes", mode="before")
    @classmethod
    def _empty(cls, v):
        return _empty_to_none(v)


class WhatsappGroupUpdate(BaseModel):
    name: Optional[str] = None
    kind: Optional[str] = None
    invite_link: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class WhatsappGroupResponse(BaseModel):
    id: int
    name: str
    kind: Optional[str] = None
    invite_link: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------------- Message Templates ----------------
class MessageTemplateCreate(BaseModel):
    kind: str  # birthday | event_reminder | generic
    title: str
    body: str
    is_default: bool = False


class MessageTemplateUpdate(BaseModel):
    kind: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class MessageTemplateResponse(BaseModel):
    id: int
    kind: str
    title: str
    body: str
    is_default: bool
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------------- Settings ----------------
class ChurchSettingsUpdate(BaseModel):
    secretary_phone: Optional[str] = None
    church_name: Optional[str] = None
    birthday_alert_days: Optional[int] = None
    event_alert_days: Optional[int] = None


class ChurchSettingsResponse(BaseModel):
    id: int
    secretary_phone: Optional[str] = None
    church_name: Optional[str] = None
    birthday_alert_days: int
    event_alert_days: int

    class Config:
        from_attributes = True


# ---------------- Dashboard ----------------
class DashboardBirthday(BaseModel):
    id: int
    name: str
    cel: Optional[str] = None
    data_nascimento: date
    day: int
    month: int
    age_turning: int
    age_group: str
    days_until: int  # 0 = hoje, negativo = já passou neste ano


class DashboardEvent(BaseModel):
    id: int
    title: str
    date: date
    type: Optional[str] = None
    location: Optional[str] = None
    days_until: int


class SecretariaDashboard(BaseModel):
    today: date
    upcoming_birthdays: List[DashboardBirthday]
    upcoming_events: List[DashboardEvent]
    counts: dict  # { total_members, birthdays_this_month, events_this_month }
