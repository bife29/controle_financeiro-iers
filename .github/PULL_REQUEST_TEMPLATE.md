# Pull Request

## Descrição
<!-- O que mudou e por quê -->

## Tipo
- [ ] Bug fix
- [ ] Feature
- [ ] Refactor / chore
- [ ] Docs

## Política de Regressão E2E (obrigatório para bug fix)

> Regra do projeto: todo bug confirmado que escapou do E2E DEVE receber um teste E2E
> novo na mesma PR da correção. Veja `.github/copilot-instructions.md`.

- [ ] **Não é bug fix** — N/A.
- [ ] É bug fix e adicionei teste E2E novo que reproduz o bug (`e2e/tests/...`).
- [ ] Rodei a suite E2E **local** com sucesso.
- [ ] Rodei o novo teste em **produção** com sucesso (após deploy) — ou tenho plano claro de fazê-lo no merge.

## Validação técnica
- [ ] Backend importa OK (`python -c "from app.main import app"`)
- [ ] Frontend compila OK (`npx tsc -b`)
- [ ] Sem segredos / credenciais commitados
