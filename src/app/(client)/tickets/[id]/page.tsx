'use client'
// src/app/(client)/tickets/[id]/page.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatDateTime, formatDate, priorityLabels, statusLabels, categoryLabels, isSlaBreached, isSlaWarning } from '@/lib/utils'
import { Send, Lock, AlertTriangle, User, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']

export default function TicketDetailPage() {
  const { id }      = useParams()
  const { data: session } = useSession()
  const role        = (session?.user as any)?.role
  const queryClient = useQueryClient()

  const [comment,    setComment]    = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [assigneeId, setAssigneeId] = useState<string>('')
  const [newStatus,  setNewStatus]  = useState<string>('')

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn:  () => fetch(`/api/tickets/${id}`).then(r => r.json()),
  })

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn:  () => fetch('/api/users?role=AGENT').then(r => r.json()),
    enabled:  role !== 'CLIENT',
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => fetch(`/api/tickets/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] })
      toast.success('Tiket aktualizovaný')
      setComment('')
    },
    onError: () => toast.error('Chyba pri aktualizácii'),
  })

  function handleSubmit() {
    const payload: any = {}
    if (comment)    payload.comment    = comment
    if (isInternal) payload.isInternal = true
    if (assigneeId) payload.assigneeId = assigneeId
    if (newStatus)  payload.status     = newStatus
    if (Object.keys(payload).length === 0) return
    updateMutation.mutate(payload)
  }

  if (isLoading) return (
    <PortalLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sycom-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </PortalLayout>
  )

  if (!ticket || ticket.error) return (
    <PortalLayout><p className="text-gray-500">Tiket nenájdený.</p></PortalLayout>
  )

  const slaBreached = isSlaBreached(ticket.slaDeadline)
  const slaWarning  = isSlaWarning(ticket.slaDeadline)

  return (
    <PortalLayout>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-sm text-sycom-500 font-semibold">#T-{ticket.ticketNumber}</span>
                <span className={`badge-${ticket.priority.toLowerCase()}`}>● {priorityLabels[ticket.priority]}</span>
                <span className={`status-${ticket.status.toLowerCase()}`}>{statusLabels[ticket.status]}</span>
                {slaBreached && (
                  <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                    <AlertTriangle size={11} /> SLA porušená
                  </span>
                )}
                {slaWarning && !slaBreached && (
                  <span className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-md">
                    <Clock size={11} /> SLA blíži
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-gray-800">{ticket.subject}</h1>
              <p className="text-xs text-gray-400 mt-1">
                {ticket.creator?.name} · {formatDateTime(ticket.createdAt)} · {categoryLabels[ticket.category]}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5">

          {/* Main: description + comments */}
          <div className="col-span-2 space-y-4">

            {/* Description */}
            <div className="card">
              <div className="card-stripe" />
              <div className="card-header">
                <User size={14} className="text-sycom-500" />
                <span className="card-title">Popis problému</span>
              </div>
              <div className="p-5 prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                {ticket.description}
              </div>
            </div>

            {/* Comments */}
            <div className="card">
              <div className="card-stripe" />
              <div className="card-header">
                <span className="card-title">Konverzácia ({ticket.comments?.length ?? 0})</span>
              </div>
              <div className="divide-y divide-gray-100">
                {(ticket.comments ?? []).length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-8">Žiadne správy zatiaľ</p>
                )}
                {(ticket.comments ?? []).map((c: any) => (
                  <div key={c.id}
                    className={cn('p-5', c.isInternal && 'bg-amber-50 border-l-4 border-amber-300')}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-sycom-500 text-white text-xs font-bold flex items-center justify-center">
                        {c.author.name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <span className="text-xs font-bold text-gray-700">{c.author.name}</span>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1.5 py-0.5 bg-gray-100 rounded">
                        {c.author.role}
                      </span>
                      {c.isInternal && (
                        <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                          <Lock size={9} /> Interná poznámka
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400 ml-auto font-mono">{formatDateTime(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-9">{c.content}</p>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              <div className="p-5 border-t border-gray-100">
                <textarea
                  className="input min-h-[90px] resize-y mb-3"
                  placeholder="Napíšte odpoveď…"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  {role !== 'CLIENT' && (
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 cursor-pointer">
                      <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)}
                        className="accent-amber-500" />
                      <Lock size={11} /> Interná poznámka
                    </label>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={updateMutation.isPending || !comment.trim()}
                    className="btn btn-primary btn-sm ml-auto">
                    <Send size={12} />
                    {updateMutation.isPending ? 'Odosielam...' : 'Odoslať'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar: ticket info + actions */}
          <div className="space-y-4">

            {/* Info */}
            <div className="card">
              <div className="card-stripe" />
              <div className="card-header"><span className="card-title">Informácie</span></div>
              <div className="p-4 space-y-3 text-sm">
                {[
                  { label: 'Žiadateľ',   value: ticket.creator?.name },
                  { label: 'Email',       value: ticket.creator?.email },
                  { label: 'Oddelenie',  value: ticket.creator?.department ?? '—' },
                  { label: 'Kategória',  value: categoryLabels[ticket.category] },
                  { label: 'Priradený',  value: ticket.assignee?.name ?? 'Nepridelený' },
                  { label: 'Tím',        value: ticket.team?.name ?? '—' },
                  { label: 'Vytvorené',  value: formatDate(ticket.createdAt) },
                  { label: 'SLA deadline', value: ticket.slaDeadline ? formatDateTime(ticket.slaDeadline) : '—' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between gap-2">
                    <span className="text-gray-400 text-xs font-semibold flex-shrink-0">{row.label}</span>
                    <span className="text-gray-700 text-xs text-right font-medium">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent actions */}
            {role !== 'CLIENT' && (
              <div className="card">
                <div className="card-stripe" />
                <div className="card-header"><span className="card-title">Akcie</span></div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className="label">Zmeniť stav</label>
                    <select className="input" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                      <option value="">— Aktuálny stav —</option>
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{statusLabels[s]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Priradiť technika</label>
                    <select className="input" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                      <option value="">— Nepridelený —</option>
                      {(agents ?? []).map((a: any) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={handleSubmit} disabled={updateMutation.isPending}
                    className="btn btn-primary w-full justify-center">
                    Uložiť zmeny
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  )
}
