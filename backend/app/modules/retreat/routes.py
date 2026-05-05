from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import date
from ...core.database import get_db
from ...core.security import get_current_user, require_roles
from .models import Retreat, RetreatParticipant, RetreatPayment
from ..financial.models import Transaction, Project
from .schemas import (
    RetreatCreate, RetreatUpdate, RetreatResponse,
    ParticipantCreate, ParticipantUpdate, ParticipantResponse,
    PaymentCreate, PaymentUpdate, PaymentResponse,
    RetreatDashboard, LogisticsDashboard
)

router = APIRouter(prefix="/api/retreats", tags=["Retiros"])


# ============ HELPERS ============

async def _get_confirmed_participants(db: AsyncSession, retreat_id: int) -> list[RetreatParticipant]:
    """Retorna participantes confirmados (não em espera)."""
    result = await db.execute(
        select(RetreatParticipant).where(
            RetreatParticipant.retreat_id == retreat_id,
            RetreatParticipant.inscription_status == "Confirmado"
        )
    )
    return list(result.scalars().all())


async def _compute_occupancy(db: AsyncSession, retreat_id: int):
    """Calcula ocupação de ônibus e camas para participantes confirmados."""
    confirmed = await _get_confirmed_participants(db, retreat_id)
    bus_sim = sum(1 for p in confirmed if p.bus_option == "Sim")
    bus_colo = sum(1 for p in confirmed if p.bus_option == "Colo")
    bed_sim = sum(1 for p in confirmed if p.bed_option == "Sim")
    bed_divide = sum(1 for p in confirmed if p.bed_option == "Divide")
    return {
        "confirmed_count": len(confirmed),
        "bus_sim": bus_sim,
        "bus_colo": bus_colo,
        "bus_occupied": bus_sim + bus_colo,  # Colo ocupa lugar de ônibus
        "bed_sim": bed_sim,
        "bed_divide": bed_divide,
        "bed_occupied": bed_sim + bed_divide,
    }


async def _determine_inscription_status(
    db: AsyncSession, retreat: Retreat, bus_option: str, bed_option: str
) -> str:
    """
    Determina se o participante deve ser confirmado ou entrar em espera.
    Regra: se qualquer capacidade limitada estiver cheia, vai para espera.
    """
    occ = await _compute_occupancy(db, retreat.id)

    # Verificar capacidade geral (max_participants)
    if retreat.max_participants and occ["confirmed_count"] >= retreat.max_participants:
        return "Espera"

    # Verificar capacidade de ônibus (se solicita vaga)
    if bus_option in ("Sim", "Colo") and retreat.bus_capacity:
        if occ["bus_occupied"] >= retreat.bus_capacity:
            return "Espera"

    # Verificar capacidade de cama (se solicita vaga)
    if bed_option in ("Sim", "Divide") and retreat.bed_capacity:
        if occ["bed_occupied"] >= retreat.bed_capacity:
            return "Espera"

    return "Confirmado"


async def _promote_from_waitlist(db: AsyncSession, retreat_id: int):
    """Tenta promover participantes da lista de espera quando há vaga."""
    result = await db.execute(select(Retreat).where(Retreat.id == retreat_id))
    retreat = result.scalar_one_or_none()
    if not retreat:
        return

    # Buscar participantes em espera, por ordem de inscrição (FIFO)
    waiting_result = await db.execute(
        select(RetreatParticipant).where(
            RetreatParticipant.retreat_id == retreat_id,
            RetreatParticipant.inscription_status == "Espera"
        ).order_by(RetreatParticipant.registered_at.asc())
    )
    waiting = list(waiting_result.scalars().all())

    for participant in waiting:
        status = await _determine_inscription_status(
            db, retreat, participant.bus_option, participant.bed_option
        )
        if status == "Confirmado":
            participant.inscription_status = "Confirmado"
            await db.flush()
        # Se continua em espera, os próximos também ficarão (capacidade já cheia)
        # mas continuamos tentando pois cada um pode ter diferentes bus/bed options


# ============ RETIROS ============

