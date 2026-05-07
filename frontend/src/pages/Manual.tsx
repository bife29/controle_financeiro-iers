import { useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import {
  BookOpen, LayoutDashboard, DollarSign, Users, Mountain,
  MessageSquare, ShieldCheck, ChevronDown, ChevronRight,
  ArrowRight, LogIn, HelpCircle, Calendar, Package
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Section = 'inicio' | 'dashboard' | 'financeiro' | 'membros' | 'retiros' | 'secretaria' | 'patrimonio' | 'feedback' | 'usuarios' | 'perfis' | 'faq'

const sections = [
  { id: 'inicio' as Section, name: 'Início', icon: BookOpen },
  { id: 'dashboard' as Section, name: 'Dashboard', icon: LayoutDashboard },
  { id: 'financeiro' as Section, name: 'Financeiro', icon: DollarSign },
  { id: 'membros' as Section, name: 'Membros', icon: Users },
  { id: 'retiros' as Section, name: 'Retiros', icon: Mountain },
  { id: 'secretaria' as Section, name: 'Secretaria', icon: Calendar },
  { id: 'patrimonio' as Section, name: 'Patrimônio', icon: Package },
  { id: 'feedback' as Section, name: 'Feedback', icon: MessageSquare },
  { id: 'usuarios' as Section, name: 'Usuários', icon: ShieldCheck },
  { id: 'perfis' as Section, name: 'Meu Perfil', icon: LogIn },
  { id: 'faq' as Section, name: 'Dúvidas', icon: HelpCircle },
]

function FlowStep({ steps, color = 'blue' }: { steps: string[]; color?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 my-4">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium border shadow-sm",
            color === 'blue' && "bg-blue-50 border-blue-200 text-blue-800",
            color === 'green' && "bg-green-50 border-green-200 text-green-800",
            color === 'amber' && "bg-amber-50 border-amber-200 text-amber-800",
            color === 'purple' && "bg-purple-50 border-purple-200 text-purple-800",
          )}>
            {step}
          </div>
          {i < steps.length - 1 && (
            <ArrowRight className={cn(
              "w-4 h-4 shrink-0",
              color === 'blue' && "text-blue-400",
              color === 'green' && "text-green-400",
              color === 'amber' && "text-amber-400",
              color === 'purple' && "text-purple-400",
            )} />
          )}
        </div>
      ))}
    </div>
  )
}

