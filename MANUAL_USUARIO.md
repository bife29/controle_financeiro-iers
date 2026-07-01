# 📘 Manual do Usuário — IERS Sistema Integrado

## Bem-vindo ao Sistema IERS!

Este manual explica todas as funcionalidades do sistema de gestão da igreja, organizadas por módulo. Use o menu lateral para navegar entre os módulos disponíveis para o seu perfil.

---

## 🔐 Acesso ao Sistema

### Como fazer login

1. Acesse o sistema pelo navegador
2. Informe seu **email** e **senha**
3. Clique em **Entrar**

> 💡 Caso esqueça sua senha, solicite ao administrador a redefinição.

### Perfis de Acesso

| Perfil | O que pode fazer |
|--------|-----------------|
| **Administrador** | Acesso total: gerencia usuários, financeiro, membros, retiros e feedbacks |
| **Pastor** | Visualiza todos os módulos e pode criar lançamentos financeiros |
| **Financeiro** | Controle completo do módulo financeiro + visualização dos demais |
| **Secretaria** | Gerencia membros e retiros + visualização do dashboard |
| **Visualizador** | Somente consulta em todos os módulos |

---

## 📊 Dashboard

O Dashboard é a **página inicial** do sistema, exibindo um resumo geral:

### O que você encontra:
- **Total de Entradas** — soma de todas as receitas
- **Total de Saídas** — soma de todas as despesas
- **Saldo** — diferença entre entradas e saídas
- **Membros Ativos** — quantidade de membros cadastrados
- **Gráfico Entradas vs Saídas** — comparativo mensal
- **Gráfico por Projeto** — distribuição financeira por projeto

### Fluxo:
```
Login → Dashboard → Visualizar KPIs e Gráficos
```

---

## 💰 Módulo Financeiro

### Visão Geral
O módulo financeiro permite controlar todas as movimentações financeiras da igreja.

### Funcionalidades:

#### 📋 Transações
- **Listar** todas as transações com filtros (tipo, projeto, busca)
- **Criar** nova transação (entrada ou saída)
- **Editar** transação existente
- **Excluir** transação

**Como criar uma transação:**
1. Acesse **Financeiro → Transações**
2. Clique em **Nova Transação**
3. Selecione o tipo (Entrada ou Saída)
4. Preencha: data, valor, descrição, projeto, categoria
5. Escolha a forma de pagamento e status
6. Clique em **Salvar**

> **💡 Status — Previsto vs Confirmado**
> - **Previsto** (amarelo): é uma promessa ou compromisso futuro (ex.: dízimo combinado, conta a pagar). **NÃO** entra no caixa real, aparece nas previsões do dashboard.
> - **Confirmado** (verde): dinheiro que entrou ou saiu de fato. Entra no caixa real, KPIs e gráficos.
> - Para dar baixa em um Previsto: na lista de transações, clique no botão **Confirmar** ao lado da linha — informe a data do pagamento (default: hoje).
> - A importação de extrato OFX confirma automaticamente os Previstos que batem com o extrato (mesmo valor, ±3 dias).

> **📌 Recomendação de fluxo — pagamentos de eventos/retiros recebidos por comprovante**
>
> À medida que você recebe comprovantes (PIX, TED, dinheiro etc.) para eventos, **prefira lançar como Previsto** e deixar o extrato OFX bater automaticamente:
> 1. Recebeu comprovante hoje → cadastra transação como **Previsto** (com o valor certo).
> 2. Ao importar o OFX do banco, o sistema encontra o Previsto e o marca como **Confirmado** sozinho — sem duplicar.
>
> **Se lançar direto como Confirmado (manual)** e depois importar o OFX com a mesma transação: o sistema detecta **possível duplicidade** (mesmo valor, mesmo tipo, ±3 dias) mesmo que a descrição seja diferente, e mostra na tela de pré-visualização para você decidir. Isso evita que o valor entre 2x no caixa.
> - Regra forte (bloqueia): mesmo valor + tipo + data + descrição igual, ou mesmo `bank_reference` (FITID).
> - Regra fraca (marca como "possível"): mesmo valor + tipo + ±3 dias, descrição diferente — típico quando o manual foi "Retiro João" e o extrato veio "PIX REC TEDxxx".


