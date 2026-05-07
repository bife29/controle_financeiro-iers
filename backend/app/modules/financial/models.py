from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Date,
    ForeignKey, Text, func
)
from sqlalchemy.orm import relationship
from ...core.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    type = Column(String(20), nullable=False)  # Entrada / Saída
    nature = Column(String(20), nullable=False)  # Fixa / Variável
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    financial_goal = Column(Float, nullable=True)
    status = Column(String(20), default="Ativo")  # Ativo / Encerrado
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    type = Column(String(20), nullable=False)  # Entrada / Saída
    value = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    payment_method = Column(String(50), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    status = Column(String(20), default="Previsto")  # Previsto / Confirmado
    is_recurring = Column(Boolean, default=False)
    recurring_group_id = Column(String(50), nullable=True)  # UUID para agrupar recorrentes
    imported_from = Column(String(50), nullable=True)  # ofx / csv / manual / recorrente
    bank_origin = Column(String(100), nullable=True)  # Banco de origem (ex: Bradesco, Santander)
    bank_reference = Column(String(100), nullable=True, index=True)  # FITID/ID da linha do extrato OFX
    payment_date = Column(Date, nullable=True)  # Data efetiva da confirmação (quando saiu/entrou no caixa)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    category = relationship("Category", lazy="joined")
    project = relationship("Project", lazy="joined")


class ParticipantEvent(Base):
    __tablename__ = "participant_events"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    agreed_value = Column(Float, default=0)
    paid_value = Column(Float, default=0)
    status = Column(String(20), default="Pendente")  # Pendente / Pago / Isento
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    member = relationship("Member", lazy="joined")
    project = relationship("Project", lazy="joined")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(20), nullable=False)  # create / edit / delete
    entity = Column(String(100), nullable=False)
    entity_id = Column(Integer, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    before_data = Column(Text, nullable=True)  # JSON
    after_data = Column(Text, nullable=True)   # JSON
    created_at = Column(DateTime(timezone=True), server_default=func.now())