@router.get("/", response_model=list[RetreatResponse])
async def list_retreats(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = select(Retreat)
    if status:
        query = query.where(Retreat.status == status)
    query = query.order_by(Retreat.start_date.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=RetreatResponse)
async def create_retreat(
    data: RetreatCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "pastor", "secretaria"))
):
    # Cria projeto financeiro automaticamente vinculado ao retiro
    project = Project(
        name=f"Retiro - {data.name}",
        description=f"Projeto financeiro do retiro: {data.name}",
        start_date=data.start_date,
        end_date=data.end_date,
        financial_goal=data.total_budget or None,
        status="Ativo",
    )
    db.add(project)
    await db.flush()

    retreat = Retreat(**data.model_dump(), project_id=project.id)
    db.add(retreat)
    await db.flush()
    await db.refresh(retreat)
    return retreat


@router.get("/{retreat_id}", response_model=RetreatResponse)
async def get_retreat(
    retreat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = await db.execute(select(Retreat).where(Retreat.id == retreat_id))
    retreat = result.scalar_one_or_none()
    if not retreat:
        raise HTTPException(status_code=404, detail="Retiro não encontrado")
    return retreat


@router.put("/{retreat_id}", response_model=RetreatResponse)
async def update_retreat(
    retreat_id: int,
    data: RetreatUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "pastor"))
):
    result = await db.execute(select(Retreat).where(Retreat.id == retreat_id))
    retreat = result.scalar_one_or_none()
    if not retreat:
        raise HTTPException(status_code=404, detail="Retiro não encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(retreat, field, value)
    await db.flush()
    await db.refresh(retreat)

    # Capacidades podem ter aumentado — tentar promover lista de espera
    await _promote_from_waitlist(db, retreat_id)

    return retreat


@router.delete("/{retreat_id}")
async def delete_retreat(
    retreat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin"))
):
    result = await db.execute(select(Retreat).where(Retreat.id == retreat_id))
    retreat = result.scalar_one_or_none()
    if not retreat:
        raise HTTPException(status_code=404, detail="Retiro não encontrado")

    # Remover pagamentos, participantes e retiro (respeitando FK order)
    payments = await db.execute(
        select(RetreatPayment).where(RetreatPayment.retreat_id == retreat_id)
    )
    for p in payments.scalars().all():
        await db.delete(p)
    await db.flush()

    participants = await db.execute(
        select(RetreatParticipant).where(RetreatParticipant.retreat_id == retreat_id)
    )
    for p in participants.scalars().all():
        await db.delete(p)
    await db.flush()

    await db.delete(retreat)
    await db.flush()
    return {"detail": "Retiro excluído com sucesso"}


@router.get("/{retreat_id}/dashboard", response_model=RetreatDashboard)
async def retreat_dashboard(
    retreat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = await db.execute(select(Retreat).where(Retreat.id == retreat_id))
    retreat = result.scalar_one_or_none()
    if not retreat:
        raise HTTPException(status_code=404, detail="Retiro não encontrado")

    participants_result = await db.execute(
        select(RetreatParticipant).where(RetreatParticipant.retreat_id == retreat_id)
    )
    all_participants = list(participants_result.scalars().all())

    total_participants = len(all_participants)
    confirmed = [p for p in all_participants if p.inscription_status == "Confirmado"]
    waiting = [p for p in all_participants if p.inscription_status == "Espera"]
    confirmed_count = len(confirmed)
    waiting_count = len(waiting)
    adults_count = sum(1 for p in all_participants if p.participant_type == "adulto")
    children_count = sum(1 for p in all_participants if p.participant_type == "crianca")
    members_count = sum(1 for p in all_participants if p.is_member)
    non_members_count = total_participants - members_count
    paid_count = sum(1 for p in all_participants if p.payment_status == "Pago")
    partial_count = sum(1 for p in all_participants if p.payment_status == "Parcial")
    pending_count = sum(1 for p in all_participants if p.payment_status == "Pendente")
    exempt_count = sum(1 for p in all_participants if p.payment_status == "Isento")
    total_collected = sum(p.paid_value for p in all_participants)
    total_expected = sum(p.individual_cost for p in all_participants if p.payment_status != "Isento")

    # Logística (somente confirmados)
    bus_sim = sum(1 for p in confirmed if p.bus_option == "Sim")
    bus_colo = sum(1 for p in confirmed if p.bus_option == "Colo")
    bus_occupied = bus_sim + bus_colo
    bed_sim = sum(1 for p in confirmed if p.bed_option == "Sim")
    bed_divide = sum(1 for p in confirmed if p.bed_option == "Divide")
    bed_occupied = bed_sim + bed_divide

    logistics = LogisticsDashboard(
        bus_capacity=retreat.bus_capacity,
        bus_occupied=bus_occupied,
        bus_available=max(0, (retreat.bus_capacity or 0) - bus_occupied) if retreat.bus_capacity else 0,
        bus_sim_count=bus_sim,
        bus_colo_count=bus_colo,
        bed_capacity=retreat.bed_capacity,
        bed_occupied=bed_occupied,
        bed_available=max(0, (retreat.bed_capacity or 0) - bed_occupied) if retreat.bed_capacity else 0,
        bed_sim_count=bed_sim,
        bed_divide_count=bed_divide,
        waiting_count=waiting_count,
    )

    return RetreatDashboard(
        retreat=RetreatResponse.model_validate(retreat),
        total_participants=total_participants,
        confirmed_count=confirmed_count,
        waiting_count=waiting_count,
        adults_count=adults_count,
        children_count=children_count,
        members_count=members_count,
        non_members_count=non_members_count,
        paid_count=paid_count,
        partial_count=partial_count,
        pending_count=pending_count,
        exempt_count=exempt_count,
        total_collected=total_collected,
        total_expected=total_expected,
        total_budget=retreat.total_budget,
        balance=total_collected - retreat.total_budget,
        logistics=logistics,
    )


# ============ PARTICIPANTES ============

@router.get("/{retreat_id}/participants", response_model=list[ParticipantResponse])
async def list_participants(
    retreat_id: int,
    payment_status: Optional[str] = Query(None),
    participant_type: Optional[str] = Query(None),
    inscription_status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = select(RetreatParticipant).where(RetreatParticipant.retreat_id == retreat_id)
    if payment_status:
        query = query.where(RetreatParticipant.payment_status == payment_status)
    if participant_type:
        query = query.where(RetreatParticipant.participant_type == participant_type)
    if inscription_status:
        query = query.where(RetreatParticipant.inscription_status == inscription_status)
    query = query.order_by(RetreatParticipant.registered_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{retreat_id}/participants", response_model=ParticipantResponse)
async def add_participant(
    retreat_id: int,
    data: ParticipantCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "pastor", "secretaria"))
):
    # Buscar o retiro para definir custo padrão
    result = await db.execute(select(Retreat).where(Retreat.id == retreat_id))
    retreat = result.scalar_one_or_none()
    if not retreat:
        raise HTTPException(status_code=404, detail="Retiro não encontrado")

    # Verificar duplicidade se for membro
    if data.member_id:
        existing = await db.execute(
            select(RetreatParticipant).where(
                RetreatParticipant.retreat_id == retreat_id,
                RetreatParticipant.member_id == data.member_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Membro já inscrito neste retiro")

    # Definir custo individual se não informado
    cost = data.individual_cost
    if cost is None:
        cost = retreat.cost_adult if data.participant_type == "adulto" else retreat.cost_child

    # Determinar status de inscrição (Confirmado ou Espera)
    inscription_status = await _determine_inscription_status(
        db, retreat, data.bus_option, data.bed_option
    )

    participant = RetreatParticipant(
        retreat_id=retreat_id,
        member_id=data.member_id,
        name=data.name,
        phone=data.phone,
        is_member=data.is_member,
        participant_type=data.participant_type,
        individual_cost=cost,
        payment_status=data.payment_status,
        installments_count=data.installments_count,
        bus_option=data.bus_option,
        bed_option=data.bed_option,
        inscription_status=inscription_status,
        notes=data.notes,
    )
    db.add(participant)
    await db.flush()
    await db.refresh(participant)

    # Gerar parcelas do carnê automaticamente
    if data.payment_status != "Isento" and data.installments_count > 0 and cost > 0:
        installment_value = round(cost / data.installments_count, 2)
        for i in range(1, data.installments_count + 1):
            payment = RetreatPayment(
                participant_id=participant.id,
                retreat_id=retreat_id,
                installment_number=i,
                value=installment_value,
                status="Pendente",
            )
            db.add(payment)
        await db.flush()

    return participant


@router.put("/participants/{participant_id}", response_model=ParticipantResponse)
async def update_participant(
    participant_id: int,
    data: ParticipantUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "pastor", "secretaria", "financeiro"))
):
    result = await db.execute(select(RetreatParticipant).where(RetreatParticipant.id == participant_id))
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=404, detail="Participante não encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(participant, field, value)
    await db.flush()
    await db.refresh(participant)
    return participant


@router.delete("/participants/{participant_id}")
async def remove_participant(
    participant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "pastor"))
):
    result = await db.execute(select(RetreatParticipant).where(RetreatParticipant.id == participant_id))
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=404, detail="Participante não encontrado")

    retreat_id = participant.retreat_id

    # Remover pagamentos associados (flush antes de deletar participante por FK)
    payments = await db.execute(
        select(RetreatPayment).where(RetreatPayment.participant_id == participant_id)
    )
    for p in payments.scalars().all():
        await db.delete(p)
    await db.flush()

    await db.delete(participant)
    await db.flush()

    # Tentar promover da lista de espera (vaga liberada)
    await _promote_from_waitlist(db, retreat_id)

    return {"detail": "Participante removido"}


