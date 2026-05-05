# IERS — Sistema Integrado de Gestão

Sistema multi-módulo para gestão de igrejas, com backend em **Python (FastAPI)** e frontend em **React + TypeScript + Tailwind CSS**.

## Módulos

| Módulo | Descrição |
|--------|-----------|
| **Financeiro** | Dashboard, transações (entrada/saída), projetos, categorias, importação OFX/CSV, auditoria |
| **Secretaria (Membros)** | Cadastro completo de membros (30+ campos), ficha numerada, busca por nome/CPF/celular |
| **Retiros** | Gestão completa de retiros: inscrições (membros e visitantes), carnê de pagamentos parcelados, isenções, integração financeira automática e dashboard por evento |
| **Feedback** | Sistema de sugestões, erros e melhorias com resposta administrativa |
| **Gestão de Usuários** | CRUD completo de usuários, grupos de acesso, matriz de permissões granulares por módulo (visualizar/criar/editar/excluir), redefinição de senha, ativação/desativação |
| **Autenticação** | Login JWT com controle de acesso por perfil e permissões customizáveis por usuário |

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Backend | FastAPI, SQLAlchemy 2 (async), Pydantic v2, python-jose (JWT), bcrypt |
| Frontend | Vite 5, React 18, TypeScript, Tailwind CSS, TanStack Query, Zustand, React Router v6 |
| Banco (dev) | SQLite via aiosqlite |
| Banco (prod) | PostgreSQL via asyncpg (Neon free tier) |
| Testes E2E | Playwright |
| Deploy | Render.com (backend), Vercel (frontend) |

---

## Estrutura do Projeto

```
Controle_Financeiro-IERS/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py          # Configurações (pydantic-settings)
│   │   │   ├── database.py        # Engine async SQLAlchemy
│   │   │   └── security.py        # JWT, bcrypt, RBAC
│   │   ├── modules/
│   │   │   ├── auth/              # Autenticação, usuários e permissões
│   │   │   │   ├── models.py      # User (com campo permissions JSON)
│   │   │   │   ├── schemas.py     # CRUD schemas + DEFAULT_PERMISSIONS + AVAILABLE_MODULES
│   │   │   │   └── routes.py      # Login, register, CRUD users, reset password, delete, permissions defaults
│   │   │   ├── financial/         # Categorias, projetos, transações, auditoria
│   │   │   │   ├── models.py
│   │   │   │   ├── schemas.py
│   │   │   │   └── routes.py
│   │   │   ├── members/           # Cadastro completo de membros
│   │   │   │   ├── models.py
│   │   │   │   ├── schemas.py
│   │   │   │   └── routes.py
│   │   │   ├── retreat/           # Retiros, inscrições e pagamentos
│   │   │   │   ├── models.py      # Retreat, RetreatParticipant, RetreatPayment
│   │   │   │   ├── schemas.py     # CRUD + Dashboard + Carnê
│   │   │   │   └── routes.py      # CRUD retiros, inscrições, pagamentos, dashboard
│   │   │   └── feedback/          # Sugestões e reportes
│   │   │       ├── models.py
│   │   │       ├── schemas.py
│   │   │       └── routes.py
│   │   └── main.py                # App factory FastAPI
│   ├── seed.py                    # Seed inicial (admin + categorias)
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env                       # Variáveis locais (não commitar)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Rotas protegidas
│   │   ├── main.tsx               # Entry point
│   │   ├── layouts/
│   │   │   └── MainLayout.tsx     # Sidebar responsiva + navegação por papel
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Financial.tsx
│   │   │   ├── Feedback.tsx
│   │   │   ├── members/           # Sub-rotas de membros
│   │   │   │   ├── index.tsx
│   │   │   │   ├── MembersList.tsx
│   │   │   │   ├── MemberForm.tsx
│   │   │   │   └── MemberDetail.tsx
│   │   │   ├── retreats/          # Sub-rotas de retiros
│   │   │   │   ├── index.tsx
│   │   │   │   ├── RetreatsList.tsx
│   │   │   │   ├── RetreatForm.tsx
│   │   │   │   ├── RetreatDetail.tsx     # Dashboard do retiro
│   │   │   │   ├── RetreatParticipants.tsx
│   │   │   │   └── ParticipantPayments.tsx  # Carnê de pagamento
│   │   │   └── users/             # Gestão de usuários e permissões
│   │   │       ├── index.tsx
│   │   │       ├── UsersList.tsx   # Lista, busca, ativar/desativar, excluir, resetar senha
│   │   │       └── UserForm.tsx    # Criar/editar com matriz de permissões por módulo
│   │   ├── stores/
│   │   │   └── auth.ts            # Zustand (estado de autenticação)
│   │   └── lib/
│   │       ├── api.ts             # Axios + interceptor JWT
│   │       └── utils.ts           # cn() helper (clsx + tailwind-merge)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── vercel.json                # Config de deploy Vercel
├── e2e/                           # Testes E2E (Playwright)
│   ├── playwright.config.ts
│   └── tests/
│       ├── api/                   # Testes de API
│       │   ├── auth.spec.ts
│       │   ├── members.spec.ts
│       │   ├── retreats.spec.ts
│       │   └── modules.spec.ts
│       └── ui/                    # Testes de interface
│           ├── login.spec.ts
│           ├── members.spec.ts
│           └── retreats.spec.ts
├── render.yaml                    # Config de deploy Render
├── .gitignore
└── README.md
```

