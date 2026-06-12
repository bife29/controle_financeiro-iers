"""Admin operations: reset operational data preserving users & members.

Usado para "limpar tudo" antes de iniciar o uso produtivo do sistema sem
ter que recriar contas ou perder o cadastro de membros já feito.

Endpoint: POST /api/admin/reset-data
- Restrito a super_admin.
- Exige body { "confirm": "LIMPAR TUDO" } para evitar disparos acidentais.
- Em produção (DEBUG=False) exige também env var ALLOW_PROD_DATA_WIPE=true.
- Preserva: User, Member.
- Apaga: Transactions, Projects (recria seed), Categories (recria seed),
  Audit logs, ParticipantEvent, Retreats + Participants + Payments,
  Shopping lists/items/requests, Patrimony assets/categories/locations/maintenances,
  Secretaria events/groups/templates, Feedback, Notifications.
"""
import logging
from os import getenv

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete as sa_delete, text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("app.admin.reset")

from ...core.config import settings
from ...core.database import get_db
from ...core.security import get_current_user

router = APIRouter(prefix="/api/admin", tags=["Admin"])


CONFIRMATION_PHRASE = "LIMPAR TUDO"


class ResetDataPayload(BaseModel):
    confirm: str


def _require_super_admin(current_user=Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=403,
            detail="Acesso negado. Apenas super_admin pode resetar os dados.",
        )
    return current_user


