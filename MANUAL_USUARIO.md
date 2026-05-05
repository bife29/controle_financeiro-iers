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
- **Isentar** participante do pagamento
- **Remover** participante

**Como inscrever um participante:**
1. No retiro, acesse **Participantes**
2. Clique em **Inscrever Participante**
3. Escolha: membro existente ou visitante
4. Defina o tipo (adulto/criança) e número de parcelas
5. Clique em **Confirmar**

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
│   ├── Definir Tipo e Parcelas
│   └── Isentar do Pagamento
└── Pagamentos
    ├── Carnê Automático
    ├── Registrar Pagamento
    └── Transação Financeira Automática
```

---

## 💬 Módulo de Feedback

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
R: Na tela de pré-visualização, itens duplicados são destacados em amarelo.

**P: O pagamento do retiro aparece no financeiro?**
R: Sim! Ao confirmar um pagamento no carnê, uma transação de entrada é criada automaticamente.

**P: Posso personalizar as categorias financeiras?**
R: Sim, no módulo Financeiro → Categorias você pode criar novas categorias.
