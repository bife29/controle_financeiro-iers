import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Shield, Eye, Plus as PlusIcon, Edit3, Trash2, Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModuleConfig {
  key: string
  label: string
  actions: string[]
}

interface PermDefaults {
  defaults: Record<string, Record<string, string[]>>
  modules: ModuleConfig[]
}

interface UserData {
  id?: number
  name: string
  email: string
  password?: string
  role: string
  is_active: boolean
  permissions: Record<string, string[]>
}

const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin', description: 'Acesso total ao sistema' },
  { value: 'pastor', label: 'Pastor', description: 'Visualização geral + lançamentos financeiros' },
  { value: 'financeiro', label: 'Financeiro', description: 'Módulo financeiro completo' },
  { value: 'secretaria', label: 'Secretaria', description: 'Gestão de membros e retiros' },
  { value: 'viewer', label: 'Visualizador', description: 'Apenas visualização' },
]

const ACTION_LABELS: Record<string, { label: string; icon: typeof Eye }> = {
  view: { label: 'Visualizar', icon: Eye },
  create: { label: 'Criar', icon: PlusIcon },
  edit: { label: 'Editar', icon: Edit3 },
  delete: { label: 'Excluir', icon: Trash2 },
}

export function UserForm() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<UserData>({
    name: '',
    email: '',
    password: '',
    role: 'viewer',
    is_active: true,
    permissions: {},
  })
  const [useCustomPermissions, setUseCustomPermissions] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successMsg, setSuccessMsg] = useState('')

  // Fetch permission defaults and module config
  const { data: permConfig } = useQuery<PermDefaults>({
    queryKey: ['permissions-defaults'],
    queryFn: () => api.get('/api/auth/permissions/defaults').then((r) => r.data),
  })

  // Fetch user data for editing
  const { data: existingUser } = useQuery<UserData>({
    queryKey: ['user', id],
    queryFn: () => api.get(`/api/auth/users/${id}`).then((r) => r.data),
    enabled: isEditing,
  })

  useEffect(() => {
    if (existingUser && permConfig) {
      setForm({
        ...existingUser,
        password: '',
      })
      // Determine if user has custom permissions (different from role defaults)
      const defaultPerms = permConfig.defaults[existingUser.role] || {}
      const userPerms = existingUser.permissions || {}
      const isCustom = JSON.stringify(defaultPerms) !== JSON.stringify(userPerms)
      setUseCustomPermissions(isCustom)
    }
  }, [existingUser, permConfig])

  // Apply default permissions when role changes (only if not using custom)
  useEffect(() => {
    if (!useCustomPermissions && permConfig) {
      setForm((prev) => ({
        ...prev,
        permissions: { ...(permConfig.defaults[prev.role] || {}) },
      }))
    }
  }, [form.role, useCustomPermissions, permConfig])

  const saveMutation = useMutation({
    mutationFn: (data: UserData) => {
      if (isEditing) {
        return api.put(`/api/auth/users/${id}`, {
          name: data.name,
          email: data.email,
          role: data.role,
          is_active: data.is_active,
          permissions: data.permissions,
        })
      }
      return api.post('/api/auth/register', {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        permissions: data.permissions,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setSuccessMsg(isEditing ? 'Usu\u00e1rio atualizado com sucesso!' : 'Usu\u00e1rio criado com sucesso!')
      setTimeout(() => navigate('/usuarios'), 1500)
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      setErrors({ form: detail || 'Erro ao salvar usu\u00e1rio. Verifique os dados e tente novamente.' })
    },
  })

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!form.name.trim()) newErrors.name = 'Nome é obrigatório'
    if (!form.email.trim()) newErrors.email = 'Email é obrigatório'
    if (!isEditing && (!form.password || form.password.length < 6)) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMsg('')
    if (!validate()) return
    saveMutation.mutate(form)
  }

  const togglePermission = (moduleKey: string, action: string) => {
    if (!useCustomPermissions) setUseCustomPermissions(true)
    setForm((prev) => {
      const currentActions = prev.permissions[moduleKey] || []
      const hasAction = currentActions.includes(action)
      let newActions: string[]

      if (hasAction) {
        newActions = currentActions.filter((a) => a !== action)
        // If removing "view", remove all other actions too
        if (action === 'view') {
          newActions = []
        }
      } else {
        newActions = [...currentActions, action]
        // If adding any action, ensure "view" is also present
        if (action !== 'view' && !newActions.includes('view')) {
          newActions = ['view', ...newActions]
        }
      }

      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [moduleKey]: newActions,
        },
      }
    })
  }

  const toggleAllModule = (moduleKey: string, allActions: string[]) => {
    if (!useCustomPermissions) setUseCustomPermissions(true)
    setForm((prev) => {
      const currentActions = prev.permissions[moduleKey] || []
      const allSelected = allActions.every((a) => currentActions.includes(a))
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [moduleKey]: allSelected ? [] : [...allActions],
        },
      }
    })
  }

  const modules = permConfig?.modules || []

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/usuarios')}
          className="p-2 hover:bg-muted rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEditing
              ? 'Altere os dados e permissões do usuário'
              : 'Preencha os dados e defina as permissões de acesso'}
          </p>
        </div>
      </div>

      {errors.form && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {errors.form}
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados básicos */}
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Dados do Usuário
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nome *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className={cn(
                  'w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none',
                  errors.name && 'border-red-500'
                )}
                placeholder="Nome completo"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className={cn(
                  'w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none',
                  errors.email && 'border-red-500'
                )}
                placeholder="email@exemplo.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            {!isEditing && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Senha *</label>
                <input
                  type="password"
                  value={form.password || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  className={cn(
                    'w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none',
                    errors.password && 'border-red-500'
                  )}
                  placeholder="Mínimo 6 caracteres"
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              </div>
            )}

            {isEditing && (
              <div className="flex items-center gap-3">
                <label className="block text-sm font-medium">Status:</label>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition',
                    form.is_active
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  )}
                >
                  {form.is_active ? 'Ativo' : 'Inativo'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Grupo/Papel */}
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-lg">Grupo de Acesso</h2>
          <p className="text-sm text-muted-foreground">
            Selecione o grupo base do usuário. As permissões padrão serão aplicadas automaticamente.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ROLE_OPTIONS.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, role: role.value }))}
                className={cn(
                  'relative p-4 border-2 rounded-xl text-left transition',
                  form.role === role.value
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-muted hover:border-muted-foreground/30'
                )}
              >
                {form.role === role.value && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
                <p className="font-medium text-sm">{role.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Permissões */}
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg">Permissões por Módulo</h2>
              <p className="text-sm text-muted-foreground">
                {useCustomPermissions
                  ? 'Permissões personalizadas — clique nos botões para ativar/desativar cada ação'
                  : `Usando permissões padrão do grupo "${ROLE_OPTIONS.find((r) => r.value === form.role)?.label}". Clique em qualquer permissão para personalizar.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setUseCustomPermissions(!useCustomPermissions)
                if (useCustomPermissions && permConfig) {
                  // Reset to defaults
                  setForm((prev) => ({
                    ...prev,
                    permissions: { ...(permConfig.defaults[prev.role] || {}) },
                  }))
                }
              }}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition',
                useCustomPermissions
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {useCustomPermissions ? 'Usar Padrão do Grupo' : 'Personalizar'}
            </button>
          </div>

          {/* Matrix */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium w-44">Módulo</th>
                  {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
                    <th key={key} className="text-center py-3 px-3 font-medium">
                      {label}
                    </th>
                  ))}
                  <th className="text-center py-3 px-3 font-medium">Todos</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {modules.map((mod) => {
                  const currentActions = form.permissions[mod.key] || []
                  const allSelected = mod.actions.every((a) => currentActions.includes(a))

                  return (
                    <tr key={mod.key} className="hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">{mod.label}</td>
                      {Object.keys(ACTION_LABELS).map((action) => {
                        const isAvailable = mod.actions.includes(action)
                        const isActive = currentActions.includes(action)
                        return (
                          <td key={action} className="text-center py-3 px-3">
                            {isAvailable ? (
                              <button
                                type="button"
                                onClick={() => togglePermission(mod.key, action)}
                                className={cn(
                                  'w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition hover:scale-110 cursor-pointer',
                                  isActive
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'bg-muted/50 text-muted-foreground'
                                )}
                              >
                                {isActive && <Check className="w-4 h-4" />}
                              </button>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="text-center py-3 px-3">
                        <button
                          type="button"
                          onClick={() => toggleAllModule(mod.key, mod.actions)}
                          className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition border-2 hover:scale-110 cursor-pointer',
                            allSelected
                              ? 'bg-primary border-primary text-white'
                              : 'border-muted-foreground/30 text-muted-foreground'
                          )}
                        >
                          {allSelected && <Check className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
              Permitido
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded bg-muted/50" />
              Sem acesso
            </div>
            <div className="flex items-center gap-1.5">
              <span>—</span>
              Não disponível
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-8">
          <button
            type="button"
            onClick={() => navigate('/usuarios')}
            className="px-6 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Usuário'}
          </button>
        </div>
      </form>
    </div>
  )
}
