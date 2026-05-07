from sqlalchemy import Column, Integer, String, Date, Text, Boolean, DateTime, func
from ...core.database import Base


class Event(Base):
    """Evento da igreja exibido no calendário (sem horário, sem recorrência por enquanto)."""
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    date = Column(Date, nullable=False, index=True)
    type = Column(String(50), nullable=True)  # culto, reuniao, retiro, batismo, outro...
    description = Column(Text, nullable=True)
    location = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class WhatsappGroup(Base):
    """Catálogo de grupos do WhatsApp da igreja (apenas metadados — sem credenciais)."""
    __tablename__ = "whatsapp_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    kind = Column(String(50), nullable=True)  # avisos, jovens, lideranca, geral...
    invite_link = Column(String(500), nullable=True)  # link público (opcional)
    notes = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MessageTemplate(Base):
    """Templates de mensagens (parabéns, aviso geral...).

    Suporta placeholders: {nome}, {idade}, {grupo}, {evento}, {data}.
    """
    __tablename__ = "message_templates"

    id = Column(Integer, primary_key=True, index=True)
    kind = Column(String(50), nullable=False, index=True)  # birthday, event_reminder, generic
    title = Column(String(100), nullable=False)
    body = Column(Text, nullable=False)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ChurchSettings(Base):
    """Configurações globais da igreja (linha única, id=1)."""
    __tablename__ = "church_settings"

    id = Column(Integer, primary_key=True, index=True)
    secretary_phone = Column(String(20), nullable=True)  # nº exibido como remetente sugerido
    church_name = Column(String(200), nullable=True)
    birthday_alert_days = Column(Integer, default=2)  # alerta D-2 e D-1 por padrão
    event_alert_days = Column(Integer, default=2)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
