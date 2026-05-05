# ============================================================
# IERS - Gerador de Variáveis de Ambiente para Produção
# ============================================================
# Uso: .\scripts\generate-env.ps1 -Platform render
#      .\scripts\generate-env.ps1 -Platform vercel
#      .\scripts\generate-env.ps1 -Platform railway
#      .\scripts\generate-env.ps1 -Platform fly
# ============================================================

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("render", "vercel", "neon", "railway", "fly", "all")]
    [string]$Platform,

    [string]$DatabaseUrl = "",
    [string]$BackendUrl = "",
    [string]$FrontendUrl = ""
)

function Generate-SecretKey {
    -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
}

$secretKey = Generate-SecretKey

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  IERS - Variáveis de Ambiente ($Platform)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

switch ($Platform) {
    "render" {
        Write-Host "# Render.com - Web Service (backend)" -ForegroundColor Green
        Write-Host "# Cole no dashboard: Settings > Environment" -ForegroundColor Gray
        Write-Host ""
        Write-Host "DATABASE_URL=$DatabaseUrl"
        Write-Host "SECRET_KEY=$secretKey"
        Write-Host "ALGORITHM=HS256"
        Write-Host "ACCESS_TOKEN_EXPIRE_MINUTES=480"
        Write-Host "APP_NAME=IERS Sistema Integrado"
        Write-Host "APP_VERSION=2.0.0"
        Write-Host "DEBUG=False"
        Write-Host "ALLOWED_ORIGINS=$FrontendUrl"
        Write-Host ""
        Write-Host "# Nota: Se usar Blueprint (render.yaml), DATABASE_URL e SECRET_KEY" -ForegroundColor DarkGray
        Write-Host "# são configurados automaticamente." -ForegroundColor DarkGray
    }

    "vercel" {
        Write-Host "# Vercel - Frontend" -ForegroundColor Green
        Write-Host "# Cole no dashboard: Settings > Environment Variables" -ForegroundColor Gray
        Write-Host ""
        Write-Host "VITE_API_URL=$BackendUrl"
        Write-Host ""
        Write-Host "# CLI alternativa:" -ForegroundColor DarkGray
        Write-Host "# vercel env add VITE_API_URL" -ForegroundColor DarkGray
    }

    "neon" {
        Write-Host "# Neon PostgreSQL - Banco de Dados" -ForegroundColor Green
        Write-Host "# A connection string do Neon deve ser usada no backend." -ForegroundColor Gray
        Write-Host ""
        Write-Host "# Formato esperado (substitua com seus dados):" -ForegroundColor DarkGray
        Write-Host "DATABASE_URL=postgresql+asyncpg://neondb_owner:SENHA@ep-XXXXX.us-east-2.aws.neon.tech/iers_db?sslmode=require"
        Write-Host ""
        Write-Host "# IMPORTANTE:" -ForegroundColor Yellow
        Write-Host "# - Use 'postgresql+asyncpg://' (NÃO 'postgresql://')" -ForegroundColor Yellow
        Write-Host "# - Ative SSL (sslmode=require)" -ForegroundColor Yellow
        Write-Host "# - Use o endpoint 'pooled' para melhor performance" -ForegroundColor Yellow
    }

    "railway" {
        Write-Host "# Railway.app - Alternativa ao Render" -ForegroundColor Green
        Write-Host "# Dashboard: https://railway.app" -ForegroundColor Gray
        Write-Host ""
        Write-Host "# Backend (Web Service):" -ForegroundColor White
        Write-Host "DATABASE_URL=$DatabaseUrl"
        Write-Host "SECRET_KEY=$secretKey"
        Write-Host "ALGORITHM=HS256"
        Write-Host "ACCESS_TOKEN_EXPIRE_MINUTES=480"
        Write-Host "APP_NAME=IERS Sistema Integrado"
        Write-Host "APP_VERSION=2.0.0"
        Write-Host "DEBUG=False"
        Write-Host "ALLOWED_ORIGINS=$FrontendUrl"
        Write-Host "PORT=8000"
        Write-Host ""
        Write-Host "# Start Command: uvicorn app.main:app --host 0.0.0.0 --port `$PORT" -ForegroundColor DarkGray
        Write-Host "# Root: /backend" -ForegroundColor DarkGray
    }

    "fly" {
        Write-Host "# Fly.io - Alternativa ao Render" -ForegroundColor Green
        Write-Host "# CLI: https://fly.io/docs/hands-on/install-flyctl/" -ForegroundColor Gray
        Write-Host ""
        Write-Host "# Comandos:" -ForegroundColor White
        Write-Host "cd backend"
        Write-Host "fly launch --name iers-api --region iad --no-deploy"
        Write-Host "fly secrets set DATABASE_URL='$DatabaseUrl'"
        Write-Host "fly secrets set SECRET_KEY='$secretKey'"
        Write-Host "fly secrets set ALGORITHM=HS256"
        Write-Host "fly secrets set ACCESS_TOKEN_EXPIRE_MINUTES=480"
        Write-Host "fly secrets set ALLOWED_ORIGINS='$FrontendUrl'"
        Write-Host "fly secrets set APP_NAME='IERS Sistema Integrado'"
        Write-Host "fly secrets set DEBUG=False"
        Write-Host "fly deploy"
    }

    "all" {
        Write-Host "Gerando para todas as plataformas..." -ForegroundColor Yellow
        Write-Host ""
        & $PSCommandPath -Platform render -DatabaseUrl $DatabaseUrl -BackendUrl $BackendUrl -FrontendUrl $FrontendUrl
        Write-Host ""
        & $PSCommandPath -Platform vercel -DatabaseUrl $DatabaseUrl -BackendUrl $BackendUrl -FrontendUrl $FrontendUrl
        Write-Host ""
        & $PSCommandPath -Platform neon -DatabaseUrl $DatabaseUrl -BackendUrl $BackendUrl -FrontendUrl $FrontendUrl
    }
}

Write-Host ""