# ============ PAGAMENTOS (CARNÊ) ============

@router.get("/participants/{participant_id}/payments", response_model=list[PaymentResponse])
async def list_payments(
    participant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = await db.execute(
        select(RetreatPayment)
        .where(RetreatPayment.participant_id == participant_id)
        .order_by(RetreatPayment.installment_number)
    )
    return result.scalars().all()


@router.post("/payments/{payment_id}/pay", response_model=PaymentResponse)
async def register_payment(
    payment_id: int,
    data: PaymentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles("super_admin", "pastor", "secretaria", "financeiro"))
):
    """Registra pagamento de uma parcela e cria transação no financeiro."""
    result = await db.execute(select(RetreatPayment).where(RetreatPayment.id == payment_id))
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Parcela não encontrada")

    if payment.status == "Pago":
        raise HTTPException(status_code=400, detail="Parcela já está paga")

    # Buscar participante e retiro
    part_result = await db.execute(
        select(RetreatParticipant).where(RetreatParticipant.id == payment.participant_id)
    )
    participant = part_result.scalar_one()

    retreat_result = await db.execute(
        select(Retreat).where(Retreat.id == payment.retreat_id)
    )
    retreat = retreat_result.scalar_one()

    # Atualizar parcela
    payment.status = "Pago"
    payment.paid_date = data.paid_date or date.today()
    payment.payment_method = data.payment_method

    # Criar transação no financeiro (integração)
    if retreat.project_id:
        participant_name = participant.name or f"Membro #{participant.member_id}"
        transaction = Transaction(
            date=payment.paid_date,
            type="Entrada",
            value=payment.value,
            description=f"Retiro {retreat.name} - {participant_name} - Parcela {payment.installment_number}",
            payment_method=payment.payment_method,
            project_id=retreat.project_id,
            member_id=participant.member_id,
            status="Conciliado",
            imported_from="retiro",
            created_by=current_user.id,
        )
        db.add(transaction)
        await db.flush()
        payment.transaction_id = transaction.id

    # Atualizar valor pago do participante
    participant.paid_value += payment.value

    # Atualizar status do participante
    all_payments = await db.execute(
        select(RetreatPayment).where(RetreatPayment.participant_id == participant.id)
    )
    all_pays = all_payments.scalars().all()
    all_paid = all(p.status == "Pago" for p in all_pays)
    any_paid = any(p.status == "Pago" for p in all_pays)

    if all_paid:
        participant.payment_status = "Pago"
    elif any_paid:
        participant.payment_status = "Parcial"

    await db.flush()
    await db.refresh(payment)
    return payment


@router.get("/{retreat_id}/payments", response_model=list[PaymentResponse])
async def list_all_retreat_payments(
    retreat_id: int,
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Lista todos os pagamentos de um retiro."""
    query = select(RetreatPayment).where(RetreatPayment.retreat_id == retreat_id)
    if status:
        query = query.where(RetreatPayment.status == status)
    query = query.order_by(RetreatPayment.participant_id, RetreatPayment.installment_number)
    result = await db.execute(query)
    return result.scalars().all()
