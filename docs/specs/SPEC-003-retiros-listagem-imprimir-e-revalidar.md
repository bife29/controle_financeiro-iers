# SPEC-003 — Retiros: imprimir listagem de participantes + revalidar features não-observadas

- **Autor**: Michel (dev)
- **Solicitante / dono de negócio**: Jéssica
- **Data de criação**: 2026-07-22
- **Estado**: ✅ **Aprovada 2026-07-22** — decisões tomadas (formato, extras).
  Implementação em curso.
- **Data de aprovação**: 2026-07-22
- **Commits relacionados**: — (a spec inclui o commit `b5473e4` como pré-existente e um commit novo para impressão)
- **E2E**: [`e2e/tests/api/retreats-child-responsible.spec.ts`](../../e2e/tests/api/retreats-child-responsible.spec.ts) (já existente, cobre backend do responsável) + **NOVO** `e2e/tests/ui/retreats-print-participants.spec.ts` (a criar)

---

## 1. Contexto (por quê)

Retest 15/07/26 pela Jéssica, relato integral:

> "Retiros — crianças pagas pelos pais: **não observei alteração**.
> Na aba de vincular membro adicione o botão de edição ao lado do membro
> acionado para que possa fazer alterações (principalmente valor acordado).
> Botão de imprimir listagem de membros vinculados."

Investigando o código no repositório (branch `main`, commit `6abb496`):

### 1.1 "Não observei alteração" (crianças pagas pelos pais)

A feature **existe** no repo desde `b5473e4` (2026-07-01, 14 dias antes do
retest):

- Backend: `RetreatParticipant.responsible_participant_id`
  ([backend/app/modules/retreat/models.py](../../backend/app/modules/retreat/models.py) L46),
  validação e persistência em
  [backend/app/modules/retreat/routes.py](../../backend/app/modules/retreat/routes.py) L322,383,421,462.
- Frontend:
  [frontend/src/pages/retreats/RetreatParticipants.tsx](../../frontend/src/pages/retreats/RetreatParticipants.tsx)
  L189 (badge "Paga: {responsável}") e L359,672 (envio do campo no POST/PUT).
- E2E backend:
  [e2e/tests/api/retreats-child-responsible.spec.ts](../../e2e/tests/api/retreats-child-responsible.spec.ts)
  (4 cenários, todos verdes).

**Hipótese**: o deploy Vercel do frontend não foi disparado (ou falhou)
para este commit, então Jéssica está vendo a versão anterior. Precisa
validar em produção antes de assumir bug real.

### 1.2 "Adicione botão de edição ao lado do membro"

**Também já existe** desde `b5473e4`:
[RetreatParticipants.tsx L237-L246](../../frontend/src/pages/retreats/RetreatParticipants.tsx)
renderiza um botão `data-testid="participant-edit-${p.id}"` (ícone lápis +
label "Editar") na coluna Ações. O modal de edição
(`EditParticipantModal`, L621) permite alterar Nome, Telefone, Categoria,
**Valor acordado (`individual_cost`)**, Status Pagamento, Inscrição,
Ônibus, Cama, Responsável (para crianças) e Observações.

Mesma hipótese: deploy não propagou. Confirmar em prod.

### 1.3 "Botão de imprimir listagem de membros vinculados"

**Isto sim é novo escopo.** Hoje não existe nenhuma forma de imprimir a
listagem de participantes de um retiro (não há botão Export/Print em
`RetreatParticipants.tsx`). Escopo real desta spec.

---

## 2. Objetivo (o quê)

- (A) Confirmar que o deploy em produção contém a feature de responsável
  de pagamento + botão de editar participante; se não, redeployar. Sem
  código novo para (A) — apenas validação.
- (B) Adicionar botão **"Imprimir listagem"** na tela
  `RetreatParticipants` que gera uma versão print-friendly da lista atual
  (respeitando o filtro aplicado, se houver), pronta para o usuário salvar
  como PDF ou imprimir em papel para levar na recepção do retiro.