function FlowTree({ items }: { items: { label: string; children?: string[] }[] }) {
  return (
    <div className="my-4 pl-2 space-y-2">
      {items.map((item, i) => (
        <div key={i}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="font-medium text-sm text-blue-900">{item.label}</span>
          </div>
          {item.children && (
            <div className="ml-5 mt-1 space-y-1 border-l-2 border-blue-100 pl-4">
              {item.children.map((child, j) => (
                <div key={j} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />
                  <span className="text-sm text-gray-600">{child}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
      >
        <span className="text-sm font-medium">{title}</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && <div className="px-4 py-3 text-sm text-gray-700 space-y-3">{children}</div>}
    </div>
  )
}

// ============ SECTION CONTENT ============

function SectionInicio() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Bem-vindo ao Manual do Sistema IERS</h2>
        <p className="text-muted-foreground mt-2">
          Este manual explica todas as funcionalidades do sistema. Use o menu ao lado para navegar entre os módulos.
        </p>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-3">🔐 Como acessar o sistema</h3>
        <FlowStep steps={['Abrir navegador', 'Digitar email', 'Digitar senha', 'Clicar em Entrar']} />
        <p className="text-sm text-blue-700 mt-2">
          💡 Caso esqueça a senha, solicite ao administrador a redefinição.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { icon: LayoutDashboard, name: 'Dashboard', desc: 'Resumo geral com KPIs e gráficos', color: 'bg-blue-500' },
          { icon: DollarSign, name: 'Financeiro', desc: 'Transações, projetos, categorias, importação', color: 'bg-green-500' },
          { icon: Users, name: 'Membros', desc: 'Cadastro completo com 30+ campos', color: 'bg-purple-500' },
          { icon: Mountain, name: 'Retiros', desc: 'Inscrições, carnê e pagamentos', color: 'bg-amber-500' },
          { icon: MessageSquare, name: 'Feedback', desc: 'Sugestões, erros e melhorias', color: 'bg-rose-500' },
          { icon: ShieldCheck, name: 'Usuários', desc: 'Gestão de acessos e permissões', color: 'bg-indigo-500' },
        ].map((m) => (
          <div key={m.name} className="bg-card border rounded-xl p-4 flex items-start gap-3">
            <div className={cn("p-2 rounded-lg text-white", m.color)}>
              <m.icon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">{m.name}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">📊 Dashboard</h2>
        <p className="text-muted-foreground mt-1">Visão geral do sistema com indicadores financeiros e gráficos.</p>
      </div>

      <div className="bg-card border rounded-xl p-5 space-y-4">
        <h3 className="font-semibold">O que você encontra:</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Total de Entradas', desc: 'Soma de todas as receitas' },
            { label: 'Total de Saídas', desc: 'Soma de todas as despesas' },
            { label: 'Saldo', desc: 'Diferença entre entradas e saídas' },
            { label: 'Membros Ativos', desc: 'Quantidade de membros cadastrados' },
          ].map((item) => (
            <div key={item.label} className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-sm">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border rounded-xl p-5">
        <h3 className="font-semibold mb-2">Gráficos disponíveis:</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-500" /> Entradas vs Saídas — comparativo mensal (barras)</li>
          <li className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-blue-500" /> Distribuição por Projeto — pizza com percentuals</li>
        </ul>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-semibold text-blue-900 mb-2">Fluxo de uso:</h3>
        <FlowStep steps={['Fazer Login', 'Dashboard carrega automaticamente', 'Visualizar KPIs', 'Analisar gráficos']} />
      </div>
    </div>
  )
}

function SectionFinanceiro() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">💰 Módulo Financeiro</h2>
        <p className="text-muted-foreground mt-1">Controle todas as movimentações financeiras da igreja.</p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-5">
        <h3 className="font-semibold text-green-900 mb-2">Estrutura do módulo:</h3>
        <FlowTree items={[
          { label: 'Hub Financeiro', children: ['KPIs gerais', 'Acesso rápido aos sub-módulos'] },
          { label: 'Transações', children: ['Listar com filtros', 'Criar entrada/saída', 'Editar', 'Excluir'] },
          { label: 'Projetos', children: ['Listar projetos', 'Criar projeto', 'Dashboard do projeto', 'Editar'] },
          { label: 'Categorias', children: ['Listar por tipo', 'Criar nova categoria'] },
          { label: 'Importação', children: ['Upload OFX/CSV', 'Pré-visualização', 'Detecção de duplicidade', 'Confirmar importação'] },
        ]} />
      </div>

      <Accordion title="📋 Como criar uma transação" defaultOpen>
        <FlowStep steps={['Financeiro', 'Transações', 'Nova Transação', 'Preencher dados', 'Salvar']} color="green" />
        <div className="bg-white border rounded-lg p-4 mt-3 space-y-2">
          <p className="font-medium text-sm">Campos do formulário:</p>
          <ul className="grid grid-cols-2 gap-1 text-xs text-gray-600">
            <li>• Tipo (Entrada / Saída)</li>
            <li>• Data</li>
            <li>• Valor</li>
            <li>• Descrição</li>
            <li>• Projeto (obrigatório)</li>
            <li>• Categoria</li>
            <li>• Forma de pagamento</li>
            <li>• Status (Previsto / Confirmado)</li>
          </ul>
          <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2 text-xs text-blue-800">
            <p><strong>Previsto</strong>: promessa/compromisso futuro — NÃO conta no caixa real, aparece nas previsões.</p>
            <p><strong>Confirmado</strong>: dinheiro que entrou ou saiu de fato — entra no caixa real e nos relatórios.</p>
            <p className="mt-1">Você pode dar baixa em um Previsto pelo botão "Confirmar" da listagem (informa a data do pagamento).</p>
          </div>
        </div>
      </Accordion>

      <Accordion title="📁 Como criar um projeto">
        <FlowStep steps={['Financeiro', 'Projetos', 'Novo Projeto', 'Preencher dados', 'Salvar']} color="green" />
        <p className="text-sm">Campos: nome, descrição, data início/fim, meta financeira.</p>
        <p className="text-sm mt-2 text-green-700">💡 Projetos agrupam transações e permitem acompanhar metas.</p>
      </Accordion>

      <Accordion title="📥 Como importar um extrato bancário">
        <FlowStep steps={['Financeiro', 'Importação', 'Selecionar projeto', 'Escolher arquivo', 'Processar', 'Revisar', 'Confirmar']} color="green" />
        <div className="bg-amber-50 border border-amber-200 rounded p-3 mt-2">
          <p className="text-xs font-medium text-amber-800">⚠️ Dica importante:</p>
          <p className="text-xs text-amber-700">Transações duplicadas são destacadas em amarelo na pré-visualização. Revise antes de confirmar!</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-2 text-xs text-blue-800">
          <p className="font-medium">A importação separa as linhas em 4 grupos automaticamente:</p>
          <ul className="list-disc ml-4 mt-1 space-y-0.5">
            <li><strong>Novas</strong>: serão criadas como Confirmadas.</li>
            <li><strong>Confirmam previstos</strong>: bateram exatamente com um Previsto (mesmo valor, ±3 dias). O Previsto vira Confirmado, sem duplicar.</li>
            <li><strong>Decisões necessárias</strong>: mais de um Previsto bate com a mesma linha — você escolhe qual.</li>
            <li><strong>Duplicadas</strong>: já existem no sistema — você decide ignorar ou importar mesmo assim.</li>
          </ul>
          <p className="mt-1">A janela de ±3 dias acomoda lançamentos do Santander que pulam fim de semana.</p>
        </div>
      </Accordion>

      <Accordion title="🏷️ Como criar uma categoria">
        <FlowStep steps={['Financeiro', 'Categorias', 'Preencher formulário no topo', 'Criar']} color="green" />
        <p className="text-sm">Defina: nome, tipo (Entrada ou Saída) e natureza (Fixa ou Variável).</p>
      </Accordion>
    </div>
  )
}

function SectionMembros() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">👥 Módulo de Membros</h2>
        <p className="text-muted-foreground mt-1">Cadastro e gestão completa dos membros da igreja.</p>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
        <h3 className="font-semibold text-purple-900 mb-2">Fluxo principal:</h3>
        <FlowTree items={[
          { label: 'Lista de Membros', children: ['Buscar por nome/CPF/celular', 'Filtrar ativo/inativo'] },
          { label: 'Cadastrar Membro', children: ['Dados pessoais', 'Endereço', 'Contato', 'Dados eclesiásticos'] },
          { label: 'Ficha do Membro', children: ['Visualizar todos os dados', 'Editar informações'] },
        ]} />
      </div>

      <Accordion title="Como cadastrar um novo membro" defaultOpen>
        <FlowStep steps={['Membros', 'Novo Membro', 'Preencher formulário', 'Salvar']} color="purple" />
        <p className="text-sm mt-2">O nome completo é obrigatório. Todos os demais campos são opcionais.</p>
        <div className="bg-white border rounded-lg p-4 mt-3 space-y-2">
          <p className="font-medium text-sm">Campos disponíveis (30+):</p>
          <ul className="grid grid-cols-2 gap-1 text-xs text-gray-600">
            <li>• Nome completo</li>
            <li>• Nº da ficha</li>
            <li>• CPF / RG</li>
            <li>• Data de nascimento</li>
            <li>• Celular / Telefone</li>
            <li>• Email</li>
            <li>• Endereço completo</li>
            <li>• Estado civil</li>
            <li>• Profissão</li>
            <li>• Data de batismo</li>
            <li>• Cargo na igreja</li>
            <li>• Observações</li>
          </ul>
        </div>
      </Accordion>

      <Accordion title="Como buscar um membro">
        <FlowStep steps={['Membros', 'Digitar no campo de busca', 'Resultados filtrados']} color="purple" />
        <p className="text-sm">Você pode buscar por <strong>nome</strong>, <strong>CPF</strong> ou <strong>celular</strong>.</p>
      </Accordion>
    </div>
  )
}

function SectionRetiros() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">⛰️ Módulo de Retiros</h2>
        <p className="text-muted-foreground mt-1">Gestão completa de retiros, inscrições e pagamentos.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h3 className="font-semibold text-amber-900 mb-2">Fluxo completo:</h3>
        <FlowTree items={[
          { label: 'Criar Retiro', children: ['Define custos, datas, vagas', 'Projeto financeiro criado automaticamente'] },
          { label: 'Dashboard do Retiro', children: ['KPIs: inscritos, arrecadado, orçamento', 'Composição: adultos/crianças/isentos'] },
          { label: 'Inscrições', children: ['Membro da igreja (busca integrada)', 'Visitante (manual)', 'Tipo: adulto ou criança', 'Custo personalizado', 'Isenção'] },
          { label: 'Pagamentos', children: ['Carnê gerado automaticamente', 'Parcelas com vencimento mensal', 'Registrar pagamento → gera transação financeira'] },
        ]} />
      </div>

      <Accordion title="Como criar um retiro" defaultOpen>
        <FlowStep steps={['Retiros', 'Novo Retiro', 'Preencher dados', 'Salvar']} color="amber" />
        <div className="bg-white border rounded-lg p-4 mt-3 space-y-2">
          <p className="font-medium text-sm">Campos:</p>
          <ul className="grid grid-cols-2 gap-1 text-xs text-gray-600">
            <li>• Nome do retiro</li>
            <li>• Local</li>
            <li>• Data início / fim</li>
            <li>• Custo adulto</li>
            <li>• Custo criança</li>
            <li>• Orçamento total</li>
            <li>• Número de vagas</li>
          </ul>
        </div>
        <p className="text-sm text-amber-700 mt-2">💡 Um projeto financeiro é criado automaticamente junto com o retiro!</p>
      </Accordion>

      <Accordion title="Como inscrever participantes">
        <FlowStep steps={['Retiro', 'Participantes', 'Inscrever', 'Escolher tipo', 'Definir parcelas', 'Confirmar']} color="amber" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div className="bg-white border rounded-lg p-3">
            <p className="font-medium text-sm text-amber-800">Membro da Igreja</p>
            <p className="text-xs text-gray-600 mt-1">Busca integrada — selecione da lista de membros cadastrados.</p>
          </div>
          <div className="bg-white border rounded-lg p-3">
            <p className="font-medium text-sm text-amber-800">Visitante</p>
            <p className="text-xs text-gray-600 mt-1">Informe os dados manualmente (nome, contato).</p>
          </div>
        </div>
      </Accordion>

      <Accordion title="Como registrar pagamentos no carnê">
        <FlowStep steps={['Participante', 'Pagamentos', 'Localizar parcela', 'Confirmar Pagamento']} color="amber" />
        <div className="bg-green-50 border border-green-200 rounded p-3 mt-2">
          <p className="text-xs font-medium text-green-800">✅ Integração automática:</p>
          <p className="text-xs text-green-700">Ao confirmar o pagamento, uma <strong>transação de Entrada</strong> é criada automaticamente no módulo Financeiro.</p>
        </div>
      </Accordion>
    </div>
  )
}

function SectionSecretaria() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">📅 Módulo de Secretaria</h2>
        <p className="text-muted-foreground mt-1">Calendário de eventos, modelos de mensagem, grupos de WhatsApp e configurações.</p>
      </div>

      <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-5">
        <h3 className="font-semibold text-cyan-900 mb-2">O que você pode fazer aqui:</h3>
        <ul className="space-y-1 text-sm text-cyan-800">
          <li>• Visualizar <strong>aniversariantes do mês</strong> e eventos no calendário</li>
          <li>• Cadastrar <strong>eventos</strong> da igreja (cultos, ensaios, encontros)</li>
          <li>• Manter <strong>modelos de mensagem</strong> reutilizáveis para WhatsApp</li>
          <li>• Cadastrar <strong>grupos de WhatsApp</strong> dos departamentos / ministérios</li>
          <li>• Compartilhar avisos com alguns cliques (link wa.me)</li>
        </ul>
      </div>

      <Accordion title="📆 Calendário: aniversariantes e eventos" defaultOpen>
        <FlowStep steps={['Secretaria', 'Calendário', 'Navegar pelos meses', 'Clicar em um dia']} color="blue" />
        <p className="text-sm mt-2">Cada dia mostra:</p>
        <ul className="text-xs text-gray-600 list-disc ml-5 mt-1">
          <li>🎂 Aniversariantes (membros) com indicação por faixa etária</li>
          <li>📅 Eventos cadastrados naquela data</li>
        </ul>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2 text-xs text-blue-800">
          <p>Clique em um dia para abrir os detalhes (lista de aniversariantes com idade e telefone) e enviar a mensagem de parabéns rapidamente.</p>
        </div>
      </Accordion>

      <Accordion title="📅 Como cadastrar um evento">
        <FlowStep steps={['Secretaria', 'Eventos', 'Novo evento', 'Preencher dados', 'Salvar']} color="green" />
        <p className="text-sm mt-2">Campos: <strong>título, data, tipo, local, descrição</strong>.</p>
        <p className="text-sm mt-2">Eventos aparecem no calendário e podem ser compartilhados via WhatsApp pelo botão 💬 da listagem.</p>
      </Accordion>

      <Accordion title="💬 Modelos de mensagem para WhatsApp">
        <FlowStep steps={['Secretaria', 'Modelos', 'Novo modelo', 'Escolher tipo', 'Escrever texto', 'Salvar']} color="purple" />
        <p className="text-sm mt-2">Tipos disponíveis: <strong>aniversariante, evento, aviso geral, convite</strong> etc.</p>
        <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2 text-xs text-amber-800">
          <p>✨ Marque um modelo como <strong>padrão</strong> (⭐) para que ele venha pré-selecionado quando você for compartilhar uma mensagem do tipo correspondente.</p>
        </div>
        <p className="text-xs text-gray-600 mt-2">Variáveis suportadas no texto: <code>{'{nome}'}</code>, <code>{'{idade}'}</code>, <code>{'{evento}'}</code>, <code>{'{data}'}</code>, <code>{'{local}'}</code>.</p>
      </Accordion>

      <Accordion title="👥 Grupos de WhatsApp">
        <FlowStep steps={['Secretaria', 'Grupos WhatsApp', 'Novo grupo', 'Nome + link convite', 'Salvar']} color="green" />
        <p className="text-sm mt-2">Cadastre os grupos da igreja (ex.: <em>Diretoria, Louvor, Jovens, Mães</em>) com o link de convite. Eles ficam disponíveis na hora de compartilhar avisos.</p>
      </Accordion>

      <Accordion title="⚙️ Configurações">
        <FlowStep steps={['Secretaria', 'Configurações', 'Editar dados', 'Salvar']} color="amber" />
        <ul className="text-xs text-gray-600 list-disc ml-5 mt-1">
          <li>Telefone da secretaria (assinatura nas mensagens)</li>
          <li>Nome da igreja</li>
          <li>Antecedência (dias) dos lembretes de eventos</li>
        </ul>
      </Accordion>
    </div>
  )
}