---

## Execução Local (Passo a Passo)

### Pré-requisitos

- **Python 3.11+** (testado com 3.14)
- **Node.js 18+** (com npm)
- **Git**

---

### 1. Clonar o repositório

```bash
git clone <url-do-repositorio>
cd Controle_Financeiro-IERS
```

---

### 2. Backend

#### 2.1. Criar e ativar o ambiente virtual

```bash
python -m venv .venv

# Windows (PowerShell):
.venv\Scripts\Activate.ps1

# Windows (CMD):
.venv\Scripts\activate.bat

# Linux/Mac:
source .venv/bin/activate
```

#### 2.2. Instalar dependências

```bash
pip install -r backend/requirements.txt
pip install aiosqlite email-validator
```

#### 2.3. Configurar variáveis de ambiente

Crie o arquivo `backend/.env` (ou copie do `.env.example`):

```env
APP_NAME=IERS Sistema Integrado
APP_VERSION=2.0.0
DEBUG=True

DATABASE_URL=sqlite+aiosqlite:///./iers_local.db

SECRET_KEY=uma-chave-secreta-qualquer
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

#### 2.4. Executar o seed (primeira vez)

Cria o usuário administrador, projeto padrão e categorias iniciais:

```bash
cd backend
python seed.py
```

Saída esperada:
```
Seed concluído com sucesso!
Admin: admin@iers.org / admin123
Projeto padrão: Geral/Dízimos
Categorias: 10 criadas
```

#### 2.5. Iniciar o servidor

```bash
# Dentro da pasta backend/:
uvicorn app.main:app --reload --port 8000

