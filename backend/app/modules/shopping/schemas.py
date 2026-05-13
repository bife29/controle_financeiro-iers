from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


# ============ ShoppingListItem ============

class ShoppingListItemBase(BaseModel):
    description: str = Field(min_length=1, max_length=200)
    quantity: float = Field(default=1.0, gt=0)
    unit: Optional[str] = Field(default=None, max_length=20)
    estimated_price: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None
    is_purchased: bool = False


class ShoppingListItemCreate(ShoppingListItemBase):
    pass


class ShoppingListItemUpdate(BaseModel):
    description: Optional[str] = Field(default=None, min_length=1, max_length=200)
    quantity: Optional[float] = Field(default=None, gt=0)
    unit: Optional[str] = Field(default=None, max_length=20)
    estimated_price: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None
    is_purchased: Optional[bool] = None


class ShoppingListItemResponse(ShoppingListItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    list_id: int
    added_by_id: Optional[int] = None
    created_at: Optional[datetime] = None


# ============ ShoppingList ============

class ShoppingListBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    is_archived: bool = False


class ShoppingListCreate(ShoppingListBase):
    pass


class ShoppingListUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_archived: Optional[bool] = None


class ShoppingListResponse(ShoppingListBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_by_id: Optional[int] = None
    created_at: Optional[datetime] = None
    items_count: int = 0
    pending_count: int = 0


class ShoppingListDetailResponse(ShoppingListResponse):
    items: list[ShoppingListItemResponse] = []


# ============ PurchaseRequestItem ============

class PurchaseRequestItemBase(BaseModel):
    description: str = Field(min_length=1, max_length=200)
    quantity: float = Field(default=1.0, gt=0)
    unit: Optional[str] = Field(default=None, max_length=20)
    estimated_price: Optional[float] = Field(default=None, ge=0)
    final_price: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None


class PurchaseRequestItemCreate(PurchaseRequestItemBase):
    pass


class PurchaseRequestItemUpdate(BaseModel):
    description: Optional[str] = Field(default=None, min_length=1, max_length=200)
    quantity: Optional[float] = Field(default=None, gt=0)
    unit: Optional[str] = Field(default=None, max_length=20)
    estimated_price: Optional[float] = Field(default=None, ge=0)
    final_price: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None


class PurchaseRequestItemResponse(PurchaseRequestItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    request_id: int


# ============ PurchaseRequest ============

class PurchaseRequestBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    supplier: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = None
    project_id: Optional[int] = None
    category_id: Optional[int] = None
    list_id: Optional[int] = None


class PurchaseRequestCreate(PurchaseRequestBase):
    items: list[PurchaseRequestItemCreate] = Field(default_factory=list)


class PurchaseRequestUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    supplier: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = None
    project_id: Optional[int] = None
    category_id: Optional[int] = None
    items: Optional[list[PurchaseRequestItemCreate]] = None  # se vier, substitui todos


class PurchaseRequestResponse(PurchaseRequestBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: str
    requested_by_id: Optional[int] = None
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    received_at: Optional[datetime] = None
    transaction_id: Optional[int] = None
    created_at: Optional[datetime] = None
    items_count: int = 0
    total_estimated: float = 0.0
    total_final: float = 0.0


class PurchaseRequestDetailResponse(PurchaseRequestResponse):
    items: list[PurchaseRequestItemResponse] = []


# ============ Ações ============

class ApprovalPayload(BaseModel):
    notes: Optional[str] = None


class RejectionPayload(BaseModel):
    reason: str = Field(min_length=1)


class ReceivePayload(BaseModel):
    """Registra o recebimento e cria a Transação Saída.

    items: lista com {id, final_price} para preencher os preços finais.
            Se omitido, usa estimated_price de cada item.
    payment_method: para a transação criada
    payment_date: data do pagamento (default: hoje)
    status: 'Confirmado' (default) ou 'Previsto'
    """
    items: Optional[list[dict]] = None  # [{id, final_price}]
    payment_method: Optional[str] = None
    payment_date: Optional[str] = None  # ISO date
    status: str = "Confirmado"