function SectionPatrimonio() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">📦 Módulo de Patrimônio</h2>
        <p className="text-muted-foreground mt-1">Controle dos bens da igreja: cadastro, manutenção, baixa e relatórios.</p>
      </div>

      <div className="bg-stone-50 border border-stone-200 rounded-xl p-5">
        <h3 className="font-semibold text-stone-900 mb-2">O que você pode fazer:</h3>
        <ul className="space-y-1 text-sm text-stone-800">
          <li>• Cadastrar bens (móveis, equipamentos de som, instrumentos, eletrônicos)</li>
          <li>• Anexar foto e nota fiscal de cada bem</li>
          <li>• Registrar manutenções (envio e retorno) com prestador, custo e garantia</li>
          <li>• Dar <strong>baixa</strong> de um item (perda, doação, descarte)</li>
          <li>• Visualizar dashboard com totais por categoria, local e situação</li>
        </ul>
      </div>

      <Accordion title="📝 Como cadastrar um bem" defaultOpen>
        <FlowStep steps={['Patrimônio', 'Bens', 'Novo bem', 'Preencher dados', 'Salvar']} color="green" />
        <p className="text-sm mt-2">Campos principais: <strong>nome, categoria, local, valor de aquisição, data, número de série, observações</strong>.</p>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2 text-xs text-blue-800">
          <p>Você pode anexar <strong>foto</strong> e <strong>nota fiscal</strong> (PDF/imagem). Cada bem recebe um código único.</p>
        </div>
      </Accordion>

      <Accordion title="🔧 Como registrar manutenção">
        <FlowStep steps={['Patrimônio', 'Bem', 'Detalhe', 'Nova manutenção', 'Preencher e salvar']} color="amber" />
        <p className="text-sm mt-2">Ao enviar para manutenção informe: <strong>prestador, motivo, data de envio</strong>. O status do bem muda para <em>"Em manutenção"</em>.</p>
        <p className="text-sm mt-2">Quando voltar, registre o <strong>retorno</strong>: data, custo do serviço, garantia e novo status (Em uso ou Reserva).</p>
        <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2 text-xs text-amber-800">
          <p>💰 O custo da manutenção pode opcionalmente gerar uma <strong>transação de Saída</strong> no Financeiro (configurável ao registrar).</p>
        </div>
      </Accordion>

      <Accordion title="📂 Categorias e locais">
        <FlowStep steps={['Patrimônio', 'Configurações', 'Categorias / Locais', 'Adicionar']} color="blue" />
        <p className="text-sm mt-2">Antes de cadastrar bens, defina:</p>
        <ul className="text-xs text-gray-600 list-disc ml-5 mt-1">
          <li><strong>Categorias</strong>: Som, Instrumentos, Móveis, Eletrônicos, Outros</li>
          <li><strong>Locais</strong>: Templo, Salão, Secretaria, EBD, Cozinha</li>
        </ul>
      </Accordion>

      <Accordion title="🗑️ Dar baixa em um bem">
        <FlowStep steps={['Bem', 'Detalhe', 'Dar baixa', 'Motivo + observação', 'Confirmar']} color="purple" />
        <p className="text-sm mt-2">Use a baixa quando o bem foi <strong>perdido, doado, vendido ou descartado</strong>. O histórico permanece consultável; o item só some dos relatórios de "Em uso".</p>
        <p className="text-sm mt-2">Para reverter, abra o bem e clique em <strong>Reativar</strong>.</p>
      </Accordion>

      <Accordion title="📊 Dashboard">
        <p className="text-sm">Mostra totais de bens por:</p>
        <ul className="text-xs text-gray-600 list-disc ml-5 mt-1">
          <li>Categoria (gráfico)</li>
          <li>Local (lista)</li>
          <li>Status (Em uso / Em manutenção / Reserva / Baixado)</li>
          <li>Valor total do patrimônio (somatório das aquisições)</li>
        </ul>
      </Accordion>
    </div>
  )
}

