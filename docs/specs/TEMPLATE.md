# SPEC-000 — [Título curto em linguagem de negócio]

> **Como copiar**: duplique este arquivo, renomeie para
> `SPEC-###-slug-em-kebab-case.md`, incremente o ID e preencha os campos.
> **Não altere este arquivo (é o template).**

- **Autor**: quem escreveu (dev responsável)
- **Solicitante / dono de negócio**: nome (ex.: Jéssica)
- **Data de criação**: YYYY-MM-DD
- **Estado**: Rascunho | Aprovada | Em implementação | E2E verde | Publicada | Arquivada
- **Data de aprovação**: — (preencher quando aprovada)
- **Commits relacionados**: — (`git log --grep "SPEC-###"`)
- **E2E**: — (path do spec Playwright)

---

## 1. Contexto (por quê)

Explique em 3-6 linhas, **em linguagem de negócio**, o problema real observado.

- Como o usuário percebe hoje?
- Qual o impacto (perde tempo, perde dinheiro, gera confusão)?
- Referência ao relato (WhatsApp, feedback in-app, ticket, etc.).

## 2. Objetivo (o quê)

Uma frase clara descrevendo o resultado esperado do ponto de vista do usuário.

## 3. Escopo

**Faz parte** desta spec:
- ...

**NÃO faz parte** (fora de escopo, vira spec separada):
- ...

## 4. Personas / atores

- Ex.: Secretária (papel `secretaria`)
- Ex.: Administrador (papel `super_admin`)

## 5. Fluxo desejado (passo a passo)

Descreva a jornada como o usuário vai vivenciar:

1. Usuário X abre tela Y.
2. Clica em Z.
3. Sistema faz W.
4. Resultado visível: ...

Se houver variações por papel/permissão, use sub-listas.

## 6. Regras de negócio

- RN-1: ...
- RN-2: ...

## 7. Critérios de aceitação (Given / When / Then)

Cada critério deve virar **um teste E2E**. Escreva do jeito que o negócio consegue ler.

- **AC-1** — Given [contexto], When [ação], Then [resultado esperado].
- **AC-2** — ...
- **AC-3** — ...

## 8. Impacto técnico (o dev preenche)

- **Backend**:
  - Rotas afetadas: ...
  - Modelos / migrações: ...
- **Frontend**:
  - Componentes / páginas: ...
  - Estado global (auth store, permissions): ...
- **Banco de dados**:
  - Migração idempotente? Sim/Não. Descreva.
- **Contrato de API**:
  - Mudança quebra clientes existentes? Sim/Não.

## 9. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| ... | Baixa/Média/Alta | Baixo/Médio/Alto | ... |

## 10. Plano de rollout

1. Deploy backend (migração roda no startup).
2. Deploy frontend.
3. Rodar smoke em produção (`run-prod-api.ps1`).
4. Validação manual do solicitante.
5. Marcar spec como **Publicada** e mover linha do índice em `README.md`.

## 11. Plano de rollback

O que fazer se der ruim em produção. Passos concretos.

## 12. Perguntas em aberto

- [ ] ...
- [ ] ...

---

**Histórico de mudanças**:
- YYYY-MM-DD: criação por [autor].