# OU de qualquer pasta usando --app-dir:
uvicorn app.main:app --reload --port 8000 --app-dir backend
```

A API estará disponível em **http://localhost:8000**

Documentação interativa (Swagger): **http://localhost:8000/docs**

---

### 3. Frontend

#### 3.1. Instalar dependências

```bash
cd frontend
npm install
```

#### 3.2. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

A interface estará disponível em **http://localhost:5173**

---

### 4. Acessar o sistema

1. Abra **http://localhost:5173** no navegador
2. Faça login com as credenciais padrão:
   - **Email:** `admin@iers.org`
   - **Senha:** `admin123`

---

## Gestão de Usuários e Permissões

O sistema possui controle granular de acesso configurável pela interface (acessível apenas para `super_admin`).

### Grupos de Acesso (Papéis Base)

| Grupo | Permissões Padrão |
|-------|-------------------|
| `super_admin` | Acesso total a todos os módulos (CRUD) + gestão de usuários |
| `pastor` | Visualização geral + lançamentos financeiros (criar) |
| `financeiro` | Módulo Financeiro completo (CRUD) + visualização dos demais |
| `secretaria` | Membros e Retiros (CRUD) + visualização do Dashboard |
| `viewer` | Somente visualização em todos os módulos |

### Permissões Granulares por Módulo

Cada módulo suporta as seguintes ações:

| Módulo | Ações Disponíveis |
|--------|-------------------|
| Dashboard | `view` |
| Financeiro | `view`, `create`, `edit`, `delete` |
| Membros | `view`, `create`, `edit`, `delete` |
| Retiros | `view`, `create`, `edit`, `delete` |
| Feedback | `view`, `create`, `edit`, `delete` |
| Usuários | `view`, `create`, `edit`, `delete` |

### Personalização

É possível **personalizar individualmente** as permissões de qualquer usuário, sobrescrevendo o padrão do grupo. A interface oferece uma matriz visual interativa (módulo × ação) para configurar cada permissão.

### Funcionalidades da Página de Usuários

- Criar novos usuários com senha
- Editar dados e permissões
- Ativar/desativar usuários
- Redefinir senha
- Excluir usuários
- Busca por nome, email ou papel

---

## Módulo de Retiros — Funcionalidades

- **CRUD de retiros** com nome, local, datas, custo adulto/criança, orçamento total, vagas
- **Inscrição de participantes**: membros da igreja (busca integrada) ou visitantes (dados manuais)
- **Tipos de participante**: adulto ou criança (custo diferenciado)
- **Carnê de pagamentos**: geração automática de parcelas com vencimento mensal
- **Isenção**: possibilidade de isentar participante do pagamento
- **Custo personalizado**: valor individual diferente do padrão do retiro
- **Integração financeira**: ao registrar pagamento, uma transação de Entrada é criada automaticamente no módulo Financeiro (projeto vinculado ao retiro)
- **Dashboard por retiro**: KPIs (total inscritos, valor arrecadado vs esperado, orçamento vs despesas), grade de status de pagamento e composição (adultos/crianças/isentos)

---

## Endpoints da API

### Autenticação e Usuários

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login (retorna JWT + dados do usuário com permissões) |
| POST | `/api/auth/register` | Criar usuário (super_admin) |
| GET | `/api/auth/me` | Dados do usuário autenticado |
| GET | `/api/auth/users` | Listar todos os usuários (super_admin, pastor) |
| GET | `/api/auth/users/{id}` | Buscar usuário por ID (super_admin) |
| PUT | `/api/auth/users/{id}` | Atualizar dados/permissões (super_admin) |
| PUT | `/api/auth/users/{id}/password` | Redefinir senha (super_admin) |
| DELETE | `/api/auth/users/{id}` | Excluir usuário (super_admin) |
| GET | `/api/auth/permissions/defaults` | Permissões padrão e módulos disponíveis (super_admin) |

### Financeiro

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/financial/categories` | Listar categorias |
| POST | `/api/financial/categories` | Criar categoria |
| GET | `/api/financial/projects` | Listar projetos |
| POST | `/api/financial/projects` | Criar projeto |
| GET | `/api/financial/transactions` | Listar transações (filtros: data, tipo, projeto) |
| POST | `/api/financial/transactions` | Criar transação |
| GET | `/api/financial/dashboard` | Dashboard financeiro (totais, gráficos) |

