from pydantic import BaseModel, field_validator
from typing import Optional, Literal
from datetime import date, datetime


# -------- Categorias --------
class AssetCategoryBase(BaseModel):
    name: str
    is_active: bool = True


class AssetCategoryCreate(AssetCategoryBase):
    pass


class AssetCategoryUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class AssetCategoryResponse(AssetCategoryBase):
    id: int

    class Config:
        from_attributes = True


# -------- Locais --------
class AssetLocationBase(BaseModel):
    name: str
    is_active: bool = True


class AssetLocationCreate(AssetLocationBase):
    pass


class AssetLocationUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class AssetLocationResponse(AssetLocationBase):
    id: int

    class Config:
        from_attributes = True


# -------- Manutenções --------
class AssetMaintenanceBase(BaseModel):
    sent_date: date
    expected_return: Optional[date] = None
    returned_date: Optional[date] = None
    provider_name: Optional[str] = None
    provider_address: Optional[str] = None
    provider_phone: Optional[str] = None
    provider_deadline: Optional[str] = None
    service_warranty_until: Optional[date] = None
    cost: Optional[float] = None
    notes: Optional[str] = None


class AssetMaintenanceCreate(AssetMaintenanceBase):
    pass


class AssetMaintenanceUpdate(BaseModel):
    sent_date: Optional[date] = None
    expected_return: Optional[date] = None
    returned_date: Optional[date] = None
    provider_name: Optional[str] = None
    provider_address: Optional[str] = None
    provider_phone: Optional[str] = None
    provider_deadline: Optional[str] = None
    service_warranty_until: Optional[date] = None
    cost: Optional[float] = None
    notes: Optional[str] = None


class MaintenanceReturn(BaseModel):
    """Payload para registrar o retorno de uma manutenção."""
    returned_date: date
    service_warranty_until: Optional[date] = None
    cost: Optional[float] = None
    notes: Optional[str] = None
    new_status: Literal["active_in_use", "active_reserve"] = "active_in_use"


class AssetMaintenanceResponse(AssetMaintenanceBase):
    id: int
    asset_id: int

    class Config:
        from_attributes = True


# -------- Asset --------
AssetStatus = Literal["active_in_use", "active_reserve", "in_maintenance", "decommissioned"]
WriteOffReason = Literal["defect", "broken", "theft", "loss", "other"]


class AssetBase(BaseModel):
    code: Optional[str] = None  # se não informado, gerado automaticamente
    name: str
    description: Optional[str] = None
    acquisition_date: Optional[date] = None
    value: Optional[float] = None
    invoice_number: Optional[str] = None
    category_id: Optional[int] = None
    location_id: Optional[int] = None
    location_other: Optional[str] = None
    status: AssetStatus = "active_in_use"
    maintenance_interval_months: Optional[int] = None
    warranty_until: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("code", "description", "invoice_number", "location_other", "notes",
                     mode="before")
    @classmethod
    def _empty_to_none(cls, v):
        if isinstance(v, str) and v.strip() == "":
            return None
        return v


class AssetCreate(AssetBase):
    # quando vier True, backend cria transação de saída no Financeiro
    create_financial_transaction: bool = False
    financial_project_id: Optional[int] = None
    financial_category_id: Optional[int] = None


class AssetUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    acquisition_date: Optional[date] = None
    value: Optional[float] = None
    invoice_number: Optional[str] = None
    category_id: Optional[int] = None
    location_id: Optional[int] = None
    location_other: Optional[str] = None
    status: Optional[AssetStatus] = None
    maintenance_interval_months: Optional[int] = None
    warranty_until: Optional[date] = None
    notes: Optional[str] = None


class WriteOffPayload(BaseModel):
    reason: WriteOffReason
    other_text: Optional[str] = None
    decommission_date: Optional[date] = None  # default = hoje no backend


class AssetResponse(AssetBase):
    id: int
    code: str
    last_maintenance_date: Optional[date] = None
    next_maintenance_due: Optional[date] = None
    decommission_reason: Optional[str] = None
    decommission_other: Optional[str] = None
    decommission_date: Optional[date] = None
    category: Optional[AssetCategoryResponse] = None
    location: Optional[AssetLocationResponse] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AssetDetailResponse(AssetResponse):
    maintenances: list[AssetMaintenanceResponse] = []


# -------- Dashboard / alertas --------
class AssetAlert(BaseModel):
    asset_id: int
    code: str
    name: str
    days_until: int  # negativo se vencido
    due_date: date
    kind: Literal["maintenance", "warranty", "service_warranty", "expected_return"]


class StatusCount(BaseModel):
    status: str
    count: int


class PatrimonyDashboard(BaseModel):
    total_assets: int
    total_value: float
    counts_by_status: list[StatusCount]
    in_maintenance: int
    upcoming_maintenance: list[AssetAlert]
    upcoming_warranty: list[AssetAlert]
    overdue_returns: list[AssetAlert]
