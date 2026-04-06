'use client'
// src/app/(client)/tickets/[id]/page.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatDateTime, priorityLabels, statusLabels, categoryLabels, isSlaBreached, isSlaWarning } from '@/lib/utils'
import { Send, Lock, AlertTriangle, User, Clock, ArrowLeft, Building2, Timer, CheckCircle, Trash2, Pencil, X, Save } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS  = ['OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED']
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const CATEGORY_OPTIONS = ['HARDWARE', 'SOFTWARE', 'NETWORK', 'EMAIL', 'SECURITY', 'CLOUD', 'ONBOARDING', 'OTHER']

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

function formatHours(h: number) {
  if (!h) return null
  return h % 1 === 0 ? `${h} hod` : `${h.toFixed(2)} hod`
}

export default function TicketDetailPage() {
  const { id }            = useParams()
  const router            = useRouter()
  const { data: session } = useSession()
  const role              = (session?.user as any)?.role
  const queryClient       = useQueryClient()

  // Comment / hours
  const [comment,     setComment]     = useState('')
  const [isInternal,  setIsInternal]  = useState(false)
  const [logHours,    setLogHours]    = useState('')
  const [logHoursErr, setLogHoursErr] = useState(false)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)

  // Sidebar actions
  const [assigneeId, setAssigneeId] = useState('')
  const [newStatus,  setNewStatus]  = useState('')

  // Admin inline edit
  const [editing,      setEditing]      = useState(false)
  const [editSubject,  setEditSubject]  = useState('')
  const [editDesc,     setEditDesc]     = useState('')
  const [editPriority, setEditPriority] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editClientId, setEditClientId] = useState('')

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn:  () => fetch(`/api/tickets/${id}`).then(r => r.json()),
    enabled:  !!id,
    refetchInterval: 10000,
  })

  const { data: agentList } = useQuery({
    queryKey: ['agents'],
    queryFn:  () => fetch('/api/users').then(r => r.json()).then((u: any[]) =>
      u.filter(x => x.role === 'AGENT' || x.role === 'ADMIN')
    ),
    enabled: role === 'ADMIN' || role === 'AGENT',
  })

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn:  () => fetch('/api/clients').then(r => r.json()),
    enabled:  role === 'ADMIN',
  })

  const mutation = useMutation({
    mutationFn: (data: any) => fetch(`/api/tickets/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error('Chyba'); return r.json() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] })
      queryClient.refetchQueries({ queryKey: ['ticket', id] })
      toast.success('Tiket aktualizovaný')
      setComment(''); setIsInternal(false); setNewStatus('')
      setAssigneeId(''); setLogHours(''); setLogHoursErr(false)
      setEditing(false)
    },
    onError: () => toast.error('Chyba pri aktualizácii'),
  })

  async function handleDeleteComment(commentId: string) {
    if (!confirm('Naozaj chcete vymazať tento záznam práce?')) return
    setDeletingId(commentId)
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      queryClient.invalidateQueries({ queryKey: ['ticket', id] })
      queryClient.refetchQueries({ queryKey: ['ticket', id] })
      toast.success('Záznam bol vymazaný')
    } catch { toast.error('Chyba pri mazaní') }
    finally { setDeletingId(null) }
  }

  function startEdit() {
    setEditSubject(ticket.subject)
    setEditDesc(ticket.description)
    setEditPriority(ticket.priority)
    setEditCategory(ticket.category)
    setEditClientId(ticket.creator?.client?.id ?? '')
    setEditing(true)
  }

  function handleSaveEdit() {
    const payload: any = {}
    if (editSubject  !== ticket.subject)      payload.subject     = editSubject
    if (editDesc     !== ticket.description)  payload.description = editDesc
    if (editPriority !== ticket.priority)     payload.priority    = editPriority
    if (editCategory !== ticket.category)     payload.category    = editCategory
    if (editClientId !== (ticket.creator?.client?.id ?? '')) payload.clientId = editClientId || null
    if (Object.keys(payload).length === 0) { setEditing(false); return }
    mutation.mutate(payload)
  }

  function handleComment() {
    if (!comment.trim()) return
    mutation.mutate({ comment: comment.trim(), isInternal })
  }

  function handleLogHours() {
    const hrs = parseFloat(logHours)
    if (isNaN(hrs) || hrs <= 0) { setLogHoursErr(true); toast.error('Zadajte platný počet hodín'); return }
    setLogHoursErr(false)
    mutation.mutate({ comment: `Zaevidovaný čas: ${formatHours(hrs)}`, isInternal: true, workedHours: hrs })
  }

  if (isLoading) return <PortalLayout><div className="flex items-center justify-center h-64 text-gray-400">Načítavam...</div></PortalLayout>
  if (!ticket || ticket.error) return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto py-8 px-6 text-center">
        <p className="text-gray-500">Tiket sa nenašiel.</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-sycom-500 hover:underline">← Späť</button>
      </div>
    </PortalLayout>
  )

  const isStaff    = role === 'ADMIN' || role === 'AGENT'
  const isAdmin    = role === 'ADMIN'
  const slaBreached = ticket.slaDeadline && isSlaBreached(ticket.slaDeadline)
  const slaWarn     = ticket.slaDeadline && isSlaWarning(ticket.slaDeadline)
  const totalHours  = ticket.totalWorkedHours ?? 0
  const isResolved  = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
  const clientName  = ticket.creator?.client?.name

  return (
    <PortalLayout>
      <div className="max-w-4xl mx-auto py-8 px-6">

        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-sycom-500 mb-5 transition-colors">
          <ArrowLeft size={15} /> Späť na tikety
        </button>

        {/* Header card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-sycom-500">#T-{ticket.ticketNumber}</span>
                {slaBreached && <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><AlertTriangle size={11} /> SLA porušená</span>}
                {!slaBreached && slaWarn && <span className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full"><Clock size={11} /> SLA blíži</span>}
                {isStaff && totalHours > 0 && <span className="flex items-center gap-1 text-xs font-bold text-sycom-600 bg-sycom-50 px-2 py-0.5 rounded-full"><Timer size={11} /> {formatHours(totalHours)} celkom</span>}
              </div>

              {editing ? (
                <input value={editSubject} onChange={e => setEditSubject(e.target.value)}
                  className="w-full text-xl font-bold text-gray-900 px-3 py-1.5 border border-sycom-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sycom-100 mb-2" />
              ) : (
                <h1 className="text-xl font-bold text-gray-900 mb-1">{ticket.subject}</h1>
              )}
              {clientName && <p className="flex items-center gap-1 text-xs text-gray-400"><Building2 size={12} /> {clientName}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_COLORS[ticket.status] ?? 'bg-gray-100 text-gray-500'}`}>
                {statusLabels[ticket.status] ?? ticket.status}
              </span>
              {isAdmin && !editing && (
                <button onClick={startEdit} title="Upraviť tiket (admin)"
                  className="p-1.5 text-gray-400 hover:text-sycom-500 hover:bg-sycom-50 rounded-lg transition-colors">
                  <Pencil size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Priorita</p>
              {editing ? (
                <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                  {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{priorityLabels[p] ?? p}</option>)}
                </select>
              ) : (
                <span className={`font-bold px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[ticket.priority]}`}>{priorityLabels[ticket.priority] ?? ticket.priority}</span>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Kategória</p>
              {editing ? (
                <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{categoryLabels[c] ?? c}</option>)}
                </select>
              ) : (
                <span className="text-gray-800 font-medium">{categoryLabels[ticket.category] ?? ticket.category}</span>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Vytvoril</p>
              <span className="flex items-center gap-1 text-gray-800 font-medium"><User size={11} /> {ticket.creator?.name}</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Klient</p>
              {editing ? (
                <select value={editClientId} onChange={e => setEditClientId(e.target.value)} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                  <option value="">— Bez klienta —</option>
                  {(clients ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : clientName ? (
                <span className="flex items-center gap-1 text-gray-800 font-medium"><Building2 size={11} /> {clientName}</span>
              ) : <span className="text-gray-300">—</span>}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Priradený</p>
              {ticket.assignee
                ? <span className="flex items-center gap-1 text-gray-800 font-medium"><User size={11} /> {ticket.assignee.name}</span>
                : <span className="text-gray-300">Nepriradený</span>}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">SLA</p>
              <span className="text-gray-800 font-medium">{ticket.slaDeadline ? `do ${new Date(ticket.slaDeadline).toLocaleDateString('sk')}` : '—'}</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Vytvorené</p>
              <span className="text-gray-800 font-medium">{formatDateTime(ticket.createdAt)}</span>
            </div>
            {isStaff && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Odpracované hodiny</p>
                <span className="flex items-center gap-1 font-bold text-sycom-600"><Timer size={11} /> {formatHours(totalHours) ?? '0 hod'}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Popis</p>
            {editing ? (
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-sycom-400" />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
            )}
          </div>

          {/* Edit save/cancel */}
          {editing && (
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                <X size={14} /> Zrušiť
              </button>
              <button onClick={handleSaveEdit} disabled={mutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-sycom-500 text-white text-sm font-bold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
                <Save size={14} /> Uložiť zmeny
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Conversation */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-gray-700">Konverzácia ({(ticket.comments ?? []).length})</h2>

            {(ticket.comments ?? []).length === 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-sm text-gray-400">Zatiaľ žiadne správy.</div>
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
                  <div className="flex items-center gap-2">
                    {isStaff && c.workedHours > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-sycom-600 bg-sycom-50 px-2 py-0.5 rounded-full">
                        <Timer size={9} /> {formatHours(c.workedHours)}
                      </span>
                    )}
                    {c.isInternal && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                        <Lock size={9} /> Interná
                      </span>
                    )}
                    {isAdmin && c.workedHours > 0 && (
                      <button onClick={() => handleDeleteComment(c.id)} disabled={deletingId === c.id}
                        title="Vymazať záznam práce"
                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}

            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-500 mb-2">Pridať správu</p>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Napíšte správu..." rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100" />
              {isStaff && (
                <label className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                  <Lock size={11} /> Interná poznámka
                </label>
              )}
              <div className="flex justify-end mt-3">
                <button onClick={handleComment} disabled={mutation.isPending || !comment.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-sycom-500 text-white text-xs font-bold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
                  <Send size={13} /> {mutation.isPending ? 'Odosielam...' : 'Odoslať'}
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          {isStaff && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-gray-700">Akcie</h2>

              <div className="bg-sycom-50 border border-sycom-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-sycom-700 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Timer size={13} /> Zaevidovať hodiny</p>
                <p className="text-[11px] text-sycom-600 mb-3">Môžete pridávať hodiny opakovane.</p>
                <input type="number" min="0.25" max="24" step="0.25" value={logHours}
                  onChange={e => { setLogHours(e.target.value); setLogHoursErr(false) }}
                  placeholder="napr. 1.5"
                  className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none mb-2 ${logHoursErr ? 'border-red-400 bg-red-50' : 'border-sycom-200 focus:border-sycom-400'}`} />
                {logHoursErr && <p className="text-xs text-red-500 mb-2">Zadajte platné hodiny</p>}
                <button onClick={handleLogHours} disabled={mutation.isPending || !logHours}
                  className="w-full px-3 py-2 bg-sycom-500 text-white text-xs font-bold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  <Timer size={13} /> Pridať hodiny
                </button>
                {totalHours > 0 && <p className="text-center text-xs font-bold text-sycom-600 mt-2">Spolu: {formatHours(totalHours)}</p>}
              </div>

              {!isResolved && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><CheckCircle size={13} /> Uzatvoriť tiket</p>
                  <button onClick={() => mutation.mutate({ status: 'RESOLVED' })} disabled={mutation.isPending}
                    className="w-full px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
                    ✓ Označiť ako vyriešený
                  </button>
                </div>
              )}

              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Zmeniť stav</p>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">
                  <option value="">— {statusLabels[ticket.status] ?? ticket.status} —</option>
                  {STATUS_OPTIONS.filter(s => s !== ticket.status).map(s => (
                    <option key={s} value={s}>{statusLabels[s] ?? s}</option>
                  ))}
                </select>
                {newStatus && (
                  <button onClick={() => mutation.mutate({ status: newStatus })} disabled={mutation.isPending}
                    className="mt-2 w-full px-3 py-2 bg-sycom-500 text-white text-xs font-bold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
                    Uložiť stav
                  </button>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Priradiť technika</p>
                <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">
                  <option value="">— {ticket.assignee?.name ?? 'Nepriradený'} —</option>
                  {(agentList ?? []).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.role === 'ADMIN' ? 'Admin' : 'Agent'})</option>
                  ))}
                </select>
                {assigneeId && (
                  <button onClick={() => mutation.mutate({ assigneeId })} disabled={mutation.isPending}
                    className="mt-2 w-full px-3 py-2 bg-sycom-500 text-white text-xs font-bold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
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