#### 📁 Projetos
- **Listar** todos os projetos (Ativo, Encerrado, Cancelado)
- **Criar** novo projeto com meta financeira
- **Visualizar dashboard** do projeto (receitas, despesas, progresso)
- **Editar** dados do projeto

**Como criar um projeto:**
1. Acesse **Financeiro → Projetos**
2. Clique em **Novo Projeto**
3. Preencha: nome, descrição, datas, meta financeira
4. Clique em **Salvar**

#### 🏷️ Categorias
- **Listar** categorias agrupadas por tipo (Entrada/Saída)
- **Criar** nova categoria

**Como criar uma categoria:**
1. Acesse **Financeiro → Categorias**
2. Preencha o formulário no topo da página
3. Selecione tipo (Entrada/Saída) e natureza (Fixa/Variável)
4. Clique em **Criar**

#### 📥 Importação de Extrato
- **Importar** arquivo OFX ou CSV do banco
- **Pré-visualizar** transações antes de confirmar
- **Detectar duplicidades** automaticamente
- **Confirmar** importação

**Como importar um extrato:**
1. Acesse **Financeiro → Importação**
2. Selecione o projeto destino
3. Escolha o arquivo (OFX ou CSV)
4. Clique em **Processar Arquivo**
5. Revise as transações na tabela de pré-visualização
6. Clique em **Confirmar Importação**

> **🔍 A importação separa as linhas em 4 grupos automáticos:**
> - **Novas**: serão criadas como Confirmadas no sistema.
> - **Confirmam previstos**: bateram exatamente com um Previsto cadastrado (mesmo valor, ±3 dias). O Previsto vira Confirmado, sem duplicar registro.
> - **Decisões necessárias** (ambíguas): mais de um Previsto bate com a mesma linha — você escolhe qual deve ser confirmado.
> - **Duplicadas**: já existem no sistema (mesma referência bancária OU mesmo valor + data + descrição). Você decide ignorar ou importar mesmo assim.
>
> A janela de **±3 dias** acomoda lançamentos do Santander que pulam fim de semana (cobrança de sábado/domingo aparece como segunda-feira no extrato).

### Fluxo Completo do Financeiro:
```
Hub Financeiro
├── Transações → Listar / Criar / Editar / Excluir
├── Projetos → Listar / Criar / Dashboard / Editar
├── Categorias → Listar / Criar
└── Importação → Upload → Preview → Confirmar
```

---

## 👥 Módulo de Membros

### Visão Geral
Cadastro completo de membros da igreja com mais de 30 campos disponíveis.

### Funcionalidades:
- **Listar** membros com busca por nome, CPF ou celular
- **Filtrar** por status (ativo/inativo)
- **Cadastrar** novo membro
- **Visualizar** ficha completa do membro
- **Editar** dados do membro

**Como cadastrar um membro:**
1. Acesse **Membros**
2. Clique em **Novo Membro** (ou Cadastrar)
3. Preencha os dados pessoais (nome completo é obrigatório)
4. Opcionalmente preencha: endereço, contato, dados eclesiásticos
5. Clique em **Salvar**

**Como buscar um membro:**
1. Na lista de membros, use o campo de busca
2. Digite parte do nome, CPF ou número de celular
3. A lista será filtrada automaticamente

### Fluxo:
```
Membros
├── Lista → Buscar / Filtrar
├── Cadastrar → Preencher Formulário → Salvar
├── Visualizar → Ficha Completa
└── Editar → Alterar Dados → Salvar
```

---

## ⛰️ Módulo de Retiros

### Visão Geral
Gestão completa de retiros e encontros da igreja, incluindo inscrições, pagamentos e carnê.

### Funcionalidades:

#### 📋 Retiros
- **Listar** todos os retiros
- **Criar** retiro (automaticamente cria projeto financeiro vinculado)
- **Visualizar dashboard** com KPIs do retiro
- **Editar** dados do retiro
- **Excluir** retiro

**Como criar um retiro:**
1. Acesse **Retiros**
2. Clique em **Novo Retiro**
3. Preencha: nome, local, datas, custos (adulto/criança), orçamento, vagas
4. Clique em **Salvar**

> 💡 Ao criar um retiro, um projeto financeiro é criado automaticamente para controlar receitas e despesas.

