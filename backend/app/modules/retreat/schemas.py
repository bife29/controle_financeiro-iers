from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


# ============ RETIRO ============

class RetreatCreate(BaseModel):
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    start_date: date
    end_date: date
    max_participants: Optional[int] = None
    cost_adult: float = 0
    cost_child: float = 0
    total_budget: float = 0
    bus_capacity: Optional[int] = None
    bed_capacity: Optional[int] = None


class RetreatUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    max_participants: Optional[int] = None
    cost_adult: Optional[float] = None
    cost_child: Optional[float] = None
    total_budget: Optional[float] = None
    bus_capacity: Optional[int] = None
    bed_capacity: Optional[int] = None
    status: Optional[str] = None


class RetreatResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    start_date: date
    end_date: date
    max_participants: Optional[int] = None
    cost_adult: float
    cost_child: float
    total_budget: float
    bus_capacity: Optional[int] = None
    bed_capacity: Optional[int] = None
    status: str
    project_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ PARTICIPANTE ============

class ParticipantCreate(BaseModel):
    retreat_id: int
    member_id: Optional[int] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    is_member: bool = True
    participant_type: str = "adulto"  # adulto / crianca
    individual_cost: Optional[float] = None  # Se None, usa o valor padrão do retiro
    payment_status: str = "Pendente"
    installments_count: int = 1
    bus_option: str = "Sim"    # Sim / Nao / Colo
    bed_option: str = "Sim"    # Sim / Nao / Divide
    notes: Optional[str] = None


class ParticipantUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    participant_type: Optional[str] = None
    individual_cost: Optional[float] = None
    payment_status: Optional[str] = None
    installments_count: Optional[int] = None
    bus_option: Optional[str] = None
    bed_option: Optional[str] = None
    inscription_status: Optional[str] = None
    notes: Optional[str] = None


class ParticipantResponse(BaseModel):
    id: int
    retreat_id: int
    member_id: Optional[int] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    is_member: bool
    participant_type: str
    individual_cost: float
    payment_status: str
    paid_value: float
    installments_count: int
    bus_option: str
    bed_option: str
    inscription_status: str
    notes: Optional[str] = None
    registered_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ PAGAMENTO (CARNÊ) ============

class PaymentCreate(BaseModel):
    participant_id: int
    installment_number: int
    value: float
    due_date: Optional[date] = None
    payment_method: Optional[str] = None


class PaymentUpdate(BaseModel):
    paid_date: Optional[date] = None
    status: Optional[str] = None
    payment_method: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    participant_id: int
    retreat_id: int
    installment_number: int
    value: float
    due_date: Optional[date] = None
    paid_date: Optional[date] = None
    status: str
    payment_method: Optional[str] = None
    transaction_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ DASHBOARD ============

class LogisticsDashboard(BaseModel):
    bus_capacity: Optional[int]
    bus_occupied: int          # Sim + Colo
    bus_available: int
    bus_sim_count: int         # Assento próprio
    bus_colo_count: int        # No colo
    bed_capacity: Optional[int]
    bed_occupied: int          # Sim + Divide
    bed_available: int
    bed_sim_count: int         # Cama própria
    bed_divide_count: int      # Divide cama
    waiting_count: int         # Em lista de espera


class RetreatDashboard(BaseModel):
    retreat: RetreatResponse
    total_participants: int
    confirmed_count: int
    waiting_count: int
    adults_count: int
    children_count: int
    members_count: int
    non_members_count: int
    paid_count: int
    partial_count: int
    pending_count: int
    exempt_count: int
    total_collected: float
    total_expected: float
    total_budget: float
    balance: float  # collected - budget
    logistics: LogisticsDashboard
