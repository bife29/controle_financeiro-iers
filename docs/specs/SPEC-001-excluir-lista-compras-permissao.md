# SPEC-001 — Excluir lista de compras respeitando permissão do usuário

- **Autor**: Michel (dev)
- **Solicitante / dono de negócio**: Jéssica
- **Data de criação**: 2026-07-01
- **Estado**: ✅ **Publicada** — validada em produção por Jéssica em 2026-07-15
- **Data de aprovação**: 2026-07-22 (feedback Jéssica: "Teste 15/07 — funciona")
- **Commits relacionados**: `01985fe` (implementação + E2E)
- **E2E**: [`e2e/tests/ui/shopping-delete-permission.spec.ts`](../../e2e/tests/ui/shopping-delete-permission.spec.ts) — 6/6 passed local

---

## 1. Contexto (por quê)

Relato de Jéssica (retest 01/07/26):

> "Módulo de compras: permitir que eu exclua listas de compras
> (mensagem: Acesso negado. Necessário permissão 'delete' no módulo 'compras').
> Existe o botão para excluir, mas não funciona."

Investigando o código:

- O backend está correto: `DELETE /api/shopping/lists/{id}` exige permissão
  `compras.delete` (só `super_admin` tem no default).
- O frontend em `frontend/src/pages/shopping/ListsList.tsx` **mostra o botão
  para qualquer usuário**, mesmo os que não têm permissão. Quando o usuário
  clica, o backend rejeita e a UX fica ruim ("por que o botão aparece se
  não posso usar?").

Além disso, a store de autenticação do frontend
(`frontend/src/stores/auth.ts`) **só guarda o `role`**, não o dicionário de
permissões granulares. Isso impede qualquer verificação por-módulo/ação na UI.

## 2. Objetivo (o quê)

Fazer com que o botão "Excluir" (e qualquer ação sensível) **só apareça para
usuários que têm permissão real** de executá-la, e não gerar mais mensagens
de "Acesso negado" desnecessárias na tela.

## 3. Escopo

**Faz parte** desta spec:
- Expor `permissions` do usuário no payload de `/api/auth/login` e `/api/auth/me`.
- Persistir `permissions` na store Zustand do frontend.
- Criar helper `hasPermission(module, action)` (backend defaults + overrides
  do usuário + regra `super_admin sempre pode`).
- Esconder botão "Excluir lista" quando o usuário não tem `compras.delete`.
- Esconder botão "Arquivar/Desarquivar" quando o usuário não tem `compras.edit`.
- E2E que verifica: super_admin vê botão, secretaria não vê.

**NÃO faz parte** (vira spec separada se necessário):
- Auditoria retroativa de outros módulos (retiros, financeiro, patrimônio) —
  mesma técnica, mas fazer módulo a módulo com spec própria.
- Reescrever o backend RBAC (já funciona corretamente).
- Adicionar novos papéis padrão.

## 4. Personas / atores

- **Admin (super_admin)**: vê e usa o botão Excluir normalmente.
- **Financeiro / Secretaria / Pastor / Viewer**: NÃO vê o botão Excluir de
  listas de compras.
- **Usuário com permissão customizada `compras.delete`**: vê o botão mesmo
  que o papel base não tenha.

## 5. Fluxo desejado (passo a passo)

**Cenário A — Admin abre a lista de listas**:
1. Admin loga.
2. Vai em Compras → Listas.
3. Cada card de lista mostra: Abrir, Arquivar, **Excluir**.
4. Ao clicar em Excluir, confirma e a lista some.

**Cenário B — Secretaria abre a lista de listas**:
1. Secretaria loga.
2. Vai em Compras → Listas.
3. Cada card de lista mostra: Abrir, **(sem Arquivar, sem Excluir)**.
4. Não consegue acionar exclusão nenhuma. Nenhuma mensagem de erro na tela.

## 6. Regras de negócio

- **RN-1**: Se `user.role === 'super_admin'`, sempre autorizar.
- **RN-2**: Se `user.permissions[module]` existe e contém `action`, autorizar.
- **RN-3**: Caso contrário, cair no default do papel (`DEFAULT_PERMISSIONS[user.role]`).
- **RN-4**: A UI **nunca** deve exibir botão de ação para a qual `hasPermission`
  retorna `false`.
- **RN-5**: Regras precisam ser as MESMAS no frontend e no backend (fonte única
  de verdade: `DEFAULT_PERMISSIONS`).

## 7. Critérios de aceitação (Given / When / Then)

- **AC-1** — Given usuário `super_admin` logado, When abre Compras → Listas,
  Then vê o botão "Excluir" em cada card.
- **AC-2** — Given usuário `secretaria` logado, When abre Compras → Listas,
  Then NÃO vê o botão "Excluir" em nenhum card.
- **AC-3** — Given usuário `financeiro` logado (que tem `compras.edit` mas não
  `compras.delete`), When abre Compras → Listas, Then vê "Arquivar" mas
  NÃO vê "Excluir".
- **AC-4** — Given usuário `secretaria` com permissão customizada
  `compras.delete=true`, When abre Compras → Listas, Then vê "Excluir".
- **AC-5** — Given `super_admin`, When faz `DELETE /api/shopping/lists/{id}`
  via API, Then recebe 200 e a lista some da listagem seguinte.
- **AC-6** — Given `secretaria`, When tenta `DELETE /api/shopping/lists/{id}`
  via API (curl direto), Then recebe 403 com mensagem
  `"Acesso negado. Necessário permissão 'delete' no módulo 'compras'."`
  (contrato do backend não muda).

## 8. Impacto técnico

- **Backend**:
  - `/api/auth/login` e `/api/auth/me`: incluir `permissions: dict[str, list[str]]`
    computado. Se o usuário não tem override, retornar o default do papel.
  - Novo endpoint OPCIONAL: `/api/auth/permissions/effective` (opcional, se
    for reutilizado em outros lugares).
- **Frontend**:
  - `stores/auth.ts`: campo `permissions?: Record<string, string[]>` +
    helper `hasPermission(module, action): boolean` que aplica RN-1/2/3.
  - `pages/shopping/ListsList.tsx`: envolver botão Excluir e Arquivar em
    `{hasPermission('compras', 'delete') && ...}`.
- **Banco de dados**: nenhuma migração.
- **Contrato de API**: aditivo (novo campo em response). Não quebra clientes.

## 9. Riscos e mitigações

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Cache do JWT antigo sem `permissions` | Alta | Médio | Frontend faz fallback via `role` + defaults do backend (buscados on-demand em `/api/auth/permissions/defaults`) |
| Frontend e backend saírem de sincronia (novo módulo sem default) | Baixa | Baixo | `DEFAULT_PERMISSIONS` é fonte única e volta no payload do login |
| Usuário admin único perder acesso por bug de comparação | Baixa | Alto | E2E cobre AC-1 e AC-5 antes do deploy |

## 10. Plano de rollout

1. Deploy backend (payload aditivo — não quebra frontend antigo).
2. Deploy frontend.
3. Rodar `e2e/run-prod-api.ps1` — confirmar 200/403 corretos.
4. Rodar `e2e/run-prod-chromium.ps1 tests/ui/shopping-delete-permission.spec.ts`.
5. Pedir Jéssica logar como o papel dela e conferir que não vê mais o botão.
6. Marcar spec como **Publicada**.

## 11. Plano de rollback

- Reverter apenas o commit do frontend (`git revert`) — backend aditivo é
  seguro. Rodar smoke E2E de novo.

## 12. Perguntas em aberto

- [x] Qual é o papel exato da Jéssica em produção? → **Resposta (2026-07-22):**
      Jéssica é tesoureira e única operadora do sistema, portanto atende todas
      as camadas → papel efetivo em prod é `super_admin`.
- [x] Devemos adicionar `compras.delete` ao default de `secretaria`? → **Não.**
      Fica restrito a `super_admin` no default. Se a igreja quiser dar acesso
      a outra pessoa `secretaria`, basta marcar `compras.delete` na matriz
      individual em Gestão de Usuários (a UI já suporta).

---

**Histórico de mudanças**:
- 2026-07-01: criação por Michel.
- 2026-07-01: implementação + E2E — commit `01985fe`. Suite local: 6/6
  passed. Aguarda deploy no Vercel para validação final em produção.
- 2026-07-22: **Publicada.** Jéssica validou em 15/07: "funciona". Confirmou
  que seu papel é `super_admin` (tesoureira única operadora). Mantido
  `compras.delete` restrito a `super_admin` no default — override individual
  pela matriz de permissões continua disponível.