### Membros

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/members/` | Listar membros (busca, filtro ativo/inativo) |
| POST | `/api/members/` | Criar membro |
| GET | `/api/members/{id}` | Detalhe do membro |
| PUT | `/api/members/{id}` | Atualizar membro |
| GET | `/api/members/summary` | Lista resumida (para selects/autocompletar) |

### Retiros

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/retreats/` | Listar retiros |
| POST | `/api/retreats/` | Criar retiro (auto-cria projeto financeiro vinculado) |
| GET | `/api/retreats/{id}` | Detalhe do retiro |
| PUT | `/api/retreats/{id}` | Atualizar retiro |
| DELETE | `/api/retreats/{id}` | Excluir retiro |
| GET | `/api/retreats/{id}/dashboard` | Dashboard com KPIs e métricas |
| GET | `/api/retreats/{id}/participants` | Listar participantes |
| POST | `/api/retreats/{id}/participants` | Inscrever participante (membro ou visitante) |
| DELETE | `/api/retreats/{id}/participants/{pid}` | Remover participante |
| GET | `/api/retreats/{id}/participants/{pid}/payments` | Listar parcelas do carnê |
| PUT | `/api/retreats/payments/{payment_id}` | Registrar pagamento (cria transação financeira) |

### Feedback

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/feedback/` | Listar feedbacks |
| POST | `/api/feedback/` | Criar feedback |
| PUT | `/api/feedback/{id}` | Responder/atualizar feedback |

### Geral

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check |

---

## Testes E2E

Os testes end-to-end utilizam **Playwright** e cobrem tanto a API quanto a interface.

```bash
cd e2e
npm install
npx playwright test
```

Para rodar apenas testes de API ou UI:
```bash
npx playwright test tests/api/
npx playwright test tests/ui/
```

---

## Deploy em Produção

| Serviço | Plataforma | Tier |
|---------|-----------|------|
| Backend | Render.com | Free (Web Service) |
| Frontend | Vercel | Free (Hobby) |
| Banco de Dados | Neon | Free (0.5 GB) |

Configurações de deploy já estão em `render.yaml` e `frontend/vercel.json`.

---

## Dúvidas e Suporte

Para dúvidas, sugestões ou problemas, utilize o módulo de **Feedback** dentro do sistema ou entre em contato com o desenvolvedor responsável.
# IERS â€” Sistema Integrado de GestÃ£o

Sistema multi-mÃ³dulo para gestÃ£o de igrejas, com backend em **Python (FastAPI)** e frontend em **React + TypeScript + Tailwind CSS**.

## MÃ³dulos

| MÃ³dulo | DescriÃ§Ã£o |
|--------|-----------|
| **Financeiro** | Dashboard, transaÃ§Ãµes (entrada/saÃ­da), projetos, categorias, importaÃ§Ã£o OFX/CSV, auditoria |
| **Secretaria (Membros)** | Cadastro completo de membros (30+ campos), ficha numerada, busca por nome/CPF/celular |
| **Retiros** | GestÃ£o de retiros com inscriÃ§Ãµes, pagamentos, isenÃ§Ãµes e dashboard por evento |
| **Feedback** | Sistema de sugestÃµes, erros e melhorias com resposta administrativa |
| **AutenticaÃ§Ã£o** | Login JWT com controle de acesso por perfil (super_admin, pastor, financeiro, secretaria, viewer) |

---

## Stack TecnolÃ³gica

| Camada | Tecnologia |
|--------|-----------|
| Backend | FastAPI, SQLAlchemy 2 (async), Pydantic v2, python-jose (JWT), bcrypt |
| Frontend | Vite 5, React 18, TypeScript, Tailwind CSS, TanStack Query, Zustand, React Router v6 |
| Banco (dev) | SQLite via aiosqlite |
| Banco (prod) | PostgreSQL via asyncpg (Neon free tier) |
| Deploy | Render.com (backend), Vercel (frontend) |

---

## Estrutura do Projeto

```
Controle_Financeiro-IERS/
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”œâ”€â”€ core/
â”‚   â”‚   â”‚   â”œâ”€â”€ config.py          # ConfiguraÃ§Ãµes (pydantic-settings)
â”‚   â”‚   â”‚   â”œâ”€â”€ database.py        # Engine async SQLAlchemy
â”‚   â”‚   â”‚   â””â”€â”€ security.py        # JWT, bcrypt, RBAC
â”‚   â”‚   â”œâ”€â”€ modules/
â”‚   â”‚   â”‚   â”œâ”€â”€ auth/              # AutenticaÃ§Ã£o e usuÃ¡rios
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ models.py
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ schemas.py
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ routes.py
â”‚   â”‚   â”‚   â”œâ”€â”€ financial/         # Categorias, projetos, transaÃ§Ãµes, auditoria
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ models.py
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ schemas.py
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ routes.py
â”‚   â”‚   â”‚   â”œâ”€â”€ members/           # Cadastro completo de membros
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ models.py
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ schemas.py
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ routes.py
â”‚   â”‚   â”‚   â”œâ”€â”€ retreat/           # Retiros e inscriÃ§Ãµes
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ models.py
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ schemas.py
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ routes.py
â”‚   â”‚   â”‚   â””â”€â”€ feedback/          # SugestÃµes e reportes
â”‚   â”‚   â”‚       â”œâ”€â”€ models.py
â”‚   â”‚   â”‚       â”œâ”€â”€ schemas.py
â”‚   â”‚   â”‚       â””â”€â”€ routes.py
â”‚   â”‚   â””â”€â”€ main.py                # App factory FastAPI
â”‚   â”œâ”€â”€ seed.py                    # Seed inicial (admin + categorias)
â”‚   â”œâ”€â”€ requirements.txt
â”‚   â”œâ”€â”€ Dockerfile
â”‚   â”œâ”€â”€ .env                       # VariÃ¡veis locais (nÃ£o commitar)
â”‚   â””â”€â”€ .env.example
â”œâ”€â”€ frontend/
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ App.tsx                # Rotas protegidas
â”‚   â”‚   â”œâ”€â”€ main.tsx               # Entry point
â”‚   â”‚   â”œâ”€â”€ layouts/
â”‚   â”‚   â”‚   â””â”€â”€ MainLayout.tsx     # Sidebar responsiva + navegaÃ§Ã£o
â”‚   â”‚   â”œâ”€â”€ pages/
â”‚   â”‚   â”‚   â”œâ”€â”€ Login.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ Dashboard.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ Financial.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ Feedback.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ Retreats.tsx
â”‚   â”‚   â”‚   â””â”€â”€ members/           # Sub-rotas de membros
â”‚   â”‚   â”‚       â”œâ”€â”€ index.tsx
â”‚   â”‚   â”‚       â”œâ”€â”€ MembersList.tsx
â”‚   â”‚   â”‚       â”œâ”€â”€ MemberForm.tsx
â”‚   â”‚   â”‚       â””â”€â”€ MemberDetail.tsx
â”‚   â”‚   â”œâ”€â”€ stores/
â”‚   â”‚   â”‚   â””â”€â”€ auth.ts            # Zustand (estado de autenticaÃ§Ã£o)
â”‚   â”‚   â””â”€â”€ lib/
â”‚   â”‚       â””â”€â”€ api.ts             # Axios + interceptor JWT
â”‚   â”œâ”€â”€ package.json
â”‚   â”œâ”€â”€ vite.config.ts
â”‚   â”œâ”€â”€ tailwind.config.ts
â”‚   â”œâ”€â”€ tsconfig.json
â”‚   â””â”€â”€ vercel.json                # Config de deploy Vercel
â”œâ”€â”€ render.yaml                    # Config de deploy Render
â”œâ”€â”€ .gitignore
â””â”€â”€ README.md
```

---

## ExecuÃ§Ã£o Local (Passo a Passo)

### PrÃ©-requisitos

- **Python 3.11+** (testado com 3.14)
- **Node.js 18+** (com npm)
- **Git**

---

### 1. Clonar o repositÃ³rio

```bash
git clone <url-do-repositorio>
cd Controle_Financeiro-IERS
```

---

### 2. Backend

#### 2.1. Criar e ativar o ambiente virtual

```bash
python -m venv .venv

