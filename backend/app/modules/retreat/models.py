from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Date,
    ForeignKey, Text, func
)
from ...core.database import Base


class Retreat(Base):
    __tablename__ = "retreats"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(300), nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    max_participants = Column(Integer, nullable=True)
    cost_adult = Column(Float, default=0)       # Valor por adulto
    cost_child = Column(Float, default=0)       # Valor por criança
    total_budget = Column(Float, default=0)     # Custo total estimado do retiro
    # Capacidade logística
    bus_capacity = Column(Integer, nullable=True)   # Total de vagas de ônibus
    bed_capacity = Column(Integer, nullable=True)   # Total de camas disponíveis
    status = Column(String(20), default="Planejamento")  # Planejamento / Inscricoes / Em_andamento / Encerrado
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RetreatParticipant(Base):
    __tablename__ = "retreat_participants"

    id = Column(Integer, primary_key=True, index=True)
    retreat_id = Column(Integer, ForeignKey("retreats.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=True)  # Null = não-membro
    # Dados para não-membros (ou override de membro)
    name = Column(String(200), nullable=True)
    phone = Column(String(30), nullable=True)
    is_member = Column(Boolean, default=True)
    participant_type = Column(String(10), default="adulto")  # adulto / crianca
    individual_cost = Column(Float, default=0)  # Valor que esta pessoa deve pagar
    payment_status = Column(String(20), default="Pendente")  # Pendente / Parcial / Pago / Isento
    paid_value = Column(Float, default=0)
    installments_count = Column(Integer, default=1)  # Qtd parcelas do carnê
    # Logística operacional
    bus_option = Column(String(10), default="Sim")    # Sim / Nao / Colo
    bed_option = Column(String(10), default="Sim")    # Sim / Nao / Divide
    # Status de inscrição (controle de vagas)
    inscription_status = Column(String(20), default="Confirmado")  # Confirmado / Espera
    notes = Column(Text, nullable=True)
    registered_at = Column(DateTime(timezone=True), server_default=func.now())


class RetreatPayment(Base):
    """Pagamentos individuais (carnê) de cada participante."""
    __tablename__ = "retreat_payments"

    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(Integer, ForeignKey("retreat_participants.id"), nullable=False)
    retreat_id = Column(Integer, ForeignKey("retreats.id"), nullable=False)
    installment_number = Column(Integer, nullable=False)  # Parcela 1, 2, 3...
    value = Column(Float, nullable=False)
    due_date = Column(Date, nullable=True)
    paid_date = Column(Date, nullable=True)
    status = Column(String(20), default="Pendente")  # Pendente / Pago
    payment_method = Column(String(50), nullable=True)  # Pix / Dinheiro / Cartão
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)  # Vínculo ao financeiro
    created_at = Column(DateTime(timezone=True), server_default=func.now())
