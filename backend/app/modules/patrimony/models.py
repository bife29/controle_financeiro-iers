from sqlalchemy import (
    Column, Integer, String, Date, Float, Text, Boolean, DateTime, ForeignKey, func
)
from sqlalchemy.orm import relationship
from ...core.database import Base


# Status do bem (mapeia para cores no frontend)
ASSET_STATUSES = ("active_in_use", "active_reserve", "in_maintenance", "decommissioned")

# Motivos de baixa
WRITE_OFF_REASONS = ("defect", "broken", "theft", "loss", "other")


class AssetCategory(Base):
    """Categorias de bens (Equipamento de som, eletro/eletrônico, móvel etc)."""
    __tablename__ = "asset_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AssetLocation(Base):
    """Locais/ambientes onde o bem fica (altar, som, infantil, templo, estoque, cantina...)."""
    __tablename__ = "asset_locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Asset(Base):
    """Bem patrimonial da igreja."""
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(30), nullable=False, unique=True, index=True)  # PAT-0001 (editável)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    acquisition_date = Column(Date, nullable=True)
    value = Column(Float, nullable=True)
    invoice_number = Column(String(100), nullable=True)  # NF

    category_id = Column(Integer, ForeignKey("asset_categories.id"), nullable=True)
    location_id = Column(Integer, ForeignKey("asset_locations.id"), nullable=True)
    location_other = Column(String(150), nullable=True)  # quando "Outro"

    status = Column(String(30), nullable=False, default="active_in_use")
    # active_in_use | active_reserve | in_maintenance | decommissioned

    # Manutenção preventiva
    maintenance_interval_months = Column(Integer, nullable=True)  # a cada X meses
    last_maintenance_date = Column(Date, nullable=True)  # auto-atualizada ao retornar de manutenção
    next_maintenance_due = Column(Date, nullable=True)  # calculado: last_maintenance_date + interval

    # Garantia (do produto na compra)
    warranty_until = Column(Date, nullable=True)

    # Baixa
    decommission_reason = Column(String(20), nullable=True)  # defect|broken|theft|loss|other
    decommission_other = Column(Text, nullable=True)
    decommission_date = Column(Date, nullable=True)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    category = relationship("AssetCategory", lazy="joined")
    location = relationship("AssetLocation", lazy="joined")
    maintenances = relationship(
        "AssetMaintenance", back_populates="asset",
        cascade="all, delete-orphan", order_by="AssetMaintenance.sent_date.desc()"
    )


class AssetMaintenance(Base):
    """Histórico de manutenções de um bem (cada saída/retorno é um registro)."""
    __tablename__ = "asset_maintenances"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False, index=True)

    sent_date = Column(Date, nullable=False)
    expected_return = Column(Date, nullable=True)
    returned_date = Column(Date, nullable=True)  # null = ainda em manutenção

    provider_name = Column(String(200), nullable=True)
    provider_address = Column(String(300), nullable=True)
    provider_phone = Column(String(50), nullable=True)
    provider_deadline = Column(String(100), nullable=True)  # prazo informado pelo prestador (texto livre)

    service_warranty_until = Column(Date, nullable=True)  # garantia da manutenção realizada
    cost = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    asset = relationship("Asset", back_populates="maintenances")
