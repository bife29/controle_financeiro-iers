import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ArrowLeft, Save } from 'lucide-react'

interface MemberData {
  ficha_num?: number | null
  name: string
  data_nascimento?: string | null
  naturalidade?: string | null
  estado_civil?: string | null
  nome_conjuge?: string | null
  data_casamento?: string | null
  uniao_estavel?: boolean
  identidade?: string | null
  cpf?: string | null
  filiacao_pai?: string | null
  filiacao_mae?: string | null
  escolaridade?: string | null
  profissao?: string | null
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
  cep?: string | null
  tel?: string | null
  cel?: string | null
  email?: string | null
  veio_transferido_de?: string | null
  batizado_aguas?: boolean
  batismo_espirito_santo?: boolean
  veio_de_outra_igreja?: string | null
  deseja_ministerio?: boolean
  qual_ministerio?: string | null
  data_membresia?: string | null
  observacoes?: string | null
}

const initialData: MemberData = {
  name: '',
  data_nascimento: null,
  naturalidade: '',
  estado_civil: '',
  nome_conjuge: '',
  data_casamento: null,
  uniao_estavel: false,
  identidade: '',
  cpf: '',
  filiacao_pai: '',
  filiacao_mae: '',
  escolaridade: '',
  profissao: '',
  endereco: '',
  bairro: '',
  cidade: '',
  cep: '',
  tel: '',
  cel: '',
  email: '',
  veio_transferido_de: '',
  batizado_aguas: false,
  batismo_espirito_santo: false,
  veio_de_outra_igreja: '',
  deseja_ministerio: false,
  qual_ministerio: '',
  data_membresia: null,
  observacoes: '',
}