# Windows (PowerShell):
.venv\Scripts\Activate.ps1

# Windows (CMD):
.venv\Scripts\activate.bat

# Linux/Mac:
source .venv/bin/activate
```

#### 2.2. Instalar dependÃªncias

```bash
pip install -r backend/requirements.txt
pip install aiosqlite email-validator
```

#### 2.3. Configurar variÃ¡veis de ambiente

Crie o arquivo `backend/.env` (ou copie do `.env.example`):

```env
APP_NAME=IERS Sistema Integrado
APP_VERSION=2.0.0
DEBUG=True

DATABASE_URL=sqlite+aiosqlite:///./iers_local.db

SECRET_KEY=uma-chave-secreta-qualquer
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

#### 2.4. Executar o seed (primeira vez)

Cria o usuÃ¡rio administrador, projeto padrÃ£o e categorias iniciais:

```bash
cd backend
python seed.py
```

SaÃ­da esperada:
```
Seed concluÃ­do com sucesso!
Admin: admin@iers.org / admin123
Projeto padrÃ£o: Geral/DÃ­zimos
Categorias: 10 criadas
```

#### 2.5. Iniciar o servidor

```bash
# Dentro da pasta backend/:
uvicorn app.main:app --reload --port 8000

# OU de qualquer pasta usando --app-dir:
uvicorn app.main:app --reload --port 8000 --app-dir backend
```

