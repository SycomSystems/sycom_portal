'use client'
// src/app/(client)/tickets/[id]/page.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatDateTime, priorityLabels, statusLabels, categoryLabels, isSlaBreached, isSlaWarning } from '@/lib/utils'
import { Send, Lock, AlertTriangle, User, Clock, ArrowLeft, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH:     'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  LOW:      'bg-gray-100 text-gray-500 border-gray-200',
}

const STATUS_COLORS: Record<string, string> = {
  OPEN:        'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  WAITING:     'bg-yellow-100 text-yellow-700',
  RESOLVED:    'bg-green-100 text-green-700',
  CLOSED:      'bg-gray-100 text-gray-500',
}

export default function TicketDetailPage() {
  const { id }             = useParams()
  const router             = useRouter()
  const { data: session }  = useSession()
  const role               = (session?.user as any)?.role
  const queryClient        = useQueryClient()

  const [comment,    setComment]    = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [assigneeId, setAssigneeId] = useState('')
  const [newStatus,  setNewStatus]  = useState('')

  // Fetch ticket
  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn:  () => fetch(`/api/tickets/${id}`).then(r => r.json()),
    enabled:  !!id,
    refetchInterval: 10000, // auto-refresh every 10s
  })

  // Fetch agents AND admins for the assignee dropdown
  const { data: agentList } = useQuery({
    queryKey: ['agents'],
    queryFn:  () => fetch('/api/users').then(r => r.json()).then((users: any[]) =>
      users.filter(u => u.role === 'AGENT' || u.role === 'ADMIN')
    ),
    enabled: role === 'ADMIN' || role === 'AGENT',
  })

  const mutation = useMutation({
    mutationFn: (data: any) => fetch(`/api/tickets/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    }).then(r => {
      if (!r.ok) throw new Error('Chyba')
      return r.json()
    }),
    onSuccess: () => {
      // Invalidate and immediately refetch so comments appear
      queryClient.invalidateQueries({ queryKey: ['ticket', id] })
      queryClient.refetchQueries({ queryKey: ['ticket', id] })
      toast.success('Tiket aktualizovaný')
      setComment('')
      setNewStatus('')
      setAssigneeId('')
    },
    onError: () => toast.error('Chyba pri aktualizácii'),
  })

  function handleSubmit() {
    const payload: any = {}
    if (comment.trim()) payload.comment    = comment.trim()
    if (isInternal)     payload.isInternal = true
    if (assigneeId)     payload.assigneeId = assigneeId
    if (newStatus)      payload.status     = newStatus
    if (Object.keys(payload).length === 0) return
    mutation.mutate(payload)
  }

  if (isLoading) return (
    <PortalLayout>
      <div className="flex items-center justify-center h-64 text-gray-400">Načítavam tiket...</div>
    </PortalLayout>
  )

  if (!ticket || ticket.error) return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto py-8 px-6 text-center">
        <p className="text-gray-500">Tiket sa nenašiel.</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-sycom-500 hover:underline">← Späť</button>
      </div>
    </PortalLayout>
  )

  const isStaff = role === 'ADMIN' || role === 'AGENT'
  const slaBreached = ticket.slaDeadline && isSlaBreached(ticket.slaDeadline)
  const slaWarn     = ticket.slaDeadline && isSlaWarning(ticket.slaDeadline)

  return (
    <PortalLayout>
      <div className="max-w-4xl mx-auto py-8 px-6">

        {/* Back */}
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-sycom-500 mb-5 transition-colors">
          <ArrowLeft size={15} /> Späť na tikety
        </button>

        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold text-sycom-500">#T-{ticket.ticketNumber}</span>
                {slaBreached && <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><AlertTriangle size={11} /> SLA porušená</span>}
                {!slaBreached && slaWarn && <span className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full"><Clock size={11} /> SLA blíži</span>}
              </div>
              <h1 className="text-xl font-bold text-gray-900">{ticket.subject}</h1>
              {ticket.creator?.client && (
                <p className="flex items-center gap-1 text-xs text-gray-400 mt-1"><Building2 size={12} /> {ticket.creator.client.name}</p>
              )}
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_COLORS[ticket.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {statusLabels[ticket.status] ?? ticket.status}
            </span>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              { label: 'Priorita',   value: <span className={`font-bold px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[ticket.priority]}`}>{priorityLabels[ticket.priority] ?? ticket.priority}</span> },
              { label: 'Kategória',  value: categoryLabels[ticket.category] ?? ticket.category },
              { label: 'Vytvoril',   value: <span className="flex items-center gap-1"><User size={11} /> {ticket.creator?.name}</span> },
              { label: 'Priradený',  value: ticket.assignee ? <span className="flex items-center gap-1"><User size={11} /> {ticket.assignee.name}</span> : <span className="text-gray-300">Nepriradený</span> },
              { label: 'Tím',        value: ticket.team?.name ?? <span className="text-gray-300">—</span> },
              { label: 'SLA',        value: ticket.slaDeadline ? `do ${new Date(ticket.slaDeadline).toLocaleDateString('sk')}` : '—' },
              { label: 'Vytvorené',  value: formatDateTime(ticket.createdAt) },
              { label: 'Aktualizované', value: formatDateTime(ticket.updatedAt) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">{label}</p>
                <div className="text-gray-800 font-medium">{value}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          <div className="mt-4 p-4 bg-gray-50 rounded-xl">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Popis</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Conversation */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-gray-700">Konverzácia ({(ticket.comments ?? []).length})</h2>

            {(ticket.comments ?? []).length === 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-sm text-gray-400">
                Zatiaľ žiadne správy. Napíšte prvú správu.
              </div>
            )}

            {(ticket.comments ?? []).map((c: any) => (
              <div key={c.id} className={`bg-white border rounded-2xl p-4 ${c.isInternal ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-sycom-500 text-white text-xs font-bold flex items-center justify-center">
                      {c.author?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-800">{c.author?.name}</p>
                      <p className="text-[10px] text-gray-400">{formatDateTime(c.createdAt)}</p>
                    </div>
                  </div>
                  {c.isInternal && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                      <Lock size={9} /> Interná
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}

            {/* Add comment */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-500 mb-2">Pridať správu</p>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Napíšte správu..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100"
              />
              <div className="flex items-center justify-between mt-3">
                {isStaff && (
                  <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                    <Lock size={11} /> Interná poznámka
                  </label>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={mutation.isPending || !comment.trim()}
                  className="ml-auto flex items-center gap-2 px-4 py-2 bg-sycom-500 text-white text-xs font-bold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors"
                >
                  <Send size={13} /> {mutation.isPending ? 'Odosielam...' : 'Odoslať'}
                </button>
              </div>
            </div>
          </div>

          {/* Actions sidebar */}
          {isStaff && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-gray-700">Akcie</h2>

              {/* Change status */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Zmeniť stav</p>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white"
                >
                  <option value="">— Aktuálny: {statusLabels[ticket.status] ?? ticket.status} —</option>
                  {STATUS_OPTIONS.filter(s => s !== ticket.status).map(s => (
                    <option key={s} value={s}>{statusLabels[s] ?? s}</option>
                  ))}
                </select>
                {newStatus && (
                  <button
                    onClick={() => mutation.mutate({ status: newStatus })}
                    disabled={mutation.isPending}
                    className="mt-2 w-full px-3 py-2 bg-sycom-500 text-white text-xs font-bold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors"
                  >
                    Uložiť stav
                  </button>
                )}
              </div>

              {/* Assign technician - only ADMIN and AGENT */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Priradiť technika</p>
                <select
                  value={assigneeId}
                  onChange={e => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white"
                >
                  <option value="">— {ticket.assignee ? ticket.assignee.name : 'Nepriradený'} —</option>
                  {(agentList ?? []).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.role === 'ADMIN' ? 'Admin' : 'Agent'})</option>
                  ))}
                </select>
                {assigneeId && (
                  <button
                    onClick={() => mutation.mutate({ assigneeId })}
                    disabled={mutation.isPending}
                    className="mt-2 w-full px-3 py-2 bg-sycom-500 text-white text-xs font-bold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors"
                  >
                    Priradiť
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </PortalLayout>
  )
}
