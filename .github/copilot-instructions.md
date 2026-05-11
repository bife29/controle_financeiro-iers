# Instruções para o GitHub Copilot — Projeto IERS

Estas instruções valem para qualquer assistente/agente trabalhando neste repositório.

## 🔴 Regra de ouro: Política de Regressão E2E

**Todo bug ou erro funcional que NÃO foi pego pelos testes E2E e cuja existência for
confirmada (em produção, homologação ou local) DEVE, após a correção, virar um teste
E2E novo — antes do commit/push da correção.**

Isso garante melhoria contínua da rede de segurança e evita que o mesmo bug volte.

### Checklist obrigatório por bug

Quando corrigir um bug que escapou do E2E, antes do commit final:

1. **Reproduza o bug** localmente (manualmente ou via script).
2. **Escreva o teste E2E que falha** apontando para o bug (TDD-style).
   - Se o bug é de **API/contrato** → spec em `e2e/tests/api/`.
   - Se o bug é de **UI/fluxo do usuário** → spec em `e2e/tests/ui/`.
   - Se o bug é de **permissão/RBAC** → cobrir em `e2e/tests/api/permissions.spec.ts`.
3. **Aplique a correção** e confirme que o teste passa.
4. **Rode a suite completa local**: `cd e2e; npx playwright test`.
5. **Rode em produção** (após deploy): `e2e/run-prod-api.ps1` + `e2e/run-prod-chromium.ps1`.
6. **Commit único** que inclui correção + teste novo (mensagem: `fix: <bug> + e2e regression`).

### Anti-patterns proibidos

- ❌ Corrigir bug sem adicionar teste de regressão.
- ❌ Marcar teste como `test.skip` para "fazer depois".
- ❌ Adicionar teste que sempre passa (não exercita o bug original).
- ❌ Rodar teste só local sem validar em produção.

### Onde escrever o teste

| Tipo de bug | Local | Como começar |
|---|---|---|
| Validação Pydantic / payload | `e2e/tests/api/<modulo>.spec.ts` | Veja `tests/api/financial.spec.ts` |
| Erro no formulário (UI) | `e2e/tests/ui/<modulo>.spec.ts` | Veja `tests/ui/transactions-edit.spec.ts` |
| Permissão / RBAC | `e2e/tests/api/permissions.spec.ts` | Adicione novo `test()` lá |
| Contrato/header HTTP (CORS, etc.) | `e2e/tests/api/<modulo>.spec.ts` | Use `response.headers()` |

### Convenções dos testes E2E

- **Sempre use `tag()` / `tagEmail()`** de `e2e/helpers/e2e-tag.ts` em campos
  identificadores (description/name/email) para que o teardown limpe.
- **Login via helper** `getAuthHeaders` ou `getAuthToken` (nunca hard-code token).
- **UI login**: `getByPlaceholder("seu@email.com")` + `getByPlaceholder("••••••••")`
  (a página de login não usa labels).
- **Cleanup**: confiar no `global-teardown.ts` (STRICT-MODE por tag), não fazer
  cleanup manual em afterAll exceto quando o teste cria recursos em rotas que o
  teardown não cobre.
- **Produção**: nunca rodar destrutivo sem `ALLOW_PROD_DESTRUCTIVE=true` e
  `ALLOW_PROD_CLEANUP=true`.

## Outras convenções

- **Idioma**: respostas em português brasileiro nas mensagens do agente.
- **Backend**: FastAPI + Pydantic v2 + SQLAlchemy 2 async. Validar com
  `python -c "from app.main import app; print(len(app.routes))"` antes de commit.
- **Frontend**: TypeScript strict — validar com `npx tsc -b` antes de commit.
- **Permissões**: rotas write usam `require_permission(modulo, acao)`
  (de `backend/app/core/security.py`), NÃO `require_roles`. `require_roles` ainda
  existe para compat mas não deve ser usado em rotas novas.
- **Encoding**: NUNCA usar `Set-Content` PowerShell para arquivos com acentuação
  (corrompe UTF-8). Use editores ou Python com `encoding='utf-8'`.
