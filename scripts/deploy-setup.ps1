# ============================================================
# IERS - Script de Deploy para Produção
# ============================================================
# Plataformas: Render.com (backend) + Vercel (frontend) + Neon (DB)
# Todas planos gratuitos (free tier)
# ============================================================

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  IERS - Configuração de Produção" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Plataformas:"
Write-Host "  Backend:  Render.com (Free Web Service)" -ForegroundColor Green
Write-Host "  Frontend: Vercel (Hobby Plan)" -ForegroundColor Green
Write-Host "  Banco:    Neon PostgreSQL (Free Tier)" -ForegroundColor Green
Write-Host ""

# ============================================================
# PASSO 1: BANCO DE DADOS - Neon
# ============================================================
Write-Host "-----------------------------------------------------" -ForegroundColor Yellow
Write-Host "PASSO 1: BANCO DE DADOS (Neon PostgreSQL)" -ForegroundColor Yellow
Write-Host "-----------------------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Acesse: https://console.neon.tech" -ForegroundColor White
Write-Host "2. Crie uma conta (pode usar GitHub)" -ForegroundColor White
Write-Host "3. Crie um novo projeto:" -ForegroundColor White
Write-Host "   - Nome: iers-sistema" -ForegroundColor Gray
Write-Host "   - Region: US East (mais proximo do Render Oregon)" -ForegroundColor Gray
Write-Host "   - Database: iers_db" -ForegroundColor Gray
Write-Host "4. Copie a CONNECTION STRING (formato pooled):" -ForegroundColor White
Write-Host '   postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/iers_db?sslmode=require' -ForegroundColor DarkGray
Write-Host ""
Write-Host "IMPORTANTE: Troque 'postgresql://' por 'postgresql+asyncpg://' para uso com SQLAlchemy async" -ForegroundColor Red
Write-Host ""

$neonUrl = Read-Host "Cole a DATABASE_URL do Neon (ou Enter para pular)"
Write-Host ""

# ============================================================
# PASSO 2: BACKEND - Render.com
# ============================================================
Write-Host "-----------------------------------------------------" -ForegroundColor Yellow
Write-Host "PASSO 2: BACKEND (Render.com)" -ForegroundColor Yellow
Write-Host "-----------------------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Opcao A - Blueprint (Automatico):" -ForegroundColor Green
Write-Host "  1. Acesse: https://dashboard.render.com" -ForegroundColor White
Write-Host "  2. Clique 'New' > 'Blueprint'" -ForegroundColor White
Write-Host "  3. Conecte o repo: github.com/bife29/controle_financeiro-iers" -ForegroundColor White
Write-Host "  4. O render.yaml sera detectado automaticamente" -ForegroundColor White
Write-Host ""
Write-Host "Opcao B - Manual:" -ForegroundColor Green
Write-Host "  1. Acesse: https://dashboard.render.com" -ForegroundColor White
Write-Host "  2. 'New' > 'Web Service'" -ForegroundColor White
Write-Host "  3. Conecte o repo GitHub" -ForegroundColor White
Write-Host "  4. Configurações:" -ForegroundColor White
Write-Host "     - Name: iers-api" -ForegroundColor Gray
Write-Host "     - Region: Oregon" -ForegroundColor Gray
Write-Host "     - Runtime: Python 3" -ForegroundColor Gray
Write-Host "     - Root Directory: backend" -ForegroundColor Gray
Write-Host "     - Build Command: pip install -r requirements.txt && python seed.py" -ForegroundColor Gray
Write-Host "     - Start Command: uvicorn app.main:app --host 0.0.0.0 --port `$PORT" -ForegroundColor Gray
Write-Host "     - Plan: Free" -ForegroundColor Gray
Write-Host ""
Write-Host "  5. Environment Variables:" -ForegroundColor White
Write-Host "     DATABASE_URL = <sua URL do Neon com asyncpg>" -ForegroundColor Gray
Write-Host "     SECRET_KEY = <gerar string aleatoria 64+ chars>" -ForegroundColor Gray
Write-Host "     ALGORITHM = HS256" -ForegroundColor Gray
Write-Host "     ACCESS_TOKEN_EXPIRE_MINUTES = 480" -ForegroundColor Gray
Write-Host "     APP_NAME = IERS Sistema Integrado" -ForegroundColor Gray
Write-Host "     APP_VERSION = 2.0.0" -ForegroundColor Gray
Write-Host "     DEBUG = False" -ForegroundColor Gray
Write-Host "     ALLOWED_ORIGINS = https://controle-financeiro-iers.vercel.app" -ForegroundColor Gray
Write-Host ""

$renderUrl = Read-Host "Cole a URL do backend no Render (ex: https://iers-api.onrender.com) ou Enter para pular"
Write-Host ""

# ============================================================
# PASSO 3: FRONTEND - Vercel
# ============================================================
Write-Host "-----------------------------------------------------" -ForegroundColor Yellow
Write-Host "PASSO 3: FRONTEND (Vercel)" -ForegroundColor Yellow
Write-Host "-----------------------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Acesse: https://vercel.com" -ForegroundColor White
Write-Host "2. 'Add New' > 'Project'" -ForegroundColor White
Write-Host "3. Importe: github.com/bife29/controle_financeiro-iers" -ForegroundColor White
Write-Host "4. Configure:" -ForegroundColor White
Write-Host "   - Framework Preset: Vite" -ForegroundColor Gray
Write-Host "   - Root Directory: frontend" -ForegroundColor Gray
Write-Host "   - Build Command: npm run build" -ForegroundColor Gray
Write-Host "   - Output Directory: dist" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Environment Variables:" -ForegroundColor White
if ($renderUrl) {
    Write-Host "   VITE_API_URL = $renderUrl" -ForegroundColor Gray
} else {
    Write-Host "   VITE_API_URL = https://iers-api.onrender.com" -ForegroundColor Gray
}
Write-Host ""
Write-Host "NOTA: O vercel.json ja esta configurado com rewrites para SPA." -ForegroundColor DarkGray
Write-Host ""

# ============================================================
# PASSO 4: Testar
# ============================================================
Write-Host "-----------------------------------------------------" -ForegroundColor Yellow
Write-Host "PASSO 4: VALIDACAO" -ForegroundColor Yellow
Write-Host "-----------------------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Apos deploy, teste:" -ForegroundColor White
Write-Host "  1. Backend health: curl https://iers-api.onrender.com/health" -ForegroundColor Gray
Write-Host "  2. Frontend: abra https://controle-financeiro-iers.vercel.app" -ForegroundColor Gray
Write-Host "  3. Login: admin@iers.org / admin123" -ForegroundColor Gray
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Deploy configurado!" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
