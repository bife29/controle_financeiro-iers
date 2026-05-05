from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from ...core.database import Base


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(30), nullable=False)  # sugestao / erro / melhoria
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(20), default="media")  # baixa / media / alta / critica
    status = Column(String(20), default="aberto")  # aberto / em_analise / resolvido / recusado
    module = Column(String(50), nullable=True)  # financeiro / secretaria / retiro / geral
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    admin_response = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