#### 👤 Inscrições
- **Inscrever membro** da igreja (busca integrada)
- **Inscrever visitante** (dados manuais)
- **Definir tipo**: adulto ou criança (custo diferenciado)
- **Aplicar custo personalizado** se necessário
- **Vincular responsável de pagamento** para crianças (o adulto que paga por ela)
- **Isentar** participante do pagamento
- **Editar** dados do participante (nome, tipo, custo, parcelas, ônibus, cama) **sem perder o carnê já lançado**
- **Remover** participante

**Como inscrever um participante:**
1. No retiro, acesse **Participantes**
2. Clique em **Inscrever Participante**
3. Escolha: membro existente ou visitante
4. Defina o tipo (adulto/criança) e número de parcelas
5. **Para crianças**: selecione o **Responsável pelo pagamento** (adulto já inscrito no mesmo retiro — geralmente pai/mãe). A criança **continua contando** nas listas e no dashboard, mas o carnê fica sob responsabilidade do adulto selecionado.
6. Clique em **Confirmar**

**Como editar um participante (sem perder pagamentos já lançados):**
1. Na lista de participantes, clique em **Editar** na linha da pessoa.
2. Ajuste o que precisa (ex.: valor acordado errado, mudar de adulto p/ criança, alterar responsável, número de parcelas).
3. Clique em **Salvar** — o carnê e os pagamentos já registrados são **preservados**.

> 💡 Antes só existia a opção de excluir + reinscrever, o que apagava o carnê. Agora usar **Editar** é o caminho recomendado.

#### 💳 Carnê de Pagamentos
- **Visualizar parcelas** geradas automaticamente
- **Registrar pagamento** de parcela
- **Integração automática**: pagamento gera transação no financeiro

**Como registrar um pagamento:**
1. No participante, acesse **Pagamentos**
2. Localize a parcela pendente
3. Clique em **Confirmar Pagamento**
4. O valor é registrado automaticamente no módulo financeiro

### Fluxo:
```
Retiros
├── Criar Retiro → Projeto Financeiro Auto-criado
├── Dashboard → KPIs (inscritos, arrecadado, orçamento)
├── Participantes
│   ├── Inscrever Membro / Visitante
│   ├── Definir Tipo (Adulto/Criança) e Parcelas
│   ├── Criança → selecionar Responsável (adulto pagante)
│   ├── Editar dados do participante (preserva carnê)
│   └── Isentar do Pagamento
└── Pagamentos
    ├── Carnê Automático
    ├── Registrar Pagamento
    └── Transação Financeira Automática
```

> **👨‍👩‍👧 Como controlar crianças cujos pais pagam a conta**
>
> 1. Inscreva primeiro o **adulto responsável** (pai ou mãe).
> 2. Inscreva a **criança** e selecione esse adulto no campo **Responsável pelo pagamento**.
> 3. A criança aparece normalmente na lista de retirantes (contabilizada para vagas, ônibus, cama, dashboard).
> 4. O carnê da criança é vinculado ao responsável — quando o adulto pagar, o valor da criança pode ser lançado junto no financeiro no mesmo comprovante.
> 5. Se depois quiser trocar o responsável, use **Editar** no participante.

---

## � Módulo Secretaria

### Visão Geral
Agenda de eventos da igreja: cultos, ensaios, reuniões, ações sociais, etc. Calendário visual mensal e cards com horários, responsáveis e observações.

### Funcionalidades:
- **Cadastro de eventos** com título, tipo, datas e horários (início/fim), local, responsável e descrição
- **Calendário mensal** com navegação entre meses, marcando os dias com evento
- **Listagem em lista** com filtros por mês ou tipo
- **Compartilhamento via WhatsApp**: gera mensagem formatada com os detalhes do evento, pronta para enviar
- **Edição/Exclusão** dos eventos cadastrados (apenas papéis com permissão)

### Fluxo:
```
Acessar Secretaria → Adicionar Evento → Preencher dados → Salvar
       ↓
Visualizar no calendário ou na lista
       ↓
Compartilhar no WhatsApp (botão direto no card)
```

---

## 📦 Módulo Patrimônio

### Visão Geral
Controle de **todos os bens físicos da igreja**: equipamentos de som, móveis, instrumentos, eletro/eletrônicos, etc. Permite cadastrar manutenções periódicas, dar baixa em itens danificados/roubados e receber alertas de garantia e revisão.

### Numeração Automática
Cada bem recebe um código no formato **`PAT-0001`**, sequencial e único. O número pode ser **editado** se você precisar manter um padrão antigo.

