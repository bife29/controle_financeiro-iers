from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .config import settings
from .database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    # JWT exige que 'sub' seja string
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    from ..modules.auth.models import User

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
        user_id = int(sub)
    except (JWTError, ValueError):
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuário desativado")
    return user


def _has_granular_permission(user, module: str, action: str) -> bool:
    """Verifica se o usuário tem a ação granular no módulo via JSON permissions."""
    perms = getattr(user, "permissions", None)
    if not perms or not isinstance(perms, dict):
        return False
    actions = perms.get(module) or []
    return action in actions


def require_roles(*allowed_roles: str):
    """Dependency que verifica se o usuário tem um dos papéis permitidos."""
    async def role_checker(current_user=Depends(get_current_user)):
        if current_user.role == "super_admin":
            return current_user
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acesso negado. Papéis permitidos: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker


def require_permission(module: str, action: str):
    """Dependency que verifica permissão granular (módulo + ação).

    Regras:
    - super_admin sempre autorizado.
    - Se o usuário tem `permissions` customizadas e contém a ação no módulo, autoriza.
    - Caso contrário, consulta DEFAULT_PERMISSIONS pelo papel; se o papel padrão tem
      a ação, autoriza (preserva comportamento histórico de usuários sem permissões
      customizadas explícitas).
    - Caso contrário, 403.
    """
    async def perm_checker(current_user=Depends(get_current_user)):
        if current_user.role == "super_admin":
            return current_user
        if _has_granular_permission(current_user, module, action):
            return current_user
        # Fallback para os defaults do papel (compat com usuários sem perms customizadas)
        from ..modules.auth.schemas import DEFAULT_PERMISSIONS
        defaults = DEFAULT_PERMISSIONS.get(current_user.role, {})
        if action in (defaults.get(module) or []):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Acesso negado. Necessário permissão '{action}' no módulo '{module}'."
        )
    return perm_checker
