from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, func
from ...core.database import Base


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    ficha_num = Column(Integer, unique=True, nullable=True, index=True)

    # Dados pessoais
    name = Column(String(200), nullable=False)
    data_nascimento = Column(Date, nullable=True)
    naturalidade = Column(String(100), nullable=True)
    estado_civil = Column(String(30), nullable=True)
    nome_conjuge = Column(String(200), nullable=True)
    data_casamento = Column(Date, nullable=True)
    uniao_estavel = Column(Boolean, default=False)

    # Documentos
    identidade = Column(String(20), nullable=True)
    cpf = Column(String(14), unique=True, nullable=True, index=True)

    # Filiação
    filiacao_pai = Column(String(200), nullable=True)
    filiacao_mae = Column(String(200), nullable=True)

    # Formação
    escolaridade = Column(String(100), nullable=True)
    profissao = Column(String(100), nullable=True)

    # Endereço
    endereco = Column(String(300), nullable=True)
    bairro = Column(String(100), nullable=True)
    cidade = Column(String(100), nullable=True)
    cep = Column(String(10), nullable=True)

    # Contato
    tel = Column(String(20), nullable=True)
    cel = Column(String(20), nullable=True)
    email = Column(String(200), nullable=True)

    # Dados eclesiásticos
    veio_transferido_de = Column(String(200), nullable=True)
    batizado_aguas = Column(Boolean, default=False)
    batismo_espirito_santo = Column(Boolean, default=False)
    veio_de_outra_igreja = Column(String(200), nullable=True)
    deseja_ministerio = Column(Boolean, default=False)
    qual_ministerio = Column(String(200), nullable=True)
    data_membresia = Column(Date, nullable=True)

    # Foto e observações
    foto_perfil = Column(String(500), nullable=True)
    observacoes = Column(String(1000), nullable=True)

    # Controle
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
