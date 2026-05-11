from pydantic import BaseModel, field_validator
from typing import Optional, List
# IMPORTANTE: importar `date` com alias para evitar shadowing.
# Em Pydantic v2, `date: Optional[date] = None` faz o atributo de classe `date`
# valer None; ao re-resolver type hints, o tipo vira `Optional[None]` (ou seja,
# só None) e o validador rejeita strings com "Input should be None".
# Usar alias `_date` impede a colisão de nomes com o campo `date`.
from datetime import date as _date, datetime


def _empty_to_none(v):
    """Converte string vazia/'null'/'None' para None (Pydantic aceita None)."""
    if isinstance(v, str) and v.strip() in ("", "null", "None"):
        return None
    return v


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
    start_date: _date
    end_date: Optional[_date] = None
    financial_goal: Optional[float] = None
    status: str = "Ativo"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    end_date: Optional[_date] = None
    financial_goal: Optional[float] = None
    status: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    start_date: _date
    end_date: Optional[_date] = None
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
    date: _date
    type: str
    value: float
    description: Optional[str] = None
    payment_method: Optional[str] = None
    category_id: Optional[int] = None
    member_id: Optional[int] = None
    project_id: Optional[int] = None
    status: str = "Previsto"


class TransactionUpdate(BaseModel):
    date: Optional[_date] = None
    type: Optional[str] = None
    value: Optional[float] = None
    description: Optional[str] = None
    payment_method: Optional[str] = None
    category_id: Optional[int] = None
    member_id: Optional[int] = None
    project_id: Optional[int] = None
    status: Optional[str] = None
    bank_origin: Optional[str] = None
    payment_date: Optional[_date] = None

    # Aceita string vazia como None (frontend pode enviar "" para campos opcionais)
    @field_validator("date", "payment_date", mode="before")
    @classmethod
    def _coerce_dates(cls, v):
        return _empty_to_none(v)

    @field_validator(
        "type", "description", "payment_method", "status", "bank_origin",
        mode="before",
    )
    @classmethod
    def _coerce_strings(cls, v):
        return _empty_to_none(v)

    @field_validator("category_id", "member_id", "project_id", mode="before")
    @classmethod
    def _coerce_ids(cls, v):
        return _empty_to_none(v)


class TransactionResponse(BaseModel):
    id: int
    date: _date
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
    bank_reference: Optional[str] = None
    payment_date: Optional[_date] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TransactionConfirmPayload(BaseModel):
    payment_date: Optional[_date] = None  # default: hoje


# --- Batch Operations ---
class BatchDeleteRequest(BaseModel):
    ids: List[int]


# --- Recurring Transactions ---
class RecurringTransactionCreate(BaseModel):
    date: _date
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
    total_income: float          # Confirmadas (caixa real)
    total_expense: float         # Confirmadas (caixa real)
    balance: float               # Saldo de caixa real
    total_transactions: int      # Total de Confirmadas
    forecast_in: float = 0       # Soma de Previstos (Entrada) até hoje + N dias
    forecast_out: float = 0      # Soma de Previstos (Saída) até hoje + N dias
    forecast_in_count: int = 0
    forecast_out_count: int = 0
    pending_receivables: float
    pending_payables: float
