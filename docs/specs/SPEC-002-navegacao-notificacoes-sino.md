# SPEC-002 — Navegação a partir do sininho de notificações

- **Autor**: Michel (dev)
- **Solicitante / dono de negócio**: Jéssica
- **Data de criação**: 2026-07-01
- **Estado**: Rascunho
- **Data de aprovação**: —
- **Commits relacionados**: —
- **E2E**: `e2e/tests/ui/notifications-navigation.spec.ts` (a criar)

---

## 1. Contexto (por quê)

Relato de Jéssica (retest 01/07/26):

> "Sininho: quando atribui a mim, não apareceu sinalização visual no símbolo
> do sininho indicando que tinha uma atribuição de lista de compras.
> Aparece a sinalização visual, mas **não leva a lugar nenhum e nem mostra a
> demanda**."

Investigando o código:

- `frontend/src/components/NotificationBell.tsx` **já implementa**
  `navigate(n.link)` no `handleItemClick`.
- `backend/app/modules/shopping/routes.py` **já preenche** o campo `link`
  com `/compras/listas/{id}` ao criar a notificação.
- A rota `/compras/listas/:id` **existe** em `frontend/src/pages/shopping/index.tsx`.

Hipótese: Jéssica clicou **no ícone do sino** (que só abre o dropdown) e não
percebeu que precisa clicar no **card da notificação** dentro do dropdown.
Ou: o dropdown está aparecendo mas os itens estão vazios em produção por
alguma condição do backend não mapeada.

## 2. Objetivo (o quê)

Garantir que ao interagir com o sininho, o usuário chegue à tela do item que
gerou a notificação em **≤ 2 cliques** e com **feedback visual claro** de que
a linha é clicável (afinal ela navega para outro lugar).

## 3. Escopo

**Faz parte** desta spec:
- Confirmar via E2E que clicar no card de notificação de atribuição de lista
  de compras navega para `/compras/listas/{id}`.
- Marcar a notificação como lida ao clicar.
- Melhorar a affordance visual do card: cursor pointer + ícone de seta +
  hover destacado + subtítulo "Ir para o item".
- Corrigir eventuais bugs descobertos no caminho (link nulo em notificações
  antigas → mostrar aviso "Sem destino"; badge visível mas dropdown vazio →
  garantir consistência entre `unread_count` e `items`).
- Adicionar `data-testid` novo `notification-open-target` para poder testar.

**NÃO faz parte**:
- Redesign completo do dropdown de notificações.
- Push notifications / realtime (fica pra spec futura, ex.: SSE).
- Agrupamento de notificações por tipo.

## 4. Personas / atores

- Qualquer usuário logado que receba uma notificação (foco atual:
  atribuição de lista de compras → assinado).

## 5. Fluxo desejado (passo a passo)

1. Usuário A cria uma lista de compras e atribui ao Usuário B (ou a si mesmo).
2. Usuário B (que pode ser o próprio A na auto-atribuição) vê o **badge
   vermelho** no sino no header.
3. Usuário B **clica no sino** → dropdown abre listando notificações.
4. Cada card da notificação apresenta: título, mensagem, tempo relativo,
   ícone de "seta pra direita" indicando que é clicável.
5. Usuário B **clica no card** da notificação de atribuição.
6. Sistema:
   - Marca a notificação como lida (badge decrementa).
   - Fecha o dropdown.
   - Navega para a tela da lista de compras (`/compras/listas/{id}`).
7. Usuário B vê a lista, entende a demanda e age.

## 6. Regras de negócio

- **RN-1**: Toda notificação com `link` não-nulo deve ser clicável e navegar.
- **RN-2**: Notificação sem `link` mostra "Sem destino" e não é clicável (mas
  ainda pode ser marcada como lida).
- **RN-3**: Ao clicar em uma notificação, ela é marcada como lida (mesmo se
  não tem link).
- **RN-4**: `unread_count` retornado pela API deve ser igual ao número de
  itens com `is_read=false` em `items` **quando** não há paginação
  (limit ≥ total). Se o backend paginar, o count é total independente da
  página; documentar.

## 7. Critérios de aceitação (Given / When / Then)

- **AC-1** — Given Usuário A logado, When cria lista de compras atribuída a A,
  Then em ≤ 65s aparece badge vermelho `1` no sino.
- **AC-2** — Given badge visível, When Usuário A clica no sino, Then o
  dropdown abre e o primeiro item é a notificação recém-criada com o título
  esperado.
- **AC-3** — Given dropdown aberto, When Usuário A clica no card da
  notificação, Then a URL vira `/compras/listas/{id}` E o dropdown fecha.
- **AC-4** — Given notificação foi clicada, When Usuário A abre o sino de
  novo, Then aquela notificação aparece sem o ponto azul e o badge
  decrementou.
- **AC-5** — Given uma notificação sem `link` (legado), When Usuário A clica,
  Then não navega mas a marca como lida e mostra tooltip "Sem destino".

## 8. Impacto técnico

- **Backend**: nenhum (código já correto). Adicionar teste de contrato
  garantindo `link` presente em notificações de compras.
- **Frontend** (`components/NotificationBell.tsx`):
  - Adicionar ícone `ChevronRight` no card quando `link` existe.
  - Adicionar `title="Clique para abrir"` no `<button>` do card.
  - Se `!n.link`, mudar `cursor` para `default` e tooltip "Sem destino".
  - Novo `data-testid="notification-open-${n.id}"`.
- **Banco de dados**: nenhuma migração.

## 9. Riscos e mitigações

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Notificações antigas sem `link` | Média | Baixo | RN-5 trata graciosamente |
| Navegação quebra em telas com modal aberto | Baixa | Médio | E2E cobre o cenário `dropdown fechado + navigate` |
| Rota `/compras/listas/:id` retornar 404 pra usuário sem `compras.view` | Baixa | Alto | Verificar RBAC da rota; se falhar, mostrar erro amigável (fora do escopo) |

## 10. Plano de rollout

1. Deploy frontend (backend não muda).
2. Rodar `e2e/run-prod-chromium.ps1 tests/ui/notifications-navigation.spec.ts`.
3. Pedir Jéssica atribuir uma lista pra si mesma e clicar no sino → conferir
   se abre a tela correta.
4. Marcar spec como **Publicada**.

## 11. Plano de rollback

Reverter o commit do frontend. Backend não é tocado.

## 12. Perguntas em aberto

- [ ] Devemos abrir a notificação em nova aba/janela se o usuário estiver no
      meio de um formulário? (Provavelmente não — mas pensar.)
- [ ] Notificações lidas devem sumir depois de X dias? (fora de escopo por
      ora, spec futura).

---

**Histórico de mudanças**:
- 2026-07-01: criação por Michel.
