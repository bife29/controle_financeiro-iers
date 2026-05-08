from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete as sql_delete, func, select, update
from sqlalchemy.orm.attributes import flag_modified
from ...core.database import get_db
from ...core.security import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_roles
)
from ..feedback.models import Feedback
from ..financial.models import AuditLog, Transaction
from .models import User
from .schemas import (
    UserCreate, UserUpdate, UserResponse, LoginRequest, TokenResponse,
    PasswordReset, DEFAULT_PERMISSIONS, AVAILABLE_MODULES
)

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])


@router.post("/register", response_model=UserResponse)
async def register(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("super_admin"))
):
    """Apenas super_admin pode criar novos usuários."""
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    permissions = data.permissions or DEFAULT_PERMISSIONS.get(data.role, {})

    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
        permissions=permissions,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuário desativado")

    token = create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("super_admin", "pastor"))
):
    result = await db.execute(select(User).order_by(User.name))
    return result.scalars().all()


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("super_admin"))
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("super_admin"))
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if data.name is not None:
        user.name = data.name
    if data.email is not None:
        user.email = data.email
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.permissions is not None:
        user.permissions = data.permissions
        flag_modified(user, "permissions")

    await db.flush()
    await db.refresh(user)
    return user


@router.put("/users/{user_id}/password")
async def reset_password(
    user_id: int,
    data: PasswordReset,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("super_admin"))
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Senha deve ter pelo menos 6 caracteres")

    user.hashed_password = hash_password(data.new_password)
    await db.flush()
    return {"detail": "Senha redefinida com sucesso"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    force: bool = Query(
        False,
        description=(
            "Se True, anonimiza referências (transações e auditoria ficam com "
            "autor NULL) e remove feedbacks do usuário antes de excluir."
        ),
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("super_admin"))
):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Não é possível excluir o próprio usuário")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Conta referências para decidir 409 ou prosseguir
    tx_count = (await db.execute(
        select(func.count()).select_from(Transaction).where(Transaction.created_by == user_id)
    )).scalar_one()
    audit_count = (await db.execute(
        select(func.count()).select_from(AuditLog).where(AuditLog.user_id == user_id)
    )).scalar_one()
    feedback_count = (await db.execute(
        select(func.count()).select_from(Feedback).where(Feedback.user_id == user_id)
    )).scalar_one()

    has_refs = (tx_count + audit_count + feedback_count) > 0

    if has_refs and not force:
        partes = []
        if tx_count:
            partes.append(f"{tx_count} transação(ões)")
        if audit_count:
            partes.append(f"{audit_count} registro(s) de auditoria")
        if feedback_count:
            partes.append(f"{feedback_count} feedback(s)")
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    "Usuário possui " + ", ".join(partes) + ". "
                    "Desative-o ou confirme a exclusão forçada."
                ),
                "references": {
                    "transactions": tx_count,
                    "audit_logs": audit_count,
                    "feedbacks": feedback_count,
                },
                "can_force": True,
            },
        )

    if force and has_refs:
        # Preserva movimentação financeira e auditoria, apenas remove autoria
        if tx_count:
            await db.execute(
                update(Transaction)
                .where(Transaction.created_by == user_id)
                .values(created_by=None)
            )
        if audit_count:
            await db.execute(
                update(AuditLog)
                .where(AuditLog.user_id == user_id)
                .values(user_id=None)
            )
        # Feedbacks têm FK NOT NULL — removidos junto (são pessoais ao usuário)
        if feedback_count:
            await db.execute(
                sql_delete(Feedback).where(Feedback.user_id == user_id)
            )

    await db.delete(user)
    await db.flush()
    return {
        "detail": "Usuário excluído com sucesso",
        "preserved": {
            "transactions": tx_count if force else 0,
            "audit_logs": audit_count if force else 0,
        },
        "removed": {
            "feedbacks": feedback_count if force else 0,
        },
    }


@router.get("/permissions/defaults")
async def get_default_permissions(
    current_user: User = Depends(require_roles("super_admin"))
):
    """Retorna permissões padrão por papel e módulos disponíveis."""
    return {
        "defaults": DEFAULT_PERMISSIONS,
        "modules": AVAILABLE_MODULES,
    }