## 3. Escopo

**Faz parte** desta spec:
- Validar em prod que a feature "responsável de pagamento" e o botão
  "Editar participante" já estão visíveis (redeployar se necessário).
- **Dois modos de impressão** acionáveis por botões distintos na tela
  `RetreatParticipants`:
  - **Modo Completo** (botão "🖨️ Imprimir completa"): logo IERS +
    cabeçalho do retiro + tabela com todas as colunas (Nome, Tipo,
    Telefone, Membro/Visitante, Responsável pagamento, Ônibus, Cama,
    Valor, Status Pagamento, Observações) + linha de totais no rodapé
    (valor esperado, arrecadado, pendente, saldo).
  - **Modo Simplificado** (botão "📝 Lista de ônibus"): logo IERS +
    cabeçalho enxuto + tabela com colunas Nome, Tipo, Telefone, Status —
    otimizada para chamada rápida na porta do ônibus.
- Ambos os modos:
  - Respeitam o filtro de busca ativo (se filtrou "Silva", imprime só
    quem bate).
  - Aplicam `@media print` para ocultar sidebar/header/botões.
  - Deixam o **usuário escolher orientação (retrato/paisagem) no
    diálogo nativo do navegador** — sem forçar `@page` size.
- View acessível via rota dedicada (`/retiros/:id/participantes/impressao?modo=completa|onibus`)
  para permitir E2E direto.
- E2E UI que abre cada modo e valida colunas e totais.

**NÃO faz parte** (vira spec própria se pedido):
- Exportar para Excel/CSV (já existe padrão em Compras — extensível
  depois).
- Filtros avançados de impressão (por status, por ônibus, etc.).
- Impressão de carnê individual do participante (já tem tela dedicada).
- Personalização do cabeçalho de impressão (logo, brasão da igreja).

## 4. Personas / atores

- **Jéssica (super_admin)** ou qualquer usuário com `retiros.view`.
- Uso típico: dia do retiro, imprimir para conferir chegada no ônibus e
  distribuir chaves de quarto.

## 5. Fluxo desejado (passo a passo)

1. Usuária loga → Retiros → clica em um retiro → aba "Participantes".
2. Vê a tabela como hoje, com os botões Editar e Carnê nas ações.
3. **NOVO**: no cabeçalho da tabela (acima, à direita), aparecem dois
   botões de impressão:
   - "🖨️ Imprimir completa"
   - "📝 Lista de ônibus"
4. Clica em um dos botões → abre nova aba com a listagem formatada.
5. Navegador abre o diálogo de impressão automaticamente (`window.print()`).
6. Usuária escolhe orientação, "Salvar como PDF" ou envia para impressora.
7. Fecha a aba, volta ao sistema.
## 6. Regras de negócio

- **RN-1**: A listagem impressa reflete **exatamente** o filtro de busca
  ativo no momento do clique.
- **RN-2**: A impressão inclui cabeçalho com nome, local e datas do
  retiro + contagem total de participantes impressos.
- **RN-3**: Sidebar, botões, header e badges coloridos NÃO aparecem na
  impressão (apenas texto legível preto-no-branco).
- **RN-4**: Se um participante criança tem `responsible_participant_id`,
  a coluna "Paga por" mostra o nome do adulto responsável.
- **RN-5**: Se a lista está vazia (após filtro), imprime mesmo assim com
  a linha "Nenhum participante encontrado" — evita imprimir folha
  totalmente em branco por engano.

## 7. Critérios de aceitação (Given / When / Then)

- **AC-1** — Given usuária logada em Retiros → detalhe → Participantes
  com pelo menos 1 participante, When clica em "Imprimir listagem",
  Then abre uma nova visualização com o cabeçalho do retiro e a lista
  de todos os participantes visíveis.