### Status (cores)
- 🟢 **Ativo em uso** — bem em operação normal
- 🔵 **Ativo / Reserva** — guardado para uso eventual
- 🟠 **Em manutenção** — saiu para conserto
- 🔴 **Baixado / Inativo** — não faz mais parte do patrimônio

### Funcionalidades:

#### 🗂️ Cadastro de bens
- Nº de controle, nome, descrição, **categoria** (editável), **local** (editável + opção *Outro*), valor de aquisição, NF, data de aquisição, garantia
- Intervalo de manutenção em meses (o sistema calcula a próxima data automaticamente)
- **Opcional**: marcar `Lançar saída no Financeiro` durante o cadastro — cria uma transação de Saída no projeto/categoria escolhidos

#### 🛠️ Manutenção
- **Enviar para manutenção**: registra prestador (nome, endereço, telefone, prazo informado) e move o bem para *Em manutenção*
- **Registrar retorno**: data, custo do serviço, garantia da manutenção e status de retorno (Em uso ou Reserva)
- O sistema **recalcula automaticamente** a próxima manutenção a partir da data de retorno
- **Histórico completo**: cada saída/retorno fica registrado com prestador, custo e garantia

#### ⬇️ Baixa
- Botão `Dar baixa` (apenas Pastor / Admin) — escolha o motivo: **Defeito**, **Quebra**, **Roubo**, **Perda** ou **Outro** (com justificativa obrigatória)
- O bem fica marcado como **Baixado/Inativo** e some das listas ativas
- É possível **Reativar** um bem baixado a qualquer momento

#### 🔔 Alertas no Dashboard
- **Manutenções programadas** nos próximos 30 dias
- **Garantias vencendo** nos próximos 30 dias
- **Retornos atrasados** (bens em manutenção há mais tempo que o esperado)

#### ⚙️ Configurações
- `Patrimônio › Configurações`: gerencie as **Categorias** e **Locais** que aparecem nos selects (criar, renomear, inativar, excluir)

### Fluxo Completo:
```
Cadastrar bem → Status: Ativo em uso
       ↓
Enviar para manutenção (registrar prestador) → Status: Em manutenção
       ↓
Registrar retorno (custo + garantia) → Status: Ativo em uso
       ↓
[Próxima manutenção recalculada automaticamente]
       ↓
Quando o bem quebrar/sumir → Dar baixa (motivo)
       ↓
Reativar (se for o caso)
```

---

## 🛒 Módulo de Compras

### Visão Geral
Gestão de **listas de compras** e **pedidos avulsos** para itens que a igreja precisa adquirir. Cada lista pode ser atribuída a um responsável, que recebe **notificação no sino** assim que a atribuição for feita.

### Funcionalidades:
- **Listas de compras**: criar, editar, arquivar, **excluir** e atribuir a um responsável
- **Itens da lista**: adicionar/editar/remover itens (com data desejada de compra)
- **Pedidos avulsos** (compras rápidas): registrar solicitação → aprovação → efetivação (com opção de lançar saída no financeiro automaticamente)
- **Notificações**: sempre que uma lista/pedido é atribuído a alguém, uma notificação vai para o sino do responsável — **inclusive quando você atribui a si mesma**.

### Permissões (matriz de acesso)
O módulo Compras usa permissões granulares. Se você tomar o erro *"Acesso negado. Necessário permissão 'delete' no módulo 'compras'"*, peça ao administrador para marcar a ação **Excluir** na sua linha do módulo Compras:

| Ação | O que libera |
|------|--------------|
| `view` | Ver listas e pedidos |
| `create` | Criar listas, itens e pedidos |
| `edit` | Editar listas, itens e pedidos |
| `delete` | **Excluir** listas, itens e pedidos |
| `approve` | Aprovar pedidos avulsos |

### Fluxo:
```
Compras
├── Listas
│   ├── Criar → Nome + Atribuir Responsável → Salvar (gera notificação no sino)
│   ├── Adicionar Itens (com data desejada)
│   ├── Editar / Arquivar / Excluir
│   └── Marcar itens como comprados
└── Pedidos avulsos
    ├── Solicitar → Aprovar → Efetivar
    └── (Opcional) Lançar saída no Financeiro
```

---

## 🔔 Notificações (Sininho)

