from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


# Permissões padrão por papel
DEFAULT_PERMISSIONS: dict[str, dict[str, list[str]]] = {
    "super_admin": {
        "dashboard": ["view"],
        "financeiro": ["view", "create", "edit", "delete"],
        "membros": ["view", "create", "edit", "delete"],
        "retiros": ["view", "create", "edit", "delete"],
        "secretaria": ["view", "create", "edit", "delete"],
        "patrimonio": ["view", "create", "edit", "delete"],
        "feedback": ["view", "create", "edit", "delete"],
        "usuarios": ["view", "create", "edit", "delete"],
    },
    "pastor": {
        "dashboard": ["view"],
        "financeiro": ["view", "create"],
        "membros": ["view"],
        "retiros": ["view"],
        "secretaria": ["view", "create", "edit", "delete"],
        "patrimonio": ["view", "create", "edit", "delete"],
        "feedback": ["view", "create"],
        "usuarios": [],
    },
    "financeiro": {
        "dashboard": ["view"],
        "financeiro": ["view", "create", "edit", "delete"],
        "membros": ["view", "create"],
        "retiros": ["view"],
        "secretaria": ["view"],
        "patrimonio": ["view", "create", "edit"],
        "feedback": ["view", "create"],
        "usuarios": [],
    },
    "secretaria": {
        "dashboard": ["view"],
        "financeiro": [],
        "membros": ["view", "create", "edit", "delete"],
        "retiros": ["view", "create", "edit"],
        "secretaria": ["view", "create", "edit", "delete"],
        "patrimonio": ["view", "create", "edit"],
        "feedback": ["view", "create"],
        "usuarios": [],
    },
    "viewer": {
        "dashboard": ["view"],
        "financeiro": ["view"],
        "membros": ["view"],
        "retiros": ["view"],
        "secretaria": ["view"],
        "patrimonio": ["view"],
        "feedback": ["view"],
        "usuarios": [],
    },
}

AVAILABLE_MODULES = [
    {"key": "dashboard", "label": "Dashboard", "actions": ["view"]},
    {"key": "financeiro", "label": "Financeiro", "actions": ["view", "create", "edit", "delete"]},
    {"key": "membros", "label": "Membros", "actions": ["view", "create", "edit", "delete"]},
    {"key": "retiros", "label": "Retiros", "actions": ["view", "create", "edit", "delete"]},
    {"key": "secretaria", "label": "Secretaria (Calendário/Eventos/WhatsApp)", "actions": ["view", "create", "edit", "delete"]},
    {"key": "patrimonio", "label": "Patrimônio (Bens da Igreja)", "actions": ["view", "create", "edit", "delete"]},
    {"key": "feedback", "label": "Feedback", "actions": ["view", "create", "edit", "delete"]},
    {"key": "usuarios", "label": "Usuários", "actions": ["view", "create", "edit", "delete"]},
]


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "viewer"
    permissions: Optional[dict[str, list[str]]] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    permissions: Optional[dict[str, list[str]]] = None


class PasswordReset(BaseModel):
    new_password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    permissions: Optional[dict[str, list[str]]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