@router.post("/reset-data")
async def reset_data(
    payload: ResetDataPayload,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_require_super_admin),
):
    """Apaga TODOS os dados operacionais preservando usuários e membros.

    Body obrigatório: {"confirm": "LIMPAR TUDO"}.
    """
    if payload.confirm != CONFIRMATION_PHRASE:
        raise HTTPException(
            status_code=400,
            detail=f"Para confirmar, envie {{'confirm': '{CONFIRMATION_PHRASE}'}}.",
        )

    # Em produção exige opt-in via env var para evitar acidente catastrófico.
    if not settings.DEBUG and getenv("ALLOW_PROD_DATA_WIPE", "").lower() not in ("1", "true", "yes"):
        raise HTTPException(
            status_code=403,
            detail=(
                "Em produção, o reset exige a variável de ambiente "
                "ALLOW_PROD_DATA_WIPE=true para ser autorizada."
            ),
        )

    # Imports tardios para evitar ciclos durante boot do FastAPI.
    from ..financial.models import (
        Transaction, Project, Category, AuditLog, ParticipantEvent,
    )
    from ..retreat.models import Retreat, RetreatParticipant, RetreatPayment
    from ..shopping.models import (
        ShoppingList, ShoppingListItem, PurchaseRequest, PurchaseRequestItem,
    )
    from ..patrimony.models import (
        Asset, AssetCategory, AssetLocation, AssetMaintenance,
    )
    from ..secretaria.models import (
        Event, WhatsappGroup, MessageTemplate,
    )
    from ..feedback.models import Feedback
    from ..notifications.models import Notification

    counts: dict[str, int] = {}

    async def _wipe(model, label: str):
        # Conta antes de apagar (informação útil pro frontend).
        n = (await db.execute(text(f"SELECT COUNT(*) FROM {model.__tablename__}"))).scalar() or 0
        if n:
            await db.execute(sa_delete(model))
        counts[label] = int(n)

    # Ordem importa: filhos antes dos pais (FKs).
    # 1) Retiros: pagamentos -> participantes -> retiros
    await _wipe(RetreatPayment, "retiros_pagamentos")
    await _wipe(RetreatParticipant, "retiros_participantes")
    await _wipe(Retreat, "retiros")

    # 2) Compras: itens de pedido -> pedido -> itens de lista -> lista
    await _wipe(PurchaseRequestItem, "compras_pedido_itens")
    await _wipe(PurchaseRequest, "compras_pedidos")
    await _wipe(ShoppingListItem, "compras_lista_itens")
    await _wipe(ShoppingList, "compras_listas")

    # 3) Patrimônio: manutenções -> assets -> taxonomias
    await _wipe(AssetMaintenance, "patrimonio_manutencoes")
    await _wipe(Asset, "patrimonio_bens")
    await _wipe(AssetCategory, "patrimonio_categorias")
    await _wipe(AssetLocation, "patrimonio_locais")

    # 4) Secretaria
    await _wipe(Event, "secretaria_eventos")
    await _wipe(WhatsappGroup, "secretaria_grupos_whatsapp")
    await _wipe(MessageTemplate, "secretaria_templates")

    # 5) Feedback / Notificações / Auditoria
    await _wipe(Feedback, "feedbacks")
    await _wipe(Notification, "notificacoes")
    await _wipe(AuditLog, "auditoria")

    # 6) Financeiro: ParticipantEvent -> Transações -> Categorias -> Projetos
    await _wipe(ParticipantEvent, "financeiro_eventos_participantes")
    await _wipe(Transaction, "financeiro_transacoes")
    await _wipe(Category, "financeiro_categorias")
    await _wipe(Project, "financeiro_projetos")

    # Flush garante que os DELETEs sejam emitidos antes dos INSERTs do seed.
    await db.flush()

    # 7) Re-seed mínimo (projeto e categorias padrão) para o sistema seguir
    #    operacional sem precisar rodar `python seed.py` manualmente.
    from datetime import date as _date

    default_project = Project(
        name="Geral/Dízimos",
        description="Projeto padrão para dízimos e ofertas (criado no reset)",
        start_date=_date.today(),
        status="Ativo",
    )
    db.add(default_project)

    default_categories = [
        ("Dízimo", "Entrada", "Fixa"),
        ("Oferta", "Entrada", "Variável"),
        ("Doação", "Entrada", "Variável"),
        ("Aluguel", "Saída", "Fixa"),
        ("Energia", "Saída", "Fixa"),
        ("Água", "Saída", "Fixa"),
        ("Internet", "Saída", "Fixa"),
        ("Manutenção", "Saída", "Variável"),
        ("Material", "Saída", "Variável"),
        ("Outros", "Saída", "Variável"),
    ]
    for name, ctype, nature in default_categories:
        db.add(Category(name=name, type=ctype, nature=nature))

    # Patrimônio: re-semear categorias e locais padrão (igual ao seed.py).
    pat_categorias = [
        "Equipamento de Som",
        "Eletro/Eletrônico",
        "Móvel",
        "Instrumento Musical",
        "Iluminação",
        "Outro",
    ]
    for nome in pat_categorias:
        db.add(AssetCategory(name=nome))

    pat_locais = [
        "Altar", "Som", "Ministério Infantil", "Templo",
        "Estoque", "Cantina", "Secretaria",
    ]
    for nome in pat_locais:
        db.add(AssetLocation(name=nome))

    # IMPORTANTE: commit explícito aqui. Embora `get_db` faça commit no final,
    # algumas integrações (FastAPI dependency teardown, testes) podem fechar a
    # sessão antes do commit chegar. Fazer o commit explicitamente garante que
    # os DELETEs sejam persistidos mesmo se algo no resto do request fizer
    # rollback depois.
    try:
        await db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao commit do reset-data: %s", exc)
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Falha ao persistir o reset: {exc}",
        )

    # Contagens preservadas (para o usuário ver no relatório pós-reset).
    preserved_users = int((await db.execute(text("SELECT COUNT(*) FROM users"))).scalar() or 0)
    preserved_members = int((await db.execute(text("SELECT COUNT(*) FROM members"))).scalar() or 0)
    preserved_church = int((await db.execute(text("SELECT COUNT(*) FROM church_settings"))).scalar() or 0)

    return {
        "detail": "Dados operacionais limpos com sucesso. Usuários, membros e configurações da igreja preservados.",
        "preserved": {
            "users": preserved_users,
            "members": preserved_members,
            "church_settings": preserved_church,
        },
        "deleted_counts": counts,
        "seeded": {
            "projects": 1,
            "categories": len(default_categories),
            "patrimony_categories": len(pat_categorias),
            "patrimony_locations": len(pat_locais),
        },
    }
