from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date, datetime


class MemberCreate(BaseModel):
    ficha_num: Optional[int] = None
    name: str
    data_nascimento: Optional[date] = None
    naturalidade: Optional[str] = None
    estado_civil: Optional[str] = None
    nome_conjuge: Optional[str] = None
    data_casamento: Optional[date] = None
    uniao_estavel: Optional[bool] = False
    identidade: Optional[str] = None
    cpf: Optional[str] = None
    filiacao_pai: Optional[str] = None
    filiacao_mae: Optional[str] = None
    escolaridade: Optional[str] = None
    profissao: Optional[str] = None
    endereco: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    cep: Optional[str] = None
    tel: Optional[str] = None
    cel: Optional[str] = None
    email: Optional[str] = None
    veio_transferido_de: Optional[str] = None
    batizado_aguas: Optional[bool] = False
    batismo_espirito_santo: Optional[bool] = False
    veio_de_outra_igreja: Optional[str] = None
    deseja_ministerio: Optional[bool] = False
    qual_ministerio: Optional[str] = None
    data_membresia: Optional[date] = None
    foto_perfil: Optional[str] = None
    observacoes: Optional[str] = None


class MemberUpdate(BaseModel):
    ficha_num: Optional[int] = None
    name: Optional[str] = None
    data_nascimento: Optional[date] = None
    naturalidade: Optional[str] = None
    estado_civil: Optional[str] = None
    nome_conjuge: Optional[str] = None
    data_casamento: Optional[date] = None
    uniao_estavel: Optional[bool] = None
    identidade: Optional[str] = None
    cpf: Optional[str] = None
    filiacao_pai: Optional[str] = None
    filiacao_mae: Optional[str] = None
    escolaridade: Optional[str] = None
    profissao: Optional[str] = None
    endereco: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    cep: Optional[str] = None
    tel: Optional[str] = None
    cel: Optional[str] = None
    email: Optional[str] = None
    veio_transferido_de: Optional[str] = None
    batizado_aguas: Optional[bool] = None
    batismo_espirito_santo: Optional[bool] = None
    veio_de_outra_igreja: Optional[str] = None
    deseja_ministerio: Optional[bool] = None
    qual_ministerio: Optional[str] = None
    data_membresia: Optional[date] = None
    foto_perfil: Optional[str] = None
    observacoes: Optional[str] = None
    is_active: Optional[bool] = None


class MemberResponse(BaseModel):
    id: int
    ficha_num: Optional[int] = None
    name: str
    data_nascimento: Optional[date] = None
    naturalidade: Optional[str] = None
    estado_civil: Optional[str] = None
    nome_conjuge: Optional[str] = None
    data_casamento: Optional[date] = None
    uniao_estavel: Optional[bool] = None
    identidade: Optional[str] = None
    cpf: Optional[str] = None
    filiacao_pai: Optional[str] = None
    filiacao_mae: Optional[str] = None
    escolaridade: Optional[str] = None
    profissao: Optional[str] = None
    endereco: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    cep: Optional[str] = None
    tel: Optional[str] = None
    cel: Optional[str] = None
    email: Optional[str] = None
    veio_transferido_de: Optional[str] = None
    batizado_aguas: Optional[bool] = None
    batismo_espirito_santo: Optional[bool] = None
    veio_de_outra_igreja: Optional[str] = None
    deseja_ministerio: Optional[bool] = None
    qual_ministerio: Optional[str] = None
    data_membresia: Optional[date] = None
    foto_perfil: Optional[str] = None
    observacoes: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MemberSummary(BaseModel):
    """Versão resumida para listagens rápidas (Financeiro/Retiro)."""
    id: int
    ficha_num: Optional[int] = None
    name: str
    cel: Optional[str] = None
    email: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True
