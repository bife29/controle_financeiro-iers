from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, func
from ...core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="viewer")
    # Roles: super_admin, pastor, financeiro, secretaria, viewer
    permissions = Column(JSON, nullable=True)
    # Granular permissions: {"dashboard": ["view"], "financeiro": ["view","create","edit","delete"], ...}
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
