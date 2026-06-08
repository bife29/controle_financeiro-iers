from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, func, Index
from ...core.database import Base


class Notification(Base):
    """Notificação in-app dirigida a um usuário.

    type: identificador da origem (ex: 'shopping.assignment', 'purchase.assignment').
    link: rota relativa do frontend (ex: '/compras/listas/12').
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=True)
    link = Column(String(255), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


Index("ix_notifications_user_unread", Notification.user_id, Notification.is_read)
