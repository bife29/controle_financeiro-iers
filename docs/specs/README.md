# 📋 Specifications (SDD — Specification-Driven Development)

Este diretório contém as **specs** do projeto IERS. Cada spec descreve uma
mudança de negócio ou correção **antes** do código ser escrito, seguindo a
disciplina Specification-Driven Development.

## Por que SDD?

- **Menos retrabalho**: alinhamento com a área de negócio (Jéssica) antes de
  qualquer linha de código.
- **Previsibilidade**: prazo e escopo escritos por adiantado.
- **Critérios objetivos de "pronto"**: E2E valida a spec, não a opinião.
- **Rastreabilidade**: cada commit referencia uma spec (`SPEC-###`).

## Ciclo de vida de uma spec

```
Rascunho → Aprovada → Em implementação → E2E verde → Publicada (prod) → Arquivada
```

1. Alguém identifica necessidade → cria `SPEC-###-titulo-curto.md` copiando `TEMPLATE.md`.
2. Preenche seções obrigatórias (contexto, critérios de aceitação).
3. Área de negócio aprova (comentário no card ou WhatsApp).
4. Dev implementa **e** escreve E2E que exercita cada critério.
5. Após deploy, roda `run-prod-*.ps1` e marca a spec como **Publicada**.
6. Se aparecer bug relacionado, cria nova spec com id maior.

## Convenções

- **ID**: `SPEC-###` (zero-padded, 3 dígitos, sequencial global).
- **Nome do arquivo**: `SPEC-###-slug-kebab-case.md`.
- **Commits**: mensagem inclui `[SPEC-###]` — ex.: `fix(compras): esconder botão excluir [SPEC-001]`.
- **E2E**: cada spec com escopo funcional gera um spec Playwright novo,
  cabeçalho comentando `Spec: docs/specs/SPEC-###-...md`.

## Índice de specs

| ID | Título | Estado | E2E |
|----|--------|--------|-----|
| [SPEC-001](SPEC-001-excluir-lista-compras-permissao.md) | Excluir lista de compras respeitando permissão | ✅ **Publicada** (validada em prod por Jéssica em 15/07/26) | [tests/ui/shopping-delete-permission.spec.ts](../../e2e/tests/ui/shopping-delete-permission.spec.ts) |
| [SPEC-002](SPEC-002-navegacao-notificacoes-sino.md) | Navegação a partir do sininho de notificações | ⚠️ **Reaberta** — navegação OK; dropdown do sino aparece cortado no desktop (retest 15/07) | [tests/ui/notifications-navigation.spec.ts](../../e2e/tests/ui/notifications-navigation.spec.ts) + falta E2E de visibilidade |
| [SPEC-003](SPEC-003-retiros-listagem-imprimir-e-revalidar.md) | Retiros: imprimir listagem de participantes + revalidar deploy de features não observadas | 🚧 **Em implementação** (código local + E2E verde, aguardando validação da Jéssica em prod) | [tests/ui/retreats-print-participants.spec.ts](../../e2e/tests/ui/retreats-print-participants.spec.ts) |

Para novas specs, copie [TEMPLATE.md](TEMPLATE.md).
