# Backend - Controle Financeiro IERS

Este backend utiliza FastAPI, arquitetura CQS, DDD e Clean Code para prover uma API REST robusta para o sistema financeiro da igreja.

## Estrutura sugerida
- app/
  - domain/
  - application/
  - infrastructure/
  - api/
- tests/
- requirements.txt
- alembic/ (migrations)

## Funcionalidades
- Gestão de períodos, transações, contas, categorias, membros
- Importação OFX/CSV
- Exportação/Backup JSON
- Relatórios analíticos

## Para rodar
```bash
pip install -r requirements.txt
uvicorn app.api.main:app --reload
```