### Visão Geral
O **sino** no topo do sistema mostra quantas notificações não lidas você tem. É atualizado automaticamente a cada poucos segundos.

### Quando você recebe notificação:
- Uma **lista de compras** foi atribuída a você (inclusive quando você mesma cria e se atribui).
- Um **pedido de compra** foi atribuído a você.
- Outras atribuições que o sistema começar a suportar no futuro.

### Como usar:
1. Clique no ícone do sino no topo.
2. Veja o painel com as notificações — as não lidas ficam destacadas.
3. Clique em uma notificação para marcá-la como lida individualmente, ou em **Marcar todas como lidas**.

> 💡 Se você criar uma lista e se atribuir, o **badge vermelho** com o número aparece imediatamente após salvar.

---

## 🧹 Ação Administrativa: Limpar Tudo (Reset de Dados)

> ⚠️ **Somente Administrador (super_admin)**. Ação **irreversível** — use somente para preparar o sistema para o "modo produção" (uso oficial), quando quiser apagar todos os dados de teste sem perder usuários e membros cadastrados.

### O que é apagado
- Todas as transações e importações do Financeiro
- Projetos financeiros de teste
- Retiros, participantes e carnês
- Listas de compras, itens e pedidos avulsos
- Itens de patrimônio, manutenções e baixas
- Feedbacks
- Notificações
- Eventos da secretaria

### O que é preservado
- **Usuários** (você e a equipe) — com login, senha e permissões
- **Membros** cadastrados
- **Categorias** padrão do financeiro (recriadas se apagadas)
- **Configurações** do sistema

### Como executar
1. Acesse a rota administrativa (`Administração → Limpar dados` no menu, disponível apenas para super_admin).
2. Digite exatamente a frase de confirmação: **`LIMPAR TUDO`** (em maiúsculas, sem aspas).
3. Confirme.
4. O sistema retorna um relatório com o total apagado por tabela e as contagens preservadas (usuários, membros).

> 🔒 **Em produção**, o reset ainda exige que a variável de ambiente `ALLOW_PROD_RESET=true` esteja configurada no servidor — proteção extra contra disparos acidentais.

---

## �💬 Módulo de Feedback

### Visão Geral
Canal de comunicação para sugestões, reportes de erros e melhorias.

### Funcionalidades:
- **Enviar** sugestão, erro ou melhoria
- **Listar** todos os feedbacks
- **Responder** feedback (administrador)

**Como enviar um feedback:**
1. Acesse **Feedback**
2. Clique em **Novo Feedback**
3. Selecione o tipo (Sugestão, Erro ou Melhoria)
4. Descreva sua mensagem
5. Clique em **Enviar**

### Fluxo:
```
Feedback
├── Enviar → Tipo + Mensagem → Salvar
├── Listar → Ver Status (Pendente / Respondido)
└── Responder (Admin) → Escrever Resposta → Salvar
```

---

## 🛡️ Gestão de Usuários (Administrador)

### Visão Geral
Módulo exclusivo do administrador para gerenciar quem acessa o sistema.

### Funcionalidades:
- **Listar** todos os usuários
- **Criar** novo usuário com senha e perfil
- **Editar** dados e permissões
- **Ativar/Desativar** usuário
- **Redefinir senha**
- **Excluir** usuário
- **Configurar permissões granulares** por módulo

**Como criar um usuário:**
1. Acesse **Usuários**
2. Clique em **Novo Usuário**
3. Preencha: nome, email, senha
4. Selecione o grupo de acesso (papel)
5. Opcionalmente personalize as permissões na matriz
6. Clique em **Criar**

**Como personalizar permissões:**
1. Na edição do usuário, encontre a **Matriz de Permissões**
2. Para cada módulo, marque/desmarque as ações desejadas:
   - ✅ Visualizar
   - ✅ Criar
   - ✅ Editar
   - ✅ Excluir
3. Salve as alterações

### Fluxo:
```
Gestão de Usuários
├── Criar → Nome + Email + Senha + Papel → Salvar
├── Editar → Alterar Dados + Permissões → Salvar
├── Ativar/Desativar → Toggle Status
├── Redefinir Senha → Nova Senha → Confirmar
└── Excluir → Confirmação → Remover
```

---

## 📌 Resumo por Perfil — O que posso fazer?

