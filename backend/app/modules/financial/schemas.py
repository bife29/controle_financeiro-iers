from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


# --- Category ---
class CategoryCreate(BaseModel):
    name: str
    type: str  # Entrada / Saída
    nature: str  # Fixa / Variável


class CategoryResponse(BaseModel):
    id: int
    name: str
    type: str
    nature: str
    is_active: bool

    class Config:
        from_attributes = True


# --- Project ---
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    financial_goal: Optional[float] = None
    status: str = "Ativo"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    end_date: Optional[date] = None
    financial_goal: Optional[float] = None
    status: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    financial_goal: Optional[float] = None
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProjectDashboard(BaseModel):
    project: ProjectResponse
    total_received: float
    total_spent: float
    balance: float
    participant_count: int
    paid_count: int
    pending_count: int


# --- Transaction ---
class TransactionCreate(BaseModel):
    date: date
    type: str
    value: float
    description: Optional[str] = None
    payment_method: Optional[str] = None
    category_id: Optional[int] = None
    member_id: Optional[int] = None
    project_id: Optional[int] = None
    status: str = "Previsto"


class TransactionUpdate(BaseModel):
    date: Optional[date] = None
    type: Optional[str] = None
    value: Optional[float] = None
    description: Optional[str] = None
    payment_method: Optional[str] = None
    category_id: Optional[int] = None
    member_id: Optional[int] = None
    project_id: Optional[int] = None
    status: Optional[str] = None
    bank_origin: Optional[str] = None


class TransactionResponse(BaseModel):
    id: int
    date: date
    type: str
    value: float
    description: Optional[str] = None
    payment_method: Optional[str] = None
    category_id: Optional[int] = None
    member_id: Optional[int] = None
    project_id: Optional[int] = None
    status: str
    imported_from: Optional[str] = None
    is_recurring: bool = False
    recurring_group_id: Optional[str] = None
    bank_origin: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Batch Operations ---
class BatchDeleteRequest(BaseModel):
    ids: List[int]


# --- Recurring Transactions ---
class RecurringTransactionCreate(BaseModel):
    date: date
    type: str
    value: float
    description: Optional[str] = None
    payment_method: Optional[str] = None
    category_id: Optional[int] = None
    member_id: Optional[int] = None
    project_id: Optional[int] = None
    recurrence_count: int  # Quantas vezes repetir
    recurrence_day: Optional[int] = None  # Dia do mês (se None, usa o dia da date)


# --- ParticipantEvent ---
class ParticipantEventCreate(BaseModel):
    member_id: int
    project_id: int
    agreed_value: float = 0
    status: str = "Pendente"


class ParticipantEventUpdate(BaseModel):
    agreed_value: Optional[float] = None
    paid_value: Optional[float] = None
    status: Optional[str] = None


class ParticipantEventResponse(BaseModel):
    id: int
    member_id: int
    project_id: int
    agreed_value: float
    paid_value: float
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- AuditLog ---
class AuditLogResponse(BaseModel):
    id: int
    action: str
    entity: str
    entity_id: int
    user_id: Optional[int] = None
    before_data: Optional[str] = None
    after_data: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Dashboard ---
class FinancialSummary(BaseModel):
    total_income: float
    total_expense: float
    balance: float
    total_transactions: int
    pending_receivables: float
    pending_payables: float
