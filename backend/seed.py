# Seed script para criar o super_admin inicial
import asyncio
from app.core.database import async_session, engine, Base
from app.core.security import hash_password
from app.modules.auth.models import User
from app.modules.members.models import Member  # noqa - register model
from app.modules.financial.models import Category, Project, Transaction, ParticipantEvent, AuditLog  # noqa
from app.modules.feedback.models import Feedback  # noqa
from app.modules.retreat.models import Retreat, RetreatParticipant  # noqa
from sqlalchemy import select


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # Criar super_admin se não existe
        result = await session.execute(select(User).where(User.email == "admin@iers.org"))
        if not result.scalar_one_or_none():
            admin = User(
                name="Administrador",
                email="admin@iers.org",
                hashed_password=hash_password("admin123"),
                role="super_admin",
            )
            session.add(admin)
            print("✅ Super Admin criado: admin@iers.org / admin123")
        else:
            print("ℹ️  Super Admin já existe")

        # Criar projeto padrão "Geral/Dízimos"
        result = await session.execute(select(Project).where(Project.name == "Geral/Dízimos"))
        if not result.scalar_one_or_none():
            from datetime import date
            project = Project(
                name="Geral/Dízimos",
                description="Projeto padrão para lançamentos gerais e dízimos",
                start_date=date(2025, 1, 1),
                status="Ativo",
            )
            session.add(project)
            print("✅ Projeto padrão 'Geral/Dízimos' criado")

        # Criar categorias iniciais
        categorias = [
            ("Dízimo", "Entrada", "Fixa"),
            ("Oferta", "Entrada", "Variável"),
            ("Doação", "Entrada", "Variável"),
            ("Inscrição Retiro", "Entrada", "Variável"),
            ("Aluguel", "Saída", "Fixa"),
            ("Energia Elétrica", "Saída", "Fixa"),
            ("Água", "Saída", "Fixa"),
            ("Material de Limpeza", "Saída", "Variável"),
            ("Manutenção", "Saída", "Variável"),
            ("Alimentação/Cantina", "Saída", "Variável"),
        ]
        for name, type_, nature in categorias:
            result = await session.execute(select(Category).where(Category.name == name))
            if not result.scalar_one_or_none():
                session.add(Category(name=name, type=type_, nature=nature))

        await session.commit()
        print("✅ Categorias iniciais criadas")


if __name__ == "__main__":
    asyncio.run(seed())
