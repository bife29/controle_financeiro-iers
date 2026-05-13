from sqlalchemy import (
    Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey, func
)
from sqlalchemy.orm import relationship
from ...core.database import Base


# Status de PurchaseRequest
PURCHASE_STATUSES = ("Pendente", "Aprovado", "Rejeitado", "Recebido", "Cancelado")


class ShoppingList(Base):
    """Lista de compras nomeada (ex: 'Cozinha', 'Limpeza').

    Vários itens podem ser adicionados; quando 'gera pedido', um
    PurchaseRequest é criado com os itens não comprados.
    """
    __tablename__ = "shopping_lists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    items = relationship(
        "ShoppingListItem", back_populates="list",
        cascade="all, delete-orphan", order_by="ShoppingListItem.id",
    )


class ShoppingListItem(Base):
    """Item dentro de uma ShoppingList."""
    __tablename__ = "shopping_list_items"

    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("shopping_lists.id", ondelete="CASCADE"), nullable=False)

    description = Column(String(200), nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    unit = Column(String(20), nullable=True)  # un, kg, L, cx
    estimated_price = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    is_purchased = Column(Boolean, default=False, nullable=False)

    added_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    list = relationship("ShoppingList", back_populates="items")


class PurchaseRequest(Base):
    """Pedido de compra, com workflow de aprovação e recebimento."""
    __tablename__ = "purchase_requests"

    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("shopping_lists.id"), nullable=True)
    title = Column(String(200), nullable=False)
    supplier = Column(String(200), nullable=True)  # campo livre
    notes = Column(Text, nullable=True)

    status = Column(String(15), nullable=False, default="Pendente")  # Pendente|Aprovado|Rejeitado|Recebido|Cancelado

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    received_at = Column(DateTime(timezone=True), nullable=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    items = relationship(
        "PurchaseRequestItem", back_populates="request",
        cascade="all, delete-orphan", order_by="PurchaseRequestItem.id",
    )


class PurchaseRequestItem(Base):
    """Item de um PurchaseRequest. final_price é preenchido no recebimento."""
    __tablename__ = "purchase_request_items"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("purchase_requests.id", ondelete="CASCADE"), nullable=False)

    description = Column(String(200), nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    unit = Column(String(20), nullable=True)
    estimated_price = Column(Float, nullable=True)
    final_price = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)

    request = relationship("PurchaseRequest", back_populates="items")
