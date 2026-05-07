import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ArrowLeft, Edit2, Phone, Mail, MapPin, MessageCircle } from 'lucide-react'
import { ageGroupColor, ageGroupLabel } from '@/lib/ageGroups'
import { WhatsappShareDialog } from '@/components/WhatsappShareDialog'

export function MemberDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [showShare, setShowShare] = useState(false)

  const { data: member, isLoading } = useQuery({
    queryKey: ['member', id],
    queryFn: () => api.get(`/api/members/${id}`).then((r) => r.data),
  })

  if (isLoading) {
    return <div className="animate-pulse h-96 bg-muted rounded-xl" />
  }

  if (!member) {
    return <p className="text-muted-foreground">Membro não encontrado</p>
  }

  const InfoRow = ({ label, value }: { label: string; value: any }) => {
    if (!value) return null
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2 border-b border-dashed last:border-0">
        <span className="text-sm text-muted-foreground w-40 shrink-0">{label}</span>
        <span className="text-sm font-medium">{value === true ? 'Sim' : value === false ? 'Não' : value}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/membros')}
            className="p-2 hover:bg-muted rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{member.name}</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              Ficha #{member.ficha_num || '—'}
              {member.age_group && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ageGroupColor(member.age_group)}`}>
                  {ageGroupLabel(member.age_group)}
                  {member.age != null && <span className="ml-1 opacity-70">({member.age}a)</span>}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {member.cel && member.data_nascimento && (
            <button
              onClick={() => setShowShare(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
              title="Parabenizar via WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
              Parabenizar
            </button>
          )}
          <Link
            to={`/membros/${id}/editar`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            <Edit2 className="w-4 h-4" />
            Editar
          </Link>
        </div>
      </div>

      {/* Cards de contato rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(member.cel || member.tel) && (
          <a href={`tel:${member.cel || member.tel}`} className="flex items-center gap-3 bg-card border rounded-xl p-4 hover:shadow-sm transition">
            <Phone className="w-5 h-5 text-green-600" />
            <span className="text-sm">{member.cel || member.tel}</span>
          </a>
        )}
        {member.email && (
          <a href={`mailto:${member.email}`} className="flex items-center gap-3 bg-card border rounded-xl p-4 hover:shadow-sm transition">
            <Mail className="w-5 h-5 text-blue-600" />
            <span className="text-sm truncate">{member.email}</span>
          </a>
        )}
        {member.cidade && (
          <div className="flex items-center gap-3 bg-card border rounded-xl p-4">
            <MapPin className="w-5 h-5 text-red-500" />
            <span className="text-sm">{member.cidade}</span>
          </div>
        )}
      </div>

      {/* Dados completos */}
      <div className="bg-card border rounded-xl p-5 space-y-1">
        <h3 className="font-semibold text-sm text-primary mb-3">Dados Pessoais</h3>
        <InfoRow label="Data de Nascimento" value={member.data_nascimento} />
        <InfoRow label="Naturalidade" value={member.naturalidade} />
        <InfoRow label="Estado Civil" value={member.estado_civil} />
        <InfoRow label="Cônjuge" value={member.nome_conjuge} />
        <InfoRow label="Data Casamento" value={member.data_casamento} />
        <InfoRow label="União Estável" value={member.uniao_estavel} />
      </div>

      <div className="bg-card border rounded-xl p-5 space-y-1">
        <h3 className="font-semibold text-sm text-primary mb-3">Documentos</h3>
        <InfoRow label="CPF" value={member.cpf} />
        <InfoRow label="Identidade" value={member.identidade} />
      </div>

      <div className="bg-card border rounded-xl p-5 space-y-1">
        <h3 className="font-semibold text-sm text-primary mb-3">Filiação e Formação</h3>
        <InfoRow label="Pai" value={member.filiacao_pai} />
        <InfoRow label="Mãe" value={member.filiacao_mae} />
        <InfoRow label="Escolaridade" value={member.escolaridade} />
        <InfoRow label="Profissão" value={member.profissao} />
      </div>

      <div className="bg-card border rounded-xl p-5 space-y-1">
        <h3 className="font-semibold text-sm text-primary mb-3">Contato</h3>
        <InfoRow label="Celular" value={member.cel} />
        <InfoRow label="Telefone" value={member.tel} />
        <InfoRow label="Email" value={member.email} />
      </div>

      <div className="bg-card border rounded-xl p-5 space-y-1">
        <h3 className="font-semibold text-sm text-primary mb-3">Endereço</h3>
        <InfoRow label="Endereço" value={member.endereco} />
        <InfoRow label="Bairro" value={member.bairro} />
        <InfoRow label="Cidade" value={member.cidade} />
        <InfoRow label="CEP" value={member.cep} />
      </div>

      <div className="bg-card border rounded-xl p-5 space-y-1">
        <h3 className="font-semibold text-sm text-primary mb-3">Dados Eclesiásticos</h3>
        <InfoRow label="Batizado nas Águas" value={member.batizado_aguas} />
        <InfoRow label="Batismo Espírito Santo" value={member.batismo_espirito_santo} />
        <InfoRow label="Veio Transferido de" value={member.veio_transferido_de} />
        <InfoRow label="Veio de Outra Igreja" value={member.veio_de_outra_igreja} />
        <InfoRow label="Data de Membresia" value={member.data_membresia} />
        <InfoRow label="Deseja Ministério" value={member.deseja_ministerio} />
        <InfoRow label="Qual Ministério" value={member.qual_ministerio} />
      </div>

      {member.observacoes && (
        <div className="bg-card border rounded-xl p-5">
          <h3 className="font-semibold text-sm text-primary mb-3">Observações</h3>
          <p className="text-sm text-muted-foreground">{member.observacoes}</p>
        </div>
      )}

      {showShare && (
        <WhatsappShareDialog
          open
          onClose={() => setShowShare(false)}
          title={`Parabenizar ${member.name}`}
          templateKind="birthday"
          templateVars={{
            nome: member.name,
            idade: member.age != null ? member.age + 1 : '',
          }}
          individualPhone={member.cel}
          individualName={member.name.split(' ')[0]}
        />
      )}
    </div>
  )
}