export function MemberForm() {
  const { id } = useParams()
  const isEditing = !!id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<MemberData>(initialData)
  const [error, setError] = useState('')

  // Carregar dados se editando
  const { data: existingMember } = useQuery({
    queryKey: ['member', id],
    queryFn: () => api.get(`/api/members/${id}`).then((r) => r.data),
    enabled: isEditing,
  })

  useEffect(() => {
    if (existingMember) {
      setForm(existingMember)
    }
  }, [existingMember])

  const mutation = useMutation({
    mutationFn: (data: MemberData) =>
      isEditing
        ? api.put(`/api/members/${id}`, data)
        : api.post('/api/members/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      navigate('/membros')
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Erro ao salvar membro')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Nome é obrigatório')
      return
    }
    setError('')
    mutation.mutate(form)
  }

  const updateField = (field: keyof MemberData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/membros')}
          className="p-2 hover:bg-muted rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Editar Membro' : 'Nova Ficha de Membro'}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Preencha os dados da ficha cadastral
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Seção: Dados Pessoais */}
        <fieldset className="bg-card border rounded-xl p-5 space-y-4">
          <legend className="text-sm font-bold text-primary px-2">Dados Pessoais</legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Nome Completo *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data de Nascimento</label>
              <input
                type="date"
                value={form.data_nascimento || ''}
                onChange={(e) => updateField('data_nascimento', e.target.value || null)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Naturalidade</label>
              <input
                type="text"
                value={form.naturalidade || ''}
                onChange={(e) => updateField('naturalidade', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Estado Civil</label>
              <select
                value={form.estado_civil || ''}
                onChange={(e) => updateField('estado_civil', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">Selecione</option>
                <option value="Solteiro(a)">Solteiro(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viúvo(a)">Viúvo(a)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cônjuge</label>
              <input
                type="text"
                value={form.nome_conjuge || ''}
                onChange={(e) => updateField('nome_conjuge', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data Casamento</label>
              <input
                type="date"
                value={form.data_casamento || ''}
                onChange={(e) => updateField('data_casamento', e.target.value || null)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={form.uniao_estavel || false}
                onChange={(e) => updateField('uniao_estavel', e.target.checked)}
                className="rounded"
              />
              <label className="text-sm">União Estável</label>
            </div>
          </div>
        </fieldset>

        {/* Seção: Documentos */}
        <fieldset className="bg-card border rounded-xl p-5 space-y-4">
          <legend className="text-sm font-bold text-primary px-2">Documentos</legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">CPF</label>
              <input
                type="text"
                value={form.cpf || ''}
                onChange={(e) => updateField('cpf', e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Identidade (RG)</label>
              <input
                type="text"
                value={form.identidade || ''}
                onChange={(e) => updateField('identidade', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </fieldset>

        {/* Seção: Filiação e Formação */}
        <fieldset className="bg-card border rounded-xl p-5 space-y-4">
          <legend className="text-sm font-bold text-primary px-2">Filiação e Formação</legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Pai</label>
              <input
                type="text"
                value={form.filiacao_pai || ''}
                onChange={(e) => updateField('filiacao_pai', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mãe</label>
              <input
                type="text"
                value={form.filiacao_mae || ''}
                onChange={(e) => updateField('filiacao_mae', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Escolaridade</label>
              <select
                value={form.escolaridade || ''}
                onChange={(e) => updateField('escolaridade', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">Selecione</option>
                <option value="Fundamental Incompleto">Fundamental Incompleto</option>
                <option value="Fundamental Completo">Fundamental Completo</option>
                <option value="Médio Incompleto">Médio Incompleto</option>
                <option value="Médio Completo">Médio Completo</option>
                <option value="Superior Incompleto">Superior Incompleto</option>
                <option value="Superior Completo">Superior Completo</option>
                <option value="Pós-Graduação">Pós-Graduação</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Profissão</label>
              <input
                type="text"
                value={form.profissao || ''}
                onChange={(e) => updateField('profissao', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </fieldset>

        {/* Seção: Endereço */}
        <fieldset className="bg-card border rounded-xl p-5 space-y-4">
          <legend className="text-sm font-bold text-primary px-2">Endereço</legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium mb-1">Endereço</label>
              <input
                type="text"
                value={form.endereco || ''}
                onChange={(e) => updateField('endereco', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bairro</label>
              <input
                type="text"
                value={form.bairro || ''}
                onChange={(e) => updateField('bairro', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cidade</label>
              <input
                type="text"
                value={form.cidade || ''}
                onChange={(e) => updateField('cidade', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">CEP</label>
              <input
                type="text"
                value={form.cep || ''}
                onChange={(e) => updateField('cep', e.target.value)}
                placeholder="00000-000"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </fieldset>

        {/* Seção: Contato */}
        <fieldset className="bg-card border rounded-xl p-5 space-y-4">
          <legend className="text-sm font-bold text-primary px-2">Contato</legend>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Telefone</label>
              <input
                type="tel"
                value={form.tel || ''}
                onChange={(e) => updateField('tel', e.target.value)}
                placeholder="(00) 0000-0000"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Celular</label>
              <input
                type="tel"
                value={form.cel || ''}
                onChange={(e) => updateField('cel', e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </fieldset>

        {/* Seção: Dados Eclesiásticos */}
        <fieldset className="bg-card border rounded-xl p-5 space-y-4">
          <legend className="text-sm font-bold text-primary px-2">Dados Eclesiásticos</legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Veio transferido de</label>
              <input
                type="text"
                value={form.veio_transferido_de || ''}
                onChange={(e) => updateField('veio_transferido_de', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Veio de outra igreja</label>
              <input
                type="text"
                value={form.veio_de_outra_igreja || ''}
                onChange={(e) => updateField('veio_de_outra_igreja', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data de Membresia</label>
              <input
                type="date"
                value={form.data_membresia || ''}
                onChange={(e) => updateField('data_membresia', e.target.value || null)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Qual Ministério deseja</label>
              <input
                type="text"
                value={form.qual_ministerio || ''}
                onChange={(e) => updateField('qual_ministerio', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6 pt-2">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.batizado_aguas || false}
                onChange={(e) => updateField('batizado_aguas', e.target.checked)}
                className="rounded"
              />
              Batizado nas Águas
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.batismo_espirito_santo || false}
                onChange={(e) => updateField('batismo_espirito_santo', e.target.checked)}
                className="rounded"
              />
              Batismo no Espírito Santo
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.deseja_ministerio || false}
                onChange={(e) => updateField('deseja_ministerio', e.target.checked)}
                className="rounded"
              />
              Deseja servir em Ministério
            </label>
          </div>
        </fieldset>

        {/* Observações */}
        <fieldset className="bg-card border rounded-xl p-5 space-y-4">
          <legend className="text-sm font-bold text-primary px-2">Observações</legend>
          <textarea
            value={form.observacoes || ''}
            onChange={(e) => updateField('observacoes', e.target.value)}
            rows={3}
            placeholder="Observações adicionais sobre o membro..."
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none"
          />
        </fieldset>

        {/* Ações */}
        {error && (
          <p className="text-sm text-destructive bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => navigate('/membros')}
            className="px-5 py-2.5 border rounded-lg text-sm font-medium hover:bg-muted transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {mutation.isPending ? 'Salvando...' : isEditing ? 'Atualizar' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </div>
  )
}