A API estarÃ¡ disponÃ­vel em **http://localhost:8000**

DocumentaÃ§Ã£o interativa (Swagger): **http://localhost:8000/docs**

---

### 3. Frontend

#### 3.1. Instalar dependÃªncias

```bash
cd frontend
npm install
```

#### 3.2. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

A interface estarÃ¡ disponÃ­vel em **http://localhost:5173**

---

### 4. Acessar o sistema

1. Abra **http://localhost:5173** no navegador
2. FaÃ§a login com as credenciais padrÃ£o:
   - **Email:** `admin@iers.org`
   - **Senha:** `admin123`

---

## Perfis de Acesso

| Perfil | PermissÃµes |
|--------|-----------|
| `super_admin` | Acesso total, gerencia usuÃ¡rios, responde feedbacks |
| `pastor` | Acesso a todos os mÃ³dulos, somente leitura em configuraÃ§Ãµes |
| `financeiro` | MÃ³dulo Financeiro completo |
| `secretaria` | MÃ³dulo Membros e Retiros |
| `viewer` | Somente visualizaÃ§Ã£o |

---

## Endpoints Principais da API

| MÃ©todo | Rota | DescriÃ§Ã£o |
|--------|------|-----------|
| POST | `/api/auth/login` | Login (retorna JWT) |
| POST | `/api/auth/register` | Registrar usuÃ¡rio (super_admin) |
| GET | `/api/auth/me` | Dados do usuÃ¡rio autenticado |
| GET | `/api/financial/categories` | Listar categorias |
| GET | `/api/financial/projects` | Listar projetos |
| GET/POST | `/api/financial/transactions` | TransaÃ§Ãµes |
| GET | `/api/financial/dashboard` | Dashboard financeiro |
| GET/POST | `/api/members/` | Membros |
| GET | `/api/members/summary` | Lista resumida (para selects) |
| GET/POST | `/api/retreat/` | Retiros |
| GET/POST | `/api/feedback/` | Feedbacks |
| GET | `/health` | Health check |

---

## Deploy em ProduÃ§Ã£o

| ServiÃ§o | Plataforma | Tier |
|---------|-----------|------|
| Backend | Render.com | Free (Web Service) |
| Frontend | Vercel | Free (Hobby) |
| Banco de Dados | Neon | Free (0.5 GB) |

ConfiguraÃ§Ãµes de deploy jÃ¡ estÃ£o em `render.yaml` e `frontend/vercel.json`.

---

## DÃºvidas e Suporte

Para dÃºvidas, sugestÃµes ou problemas, utilize o mÃ³dulo de **Feedback** dentro do sistema ou entre em contato com o desenvolvedor responsÃ¡vel.
