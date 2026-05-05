# ============================================================
# IERS - Guia de Plataformas de Deploy
# ============================================================
# Este arquivo documenta como trocar de plataforma facilmente.
# Estrutura modular: Backend, Frontend e DB são independentes.
# ============================================================

# ┌─────────────────────────────────────────────────────────────┐
# │  ARQUITETURA DE DEPLOY                                       │
# ├─────────────────────────────────────────────────────────────┤
# │                                                             │
# │   [Frontend SPA]  ──API──>  [Backend API]  ──SQL──>  [DB]   │
# │                                                             │
# │   Vercel/Cloudflare    Render/Railway/Fly    Neon/Supabase  │
# │                                                             │
# └─────────────────────────────────────────────────────────────┘

# ============================================================
# OPÇÕES DE BACKEND (Python/FastAPI)
# ============================================================
#
# ATUAL: Render.com (Free)
# ├── Config: render.yaml (Blueprint auto-deploy)
# ├── Limites: 750h/mês, sleep após 15min inatividade
# ├── Build: pip install -r requirements.txt
# └── Start: uvicorn app.main:app --host 0.0.0.0 --port $PORT
#
# ALTERNATIVA 1: Railway.app (Free - $5 crédito/mês)
# ├── Config: Procfile ou railway.json
# ├── Limites: 500h/mês, 1GB RAM
# ├── Root: backend/
# └── Start: uvicorn app.main:app --host 0.0.0.0 --port $PORT
#
# ALTERNATIVA 2: Fly.io (Free - 3 VMs compartilhadas)
# ├── Config: fly.toml + Dockerfile
# ├── Limites: 3 VMs, 256MB RAM cada
# ├── Deploy: fly deploy (usa Dockerfile)
# └── Secrets: fly secrets set KEY=value
#
# ALTERNATIVA 3: Koyeb (Free - 1 nano instância)
# ├── Config: via dashboard ou koyeb.yaml
# ├── Limites: 1 app, nano instance
# └── Deploy: conectar repo GitHub
#
# ============================================================
# OPÇÕES DE FRONTEND (React/Vite SPA)
# ============================================================
#
# ATUAL: Vercel (Hobby - gratuito)
# ├── Config: frontend/vercel.json
# ├── Limites: 100GB bandwidth, 6000 min build
# ├── Root: frontend/
# ├── Build: npm run build
# ├── Output: dist/
# └── Env: VITE_API_URL=https://backend-url.com
#
# ALTERNATIVA 1: Cloudflare Pages (Free)
# ├── Config: igual (Vite SPA)
# ├── Limites: ilimitado bandwidth
# ├── Build: npm run build
# └── Output: dist/
#
# ALTERNATIVA 2: Netlify (Free)
# ├── Config: netlify.toml ou dashboard
# ├── Limites: 100GB bandwidth
# ├── Redirect: [[redirects]] from="/*" to="/index.html" status=200
# └── Env: VITE_API_URL no dashboard
#
# ALTERNATIVA 3: GitHub Pages (Free)
# ├── Config: GitHub Actions + vite.config.ts base
# ├── Limites: 1GB, sem server-side
# └── Nota: Precisa configurar SPA redirect (404.html hack)
#
# ============================================================
# OPÇÕES DE BANCO DE DADOS (PostgreSQL)
# ============================================================
#
# ATUAL: Neon (Free)
# ├── Limites: 0.5GB storage, auto-suspend após 5min
# ├── Driver: postgresql+asyncpg://
# ├── SSL: sslmode=require
# └── Region: US East (aws)
#
# ALTERNATIVA 1: Supabase (Free)
# ├── Limites: 500MB, 2 projetos
# ├── Driver: postgresql+asyncpg://
# └── Nota: Tem pausa após 7 dias sem uso
#
# ALTERNATIVA 2: Render PostgreSQL (Free)
# ├── Limites: 1GB, expira em 90 dias
# ├── Driver: postgresql+asyncpg://
# └── Nota: Precisa recriar a cada 90 dias no free
#
# ALTERNATIVA 3: CockroachDB Serverless (Free)
# ├── Limites: 10GB storage, 50M RUs/mês
# ├── Driver: cockroachdb+asyncpg://
# └── Nota: Compatível com PostgreSQL
#
# ============================================================
# COMO TROCAR DE PLATAFORMA
# ============================================================
#
# 1. TROCAR BACKEND:
#    - Altere VITE_API_URL no frontend (Vercel env)
#    - Configure as mesmas variáveis de ambiente na nova plataforma
#    - Use: .\scripts\generate-env.ps1 -Platform <nova>
#
# 2. TROCAR FRONTEND:
#    - Altere ALLOWED_ORIGINS no backend
#    - Configure VITE_API_URL na nova plataforma
#    - Build é sempre: npm run build → dist/
#
# 3. TROCAR BANCO:
#    - Altere DATABASE_URL no backend
#    - Execute seed.py na primeira vez
#    - O SQLAlchemy cria as tabelas automaticamente
#
# ============================================================
# VARIÁVEIS DE AMBIENTE (referência completa)
# ============================================================
#
# BACKEND (.env):
#   DATABASE_URL          = postgresql+asyncpg://user:pass@host/db
#   SECRET_KEY            = <string aleatória 64+ chars>
#   ALGORITHM             = HS256
#   ACCESS_TOKEN_EXPIRE_MINUTES = 480
#   APP_NAME              = IERS Sistema Integrado
#   APP_VERSION           = 2.0.0
#   DEBUG                 = False
#   ALLOWED_ORIGINS       = https://frontend-url.com
#
# FRONTEND (.env / Vercel):
#   VITE_API_URL          = https://backend-url.com
#
# ============================================================