### 🔴 Administrador (super_admin)
- ✅ Tudo nos módulos: Dashboard, Financeiro, Membros, Retiros, Feedback
- ✅ Criar, editar e excluir usuários
- ✅ Personalizar permissões de qualquer usuário
- ✅ Responder feedbacks

### 🟠 Pastor
- ✅ Ver Dashboard com gráficos
- ✅ Ver e criar lançamentos financeiros
- ✅ Ver membros e retiros
- ✅ Enviar feedbacks
- ❌ Não gerencia usuários

### 🟡 Financeiro
- ✅ Controle total do módulo financeiro (criar, editar, excluir)
- ✅ Importar extratos OFX/CSV
- ✅ Ver membros
- ✅ Enviar feedbacks
- ❌ Não acessa retiros
- ❌ Não gerencia usuários

### 🟢 Secretaria
- ✅ Controle total de membros (cadastrar, editar, excluir)
- ✅ Controle de retiros (criar, inscrever, pagamentos)
- ✅ Enviar feedbacks
- ❌ Não acessa financeiro
- ❌ Não gerencia usuários

### 🔵 Visualizador (viewer)
- ✅ Consultar informações em todos os módulos
- ❌ Não pode criar, editar ou excluir nada

---

## ❓ Dúvidas Frequentes

**P: Esqueci minha senha, o que faço?**
R: Peça ao administrador para redefinir sua senha em Gestão de Usuários.

**P: Não consigo acessar um módulo, por quê?**
R: Seu perfil pode não ter permissão. Fale com o administrador.

**P: Como saber se uma importação tem duplicidade?**
R: Na tela de pré-visualização, itens duplicados são destacados em amarelo. Existe duplicidade **forte** (bank_reference igual OU valor+data+descrição igual — o sistema bloqueia) e **fraca** (valor+tipo+±3 dias com descrição diferente — o sistema pergunta se você quer importar mesmo assim, típico quando você lançou manualmente como Confirmado antes do OFX chegar).

**P: O pagamento do retiro aparece no financeiro?**
R: Sim! Ao confirmar um pagamento no carnê, uma transação de entrada é criada automaticamente.

**P: Posso personalizar as categorias financeiras?**
R: Sim, no módulo Financeiro → Categorias você pode criar novas categorias.

**P: Como cobrar o pagamento das crianças, se quem paga é o pai/mãe?**
R: Inscreva primeiro o adulto responsável, depois inscreva a criança marcando o adulto no campo **Responsável pelo pagamento**. A criança continua na lista e no dashboard, mas o carnê é vinculado ao adulto. Veja detalhes em [Módulo de Retiros → Como controlar crianças cujos pais pagam a conta](#-módulo-de-retiros).

**P: Errei o valor acordado com um participante do retiro, tenho que excluir e cadastrar de novo?**
R: Não. Use o botão **Editar** na linha do participante — o carnê e pagamentos já registrados são preservados.

**P: Recebi um aviso de "Acesso negado. Necessário permissão 'delete' no módulo 'compras'", o que faço?**
R: Seu usuário não tem a ação **Excluir** habilitada no módulo Compras. Peça ao administrador para marcar essa permissão na sua matriz (Usuários → seu nome → Editar → módulo Compras → ✅ Excluir).

**P: Atribuí uma lista de compras a mim mesma e o sino não sinalizou. É bug?**
R: Era bug — corrigido. Hoje o sino mostra o badge vermelho imediatamente, inclusive quando você mesma cria e se atribui. Se não estiver aparecendo, atualize a página (F5) para carregar a versão nova.

**P: Se eu lançar um pagamento como Confirmado manualmente e depois importar o OFX com essa mesma linha, vai duplicar?**
R: Não deveria. O sistema detecta "possível duplicidade" quando bate valor + tipo + ±3 dias, mesmo que a descrição do banco seja diferente da que você digitou. Você decide na pré-visualização se aceita ou descarta. **Recomendado:** lançar como Previsto e deixar o OFX confirmar — evita a decisão manual.

**P: Quero começar a usar o sistema "pra valer" — como limpo os dados de teste sem perder os usuários?**
R: O administrador tem uma ação **Limpar Tudo** que apaga transações, retiros, compras, patrimônio, feedbacks e notificações, mas **preserva usuários, membros e categorias**. Veja [Ação Administrativa: Limpar Tudo](#-ação-administrativa-limpar-tudo-reset-de-dados).