function SectionFeedback() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">💬 Módulo de Feedback</h2>
        <p className="text-muted-foreground mt-1">Canal de comunicação para sugestões, erros e melhorias.</p>
      </div>

      <div className="bg-rose-50 border border-rose-200 rounded-xl p-5">
        <h3 className="font-semibold text-rose-900 mb-2">Fluxo:</h3>
        <FlowStep steps={['Feedback', 'Novo Feedback', 'Selecionar tipo', 'Escrever mensagem', 'Enviar']} color="purple" />
      </div>

      <Accordion title="Tipos de feedback" defaultOpen>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-blue-50 border rounded-lg p-3 text-center">
            <p className="font-medium text-sm text-blue-800">💡 Sugestão</p>
            <p className="text-xs text-blue-600 mt-1">Ideias para melhorias</p>
          </div>
          <div className="bg-red-50 border rounded-lg p-3 text-center">
            <p className="font-medium text-sm text-red-800">🐛 Erro</p>
            <p className="text-xs text-red-600 mt-1">Reportar problemas</p>
          </div>
          <div className="bg-green-50 border rounded-lg p-3 text-center">
            <p className="font-medium text-sm text-green-800">🚀 Melhoria</p>
            <p className="text-xs text-green-600 mt-1">Aprimoramentos</p>
          </div>
        </div>
      </Accordion>

      <p className="text-sm text-gray-600">
        Após enviar, o administrador poderá responder. Verifique o status do seu feedback na lista (Pendente ou Respondido).
      </p>
    </div>
  )
}