- **AC-2** — Given filtro de busca aplicado "Silva", When clica em
  "Imprimir listagem", Then apenas participantes que contêm "Silva"
  aparecem na impressão.
- **AC-3** — Given uma criança com `responsible_participant_id`
  apontando para "João Adulto", When impresso, Then a linha da criança
  mostra na coluna "Paga por" o texto "João Adulto".
- **AC-4** — Given a view de impressão renderizada, When aplicado
  `@media print`, Then sidebar/header/botões estão ocultos e a tabela
  ocupa toda a largura útil.
- **AC-5** — [Investigação prod] Given J\u00e9ssica logada em prod
  (`https://controlefinanceiro-iers.vercel.app`), When abre um retiro
  com criança inscrita, Then vê o botão "Editar" na linha do
  participante e vê o modal com campo "Valor acordado" ao clicar.
  (Se AC-5 falhar → o problema é deploy Vercel, não código; ação: forçar
  redeploy da branch `main`.)

## 8. Impacto técnico

- **Backend**: nenhum.
- **Frontend**:
  - `frontend/src/pages/retreats/RetreatParticipants.tsx`: novo botão
    "Imprimir listagem" no cabeçalho da tabela.
  - Nova view de impressão: pode ser uma rota dedicada
    `/retiros/:id/participantes/impressao` (mais testável) OU uma janela
    nova via `window.open('about:blank')` com o HTML injetado. **Preferir
    rota dedicada** para permitir E2E direto.
  - CSS `@media print` em `index.css` ou dentro da própria página.
- **Banco de dados**: nenhuma migração.
- **Contrato de API**: nenhuma mudança (usa `GET /api/retreats/{id}` +
  `GET /api/retreats/{id}/participants` que já existem).

## 9. Riscos e mitigações

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Navegador bloqueia `window.print()` automático | Baixa | Baixo | Botão manual "Imprimir" dentro da view |
| Lista com 200+ participantes vira PDF gigante | Baixa | Baixo | Fonte pequena (10px), landscape opcional |
| Nome longo quebra layout | Média | Baixo | `word-break: break-word` na coluna Nome |
| Redeploy Vercel não resolver (feature realmente ausente) | Média | Médio | Se AC-5 falhar após redeploy, abrir SPEC-004 específica |

## 10. Plano de rollout

1. **Antes de codar**: validar em produção se AC-5 já passa (basta abrir
   um retiro no site e conferir). Se não passar, disparar redeploy
   Vercel manual e revalidar.
2. Implementar botão + view de impressão + E2E.
3. Rodar suite local completa: `cd e2e; npx playwright test`.
4. Deploy frontend Vercel.
5. Rodar `e2e/run-prod-chromium.ps1 tests/ui/retreats-print-participants.spec.ts`.
6. Pedir Jéssica testar impressão de um retiro real.
7. Marcar spec como **Publicada**.

## 11. Plano de rollback

Reverter apenas o commit do frontend. Nenhuma alteração de dados.

## 12. Perguntas em aberto

- [x] Formato de impressão: **retrato ou paisagem** por padrão? →
      **Usuária escolhe no diálogo do navegador** (não forçamos `@page size`).
- [x] Incluir coluna de observações? → **Sim, no modo completa.**
- [x] Precisa somar totais no rodapé? → **Sim, no modo completa**
      (valor esperado, arrecadado, pendente).
- [x] Cabeçalho da igreja (logo + nome IERS)? → **Sim, em ambos os modos.**
- [x] Modo "chamada de ônibus" (nome + tipo + telefone + status)? →
      **Sim, como botão separado.**

---

**Histórico de mudanças**:
- 2026-07-22: criação por Michel a partir do retest 15/07 da Jéssica.
- 2026-07-22: **Aprovada.** Decisões: dois modos de impressão (completa +
  chamada de ônibus), logo IERS + totais no rodapé (modo completa) +
  observações (modo completa), orientação escolhida pelo usuário no
  diálogo do navegador.
