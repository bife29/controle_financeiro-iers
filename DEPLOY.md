# 🚀 Guia de Deploy - IERS Sistema Integrado

## Arquitetura de Produção

```
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│   Frontend   │──API──▶│   Backend    │──SQL──▶│   Database   │
│   (Vercel)   │        │  (Render)    │        │    (Neon)    │
│   React/Vite │        │   FastAPI    │        │  PostgreSQL  │
└──────────────┘        └──────────────┘        └──────────────┘
```

---

## Pré-requisitos

- Conta GitHub (repo já configurado)
- Conta Neon (https://neon.tech)
- Conta Render (https://render.com)
- Conta Vercel (https://vercel.com)

---

## Passo 1: Banco de Dados (Neon)

1. Acesse https://console.neon.tech
2. Clique em **"New Project"**
3. Configure:
   - Nome: `iers-financeiro`
   - Region: **US East (aws-us-east-1)** ou mais próxima
   - Compute: Free (0.25 CU)
4. Copie a **Connection String** (formato: `postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`)
5. **Adapte para asyncpg**: troque `postgresql://` por `postgresql+asyncpg://`

> ⚠️ Guarde este valor. Será usado como `DATABASE_URL` no backend.

---

## Passo 2: Backend (Render)

### Opção A: Deploy automático via Blueprint

1. Acesse https://render.com
2. Vá em **Blueprints** → **New Blueprint Instance**
3. Conecte o repositório `bife29/controle_financeiro-iers`
4. O Render detectará o `render.yaml` automaticamente
5. Configure as variáveis:
   - `DATABASE_URL`: Cole a URL do Neon (com `+asyncpg`)
   - `ALLOWED_ORIGINS`: `https://controle-financeiro-iers.vercel.app`
   - `SECRET_KEY`: Será gerado automaticamente
6. Clique em **Apply**

### Opção B: Deploy manual

1. **New → Web Service**
2. Conecte o repositório GitHub
3. Configure:
   - Name: `iers-api`
   - Root Directory: `backend`
   - Runtime: Python 3
   - Build Command: `pip install -r requirements.txt && python seed.py`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Plan: **Free**
4. Adicione variáveis de ambiente:

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | `postgresql+asyncpg://...` (Neon) |
| `SECRET_KEY` | (gere com: `openssl rand -hex 32`) |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` |
| `APP_NAME` | `IERS Sistema Integrado` |
| `APP_VERSION` | `2.0.0` |
| `DEBUG` | `False` |
| `ALLOWED_ORIGINS` | `https://controle-financeiro-iers.vercel.app` |

5. Copie a URL gerada (ex: `https://iers-api.onrender.com`)

---

## Passo 3: Frontend (Vercel)

1. Acesse https://vercel.com
2. Clique em **"Add New Project"**
3. Importe o repositório `bife29/controle_financeiro-iers`
4. Configure:
   - Framework: **Vite**
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Adicione variável de ambiente:

| Variável | Valor |
|----------|-------|
| `VITE_API_URL` | `https://iers-api.onrender.com` (URL do Render) |

6. Clique em **Deploy**

---

## Passo 4: Validação

Após o deploy, verifique:

```bash
# Backend health check
curl https://iers-api.onrender.com/health
# Esperado: {"status":"ok","version":"2.0.0"}

# Frontend
# Acesse https://controle-financeiro-iers.vercel.app
# Login com: admin@iers.org / admin123
```

---

## Variáveis de Ambiente (Referência)

### Backend (.env)

```env
DATABASE_URL=postgresql+asyncpg://user:pass@host.neon.tech/db?sslmode=require
SECRET_KEY=sua-chave-secreta-64-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
APP_NAME=IERS Sistema Integrado
APP_VERSION=2.0.0
DEBUG=False
ALLOWED_ORIGINS=https://seu-frontend.vercel.app
```

### Frontend (Vercel Environment Variables)

```env
VITE_API_URL=https://seu-backend.onrender.com
```

---

## Alternativas de Plataforma

O projeto está preparado para outras plataformas gratuitas:

| Componente | Principal | Alternativas |
|-----------|-----------|--------------|
| Backend | Render | Railway, Fly.io, Koyeb |
| Frontend | Vercel | Cloudflare Pages, Netlify |
| Database | Neon | Supabase, CockroachDB |

### Trocar para Railway (Backend)
```bash
# Já tem Procfile configurado em backend/Procfile
# 1. Conecte o repo no Railway
# 2. Root dir: backend
# 3. Configure as mesmas env vars
```

### Trocar para Fly.io (Backend)
```bash
# Já tem fly.toml configurado em backend/fly.toml
cd backend
fly launch --copy-config
fly secrets set DATABASE_URL="..." SECRET_KEY="..." ALLOWED_ORIGINS="..."
fly deploy
```

### Trocar para Cloudflare Pages (Frontend)
```bash
# 1. Conecte o repo no Cloudflare Pages
# 2. Build command: npm run build
# 3. Build output: dist
# 4. Root: frontend
# 5. Env: VITE_API_URL=https://seu-backend-url.com
```

---

## Scripts de Automação

```powershell
# Gerar variáveis de ambiente para plataforma específica
.\scripts\generate-env.ps1 -Platform render -DatabaseUrl "postgresql+asyncpg://..." -BackendUrl "https://iers-api.onrender.com" -FrontendUrl "https://controle-financeiro-iers.vercel.app"

# Guia interativo de deploy
.\scripts\deploy-setup.ps1
```

---

## Troubleshooting

### Backend não inicia no Render
- Verifique se `DATABASE_URL` está com `postgresql+asyncpg://`
- Verifique os logs em Render Dashboard → Logs
- O free tier hiberna após 15min. A primeira request demora ~30s

### Frontend não conecta ao backend
- Verifique `VITE_API_URL` na Vercel (sem barra final!)
- Verifique `ALLOWED_ORIGINS` no Render (URL exata do frontend)
- Teste CORS: `curl -H "Origin: https://seu-frontend.vercel.app" https://seu-backend.onrender.com/health`

### Banco de dados não conecta
- Neon hiberna após 5min. A primeira query pode demorar ~2s
- Verifique se SSL está habilitado (`?sslmode=require`)
- Teste conexão: `psql "postgresql://user:pass@host/db?sslmode=require"`

---

## Limites do Free Tier

| Serviço | Limite | Impacto |
|---------|--------|---------|
| Render | 750h/mês, hiberna 15min | Primeira request lenta (~30s) |
| Vercel | 100GB bandwidth | Suficiente para uso interno |
| Neon | 0.5GB storage, hiberna 5min | Primeira query lenta (~2s) |