function SectionUsuarios() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">🛡️ Gestão de Usuários</h2>
        <p className="text-muted-foreground mt-1">Módulo exclusivo do administrador para gerenciar acessos.</p>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
        <h3 className="font-semibold text-indigo-900 mb-2">Funcionalidades:</h3>
        <FlowTree items={[
          { label: 'Criar Usuário', children: ['Nome, email, senha, papel'] },
          { label: 'Editar Usuário', children: ['Alterar dados', 'Configurar permissões granulares'] },
          { label: 'Ativar / Desativar', children: ['Bloquear acesso sem excluir'] },
          { label: 'Redefinir Senha', children: ['Definir nova senha para o usuário'] },
          { label: 'Excluir', children: ['Remover permanentemente'] },
        ]} />
      </div>

      <Accordion title="Como configurar permissões granulares" defaultOpen>
        <FlowStep steps={['Usuários', 'Editar usuário', 'Matriz de Permissões', 'Marcar ações', 'Salvar']} color="blue" />
        <div className="bg-white border rounded-lg p-4 mt-3">
          <p className="font-medium text-sm mb-3">Matriz de Permissões (Módulo × Ação):</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Módulo</th>
                  <th className="text-center px-2">Visualizar</th>
                  <th className="text-center px-2">Criar</th>
                  <th className="text-center px-2">Editar</th>
                  <th className="text-center px-2">Excluir</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                {['Dashboard', 'Financeiro', 'Membros', 'Retiros', 'Feedback', 'Usuários'].map((mod) => (
                  <tr key={mod} className="border-b">
                    <td className="py-2 pr-4 font-medium">{mod}</td>
                    <td className="text-center">☑️</td>
                    <td className="text-center">{mod === 'Dashboard' ? '—' : '☑️'}</td>
                    <td className="text-center">{mod === 'Dashboard' ? '—' : '☑️'}</td>
                    <td className="text-center">{mod === 'Dashboard' ? '—' : '☑️'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Accordion>
    </div>
  )
}

function SectionPerfis() {
  const user = useAuthStore((s) => s.user)

  const permsTable = [
    { module: 'Dashboard', admin: [true], pastor: [true], financeiro: [true], secretaria: [true], viewer: [true] },
    { module: 'Financeiro', admin: [true, true, true, true], pastor: [true, true, false, false], financeiro: [true, true, true, true], secretaria: [false, false, false, false], viewer: [true, false, false, false] },
    { module: 'Membros', admin: [true, true, true, true], pastor: [true, false, false, false], financeiro: [true, false, false, false], secretaria: [true, true, true, true], viewer: [true, false, false, false] },
    { module: 'Retiros', admin: [true, true, true, true], pastor: [true, false, false, false], financeiro: [true, false, false, false], secretaria: [true, true, true, false], viewer: [true, false, false, false] },
    { module: 'Feedback', admin: [true, true, true, true], pastor: [true, true, false, false], financeiro: [true, true, false, false], secretaria: [true, true, false, false], viewer: [true, false, false, false] },
    { module: 'Usuários', admin: [true, true, true, true], pastor: [false, false, false, false], financeiro: [false, false, false, false], secretaria: [false, false, false, false], viewer: [false, false, false, false] },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">👤 Perfis de Acesso</h2>
        <p className="text-muted-foreground mt-1">
          Seu perfil atual: <span className="font-semibold capitalize">{user?.role?.replace('_', ' ') || 'N/A'}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { role: 'Administrador', color: 'border-red-200 bg-red-50', desc: 'Acesso total + gestão de usuários', emoji: '🔴' },
          { role: 'Pastor', color: 'border-orange-200 bg-orange-50', desc: 'Visualiza tudo + cria lançamentos', emoji: '🟠' },
          { role: 'Financeiro', color: 'border-yellow-200 bg-yellow-50', desc: 'Controle total do financeiro', emoji: '🟡' },
          { role: 'Secretaria', color: 'border-green-200 bg-green-50', desc: 'Membros e Retiros completo', emoji: '🟢' },
          { role: 'Visualizador', color: 'border-blue-200 bg-blue-50', desc: 'Somente consulta', emoji: '🔵' },
        ].map((r) => (
          <div key={r.role} className={cn("border rounded-xl p-4", r.color)}>
            <p className="font-semibold">{r.emoji} {r.role}</p>
            <p className="text-sm text-gray-600 mt-1">{r.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-xl p-5 overflow-x-auto">
        <h3 className="font-semibold mb-4">Matriz completa de permissões:</h3>
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4">Módulo</th>
              <th className="text-center px-3">Admin</th>
              <th className="text-center px-3">Pastor</th>
              <th className="text-center px-3">Financeiro</th>
              <th className="text-center px-3">Secretaria</th>
              <th className="text-center px-3">Viewer</th>
            </tr>
          </thead>
          <tbody>
            {permsTable.map((row) => (
              <tr key={row.module} className="border-b">
                <td className="py-2 pr-4 font-medium">{row.module}</td>
                {['admin', 'pastor', 'financeiro', 'secretaria', 'viewer'].map((role) => {
                  const perms = row[role as keyof typeof row] as boolean[]
                  const hasAny = perms.some(Boolean)
                  const hasFull = perms.every(Boolean)
                  return (
                    <td key={role} className="text-center">
                      {hasFull ? <span className="text-green-600 font-bold">Total</span>
                        : hasAny ? <span className="text-amber-600">Parcial</span>
                        : <span className="text-red-400">—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SectionFAQ() {
  const faqs = [
    { q: 'Esqueci minha senha, o que faço?', a: 'Peça ao administrador para redefinir sua senha em Gestão de Usuários.' },
    { q: 'Não consigo acessar um módulo, por quê?', a: 'Seu perfil pode não ter permissão para aquele módulo. Fale com o administrador.' },
    { q: 'Como saber se uma importação tem duplicidade?', a: 'Na tela de pré-visualização, transações duplicadas são destacadas em amarelo.' },
    { q: 'O pagamento do retiro aparece no financeiro?', a: 'Sim! Ao confirmar um pagamento no carnê, uma transação de entrada é criada automaticamente no módulo financeiro.' },
    { q: 'Posso personalizar as categorias financeiras?', a: 'Sim, no módulo Financeiro → Categorias você pode criar novas categorias de Entrada ou Saída.' },
    { q: 'Como alterar meu papel/permissões?', a: 'Somente o administrador pode alterar perfis e permissões. Solicite a alteração a ele.' },
    { q: 'O que acontece quando desativo um usuário?', a: 'O usuário não consegue mais fazer login, mas seus dados são mantidos no sistema.' },
    { q: 'Posso usar o sistema no celular?', a: 'Sim! O sistema é responsivo e funciona em smartphones e tablets.' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">❓ Dúvidas Frequentes</h2>
        <p className="text-muted-foreground mt-1">Respostas para as perguntas mais comuns.</p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <Accordion key={i} title={faq.q}>
            <p>{faq.a}</p>
          </Accordion>
        ))}
      </div>
    </div>
  )
}

// ============ MAIN PAGE ============

export function ManualPage() {
  const [active, setActive] = useState<Section>('inicio')

  const renderContent = () => {
    switch (active) {
      case 'inicio': return <SectionInicio />
      case 'dashboard': return <SectionDashboard />
      case 'financeiro': return <SectionFinanceiro />
      case 'membros': return <SectionMembros />
      case 'retiros': return <SectionRetiros />
      case 'secretaria': return <SectionSecretaria />
      case 'patrimonio': return <SectionPatrimonio />
      case 'feedback': return <SectionFeedback />
      case 'usuarios': return <SectionUsuarios />
      case 'perfis': return <SectionPerfis />
      case 'faq': return <SectionFAQ />
    }
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar do manual */}
      <aside className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-0 space-y-1">
          <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide px-3 mb-3">
            Manual do Usuário
          </h3>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition",
                active === s.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <s.icon className="w-4 h-4" />
              {s.name}
            </button>
          ))}
        </div>
      </aside>

      {/* Menu mobile */}
      <div className="lg:hidden mb-4 w-full">
        <select
          value={active}
          onChange={(e) => setActive(e.target.value as Section)}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-card"
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Conteúdo */}
      <main className="flex-1 min-w-0 pb-10">
        {renderContent()}
      </main>
    </div>
  )
}
