from typing import Optional
from datetime import date
from pydantic import BaseModel

class Period(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: Optional[date]

class Category(BaseModel):
    id: int
    name: str
    type: str  # Entrada ou Saída
    nature: str  # Fixa ou Variável

class Member(BaseModel):
    id: int
    name: str
    cpf: str
    email: Optional[str]
    phone: Optional[str]
    active: bool = True
class Project(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: Optional[date]
    financial_goal: Optional[float]
    status: str  # Ativo/Encerrado

class ParticipantEvent(BaseModel):
    id: int
    member_id: int
    project_id: int
    agreed_value: float
    paid_value: float
    status: str  # Pendente, Pago, Isento

class Account(BaseModel):
    id: int
    type: str  # pagar/receber
    description: Optional[str]
    value: float
    due_date: date
    category_id: int
    member_id: Optional[int]
    status: str  # pendente, vencida, paga
    recurrence: Optional[str]

class Transaction(BaseModel):
    id: int
    date: date
    type: str  # Entrada/Saída
    value: float
    payment_method: str
    category_id: int
    member_id: Optional[int]
    project_id: int
    description: Optional[str]
    period_id: int
    status: str  # Previsto/Conciliado
