'use client'
// src/app/(admin)/admin/teams/page.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Plus, X, Loader2, Crown, Users, Trash2 } from 'lucide-react'

const teamSchema = z.object({
  name:        z.string().min(2, 'Min. 2 znaky'),
  description: z.string().optional(),
  color:       z.string().default('#1a6fba'),
})
type TeamForm = z.infer<typeof teamSchema>

const TEAM_COLORS = [
  '#1a6fba', '#2a9d5c', '#e63946', '#e9952a', '#7b3fbe', '#d4a017', '#0891b2', '#be185d'
]

export default function TeamsPage() {
  const [showModal,  setShowModal]  = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<any>(null)
  const queryClient = useQueryClient()

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn:  () => fetch('/api/teams').then(r => r.json()),
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn:  () => fetch('/api/users?role=AGENT').then(r => r.json()),
  })

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<TeamForm>({
    resolver: zodResolver(teamSchema),
    defaultValues: { color: '#1a6fba' },
  })

  const selectedColor = watch('color')

  const createMutation = useMutation({
    mutationFn: (data: TeamForm) => fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      toast.success('Tím vytvorený')
      setShowModal(false)
      reset()
    },
    onError: () => toast.error('Chyba pri vytváraní tímu'),
  })

  const addMemberMutation = useMutation({
    mutationFn: ({ teamId, userId, isLead }: { teamId: string; userId: string; isLead: boolean }) =>
      fetch(`/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isLead }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      toast.success('Člen pridaný')
    },
    onError: () => toast.error('Chyba pri pridávaní člena'),
  })

  const removeMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      fetch(`/api/teams/${teamId}/members/${userId}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      toast.success('Člen odstránený')
    },
  })

  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: string) => fetch(`/api/teams/${teamId}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      setSelectedTeam(null)
      toast.success('Tím zmazaný')
    },
  })

  return (
    <PortalLayout>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Tímy</h1>
          <p className="text-sm text-gray-400 mt-0.5">{teams.length} tímov · Správa a členovia</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={14}/> Nový tím
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-sycom-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5">
          {teams.map((team: any) => {
            const members = team.members ?? []
            const lead    = members.find((m: any) => m.isLead)
            const others  = members.filter((m: any) => !m.isLead)

            return (
              <div key={team.id} className="card">
                {/* Color stripe */}
                <div className="h-1.5 rounded-t-xl" style={{ background: team.color }} />

                <div className="p-5">
                  {/* Team header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: team.color + '20' }}>
                      <Users size={20} style={{ color: team.color }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-bold text-gray-800">{team.name}</p>
                      {team.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{team.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg"
                      style={{ background: team.color + '15', color: team.color }}>
                      <Users size={11}/> {members.length}
                    </div>
                  </div>

                  {/* Lead */}
                  {lead && (
                    <div className="mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Vedúci tímu</p>
                      <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full text-white font-bold text-xs flex items-center justify-center"
                            style={{ background: team.color }}>
                            {lead.user.name.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-800">{lead.user.name}</p>
                            <p className="text-[11px] text-gray-400">{lead.user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Crown size={12} className="text-amber-500" />
                          <button
                            onClick={() => removeMemberMutation.mutate({ teamId: team.id, userId: lead.user.id })}
                            className="text-gray-300 hover:text-red-400 ml-2 transition-colors">
                            <X size={13}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Members */}
                  {others.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Členovia</p>
                      <div className="space-y-1.5">
                        {others.map((m: any) => (
                          <div key={m.user.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gray-300 text-white font-bold text-xs flex items-center justify-center">
                                {m.user.name.split(' ').map((n: string) => n[0]).join('')}
                              </div>
                              <p className="text-xs font-semibold text-gray-700">{m.user.name}</p>
                            </div>
                            <button
                              onClick={() => removeMemberMutation.mutate({ teamId: team.id, userId: m.user.id })}
                              className="text-gray-300 hover:text-red-400 transition-colors">
                              <X size={13}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {members.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3 mb-3">Žiadni členovia</p>
                  )}

                  {/* Add member */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <select
                      className="input text-xs flex-1"
                      id={`add-member-${team.id}`}
                      defaultValue="">
                      <option value="" disabled>Pridať člena…</option>
                      {agents
                        .filter((a: any) => !members.find((m: any) => m.user.id === a.id))
                        .map((a: any) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                    <button
                      onClick={() => {
                        const sel = document.getElementById(`add-member-${team.id}`) as HTMLSelectElement
                        if (sel.value) {
                          addMemberMutation.mutate({ teamId: team.id, userId: sel.value, isLead: false })
                          sel.value = ''
                        }
                      }}
                      className="btn btn-primary btn-sm">
                      <Plus size={13}/> Pridať
                    </button>
                    <button
                      onClick={() => { if (confirm('Zmazať tím?')) deleteTeamMutation.mutate(team.id) }}
                      className="btn btn-sm border border-red-200 text-red-400 hover:bg-red-50 transition-colors">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {teams.length === 0 && (
            <div className="col-span-2 card p-16 text-center">
              <Users size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="font-semibold text-gray-400">Žiadne tímy</p>
              <p className="text-xs text-gray-400 mt-1">Vytvorte prvý tím kliknutím na tlačidlo vyššie</p>
            </div>
          )}
        </div>
      )}

      {/* Create team modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-sycom-500 px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-white">Nový tím</p>
                <p className="text-xs text-white/70">Vytvorte nový tím technickej podpory</p>
              </div>
              <button onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors">
                <X size={15}/>
              </button>
            </div>

            <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="p-6 space-y-4">
              <div>
                <label className="label">Názov tímu *</label>
                <input {...register('name')} className="input" placeholder="IT Support, Sieť, Bezpečnosť…" />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="label">Popis</label>
                <input {...register('description')} className="input" placeholder="Krátky popis tímu…" />
              </div>

              <div>
                <label className="label">Farba tímu</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {TEAM_COLORS.map(color => (
                    <button key={color} type="button"
                      onClick={() => setValue('color', color)}
                      className="w-8 h-8 rounded-lg transition-all border-2"
                      style={{
                        background: color,
                        borderColor: selectedColor === color ? color : 'transparent',
                        boxShadow: selectedColor === color ? `0 0 0 3px ${color}40` : 'none',
                        transform: selectedColor === color ? 'scale(1.15)' : 'scale(1)',
                      }} />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setShowModal(false); reset() }}
                  className="btn btn-ghost flex-1 justify-center">Zrušiť</button>
                <button type="submit" disabled={createMutation.isPending}
                  className="btn btn-primary flex-1 justify-center">
                  {createMutation.isPending ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
                  {createMutation.isPending ? 'Vytváram...' : 'Vytvoriť tím'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  )
}
