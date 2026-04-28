'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatDateTime, priorityLabels, statusLabels, categoryLabels, isSlaBreached, isSlaWarning } from '@/lib/utils'
import { Send, Lock, AlertTriangle, User, Clock, ArrowLeft, Building2, Timer, CheckCircle, Trash2, Pencil, X, Save } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED']
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const CATEGORY_OPTIONS = ['HARDWARE', 'SOFTWARE', 'NETWORK', 'EMAIL', 'SECURITY', 'CLOUD', 'ONBOARDING', 'OTHER']

type HoursType = 'STANDARD' | 'STANDARD_MIMO' | 'SERVER' | 'SERVER_MIMO'
const HOURS_TYPE_OPTIONS: { value: HoursType; label: string; color: string }[] = [
  { value: 'STANDARD', label: 'Standard', color: 'bg-blue-100 text-blue-700' },
  { value: 'STANDARD_MIMO', label: 'Standard mimo prac. casu', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'SERVER', label: 'Server', color: 'bg-purple-100 text-purple-700' },
  { value: 'SERVER_MIMO', label: 'Server mimo prac. casu', color: 'bg-orange-100 text-orange-700' },
]

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  LOW: 'bg-gray-100 text-gray-500 border-gray-200',
}
const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  WAITING: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
}

function formatHours(h: number) {
  if (!h) return null
  return h % 1 === 0 ? h + ' hod' : h.toFixed(2) + ' hod'
}

export default function TicketDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [logHours, setLogHours] = useState('')
  const [logHoursType, setLogHoursType] = useState<HoursType>('STANDARD')
  const [logHoursErr, setLogHoursErr] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [assigneeId, setAssigneeId] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [editing, setEditing] = useState(false)
  const [editSubject, setEditSubject] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPriority, setEditPriority] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editClientId, setEditClientId] = useState('')

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => fetch('/api/tickets/' + id).then(r => r.json()),
    enabled: !!id,
    refetchInterval: 10000,
  })
  const { data: agentList } = useQuery({
    queryKey: ['agents'],
    queryFn: () => fetch('/api/users').then(r => r.json()).then((u: any[]) => u.filter(x => x.role === 'AGENT' || x.role === 'ADMIN')),
    enabled: role === 'ADMIN' || role === 'AGENT',
  })
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => fetch('/api/clients').then(r => r.json()),
    enabled: role === 'ADMIN',
  })

  const mutation = useMutation({
    mutationFn: (data: any) => fetch('/api/tickets/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error('Chyba'); return r.json() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] })
      queryClient.refetchQueries({ queryKey: ['ticket', id] })
      toast.success('Tiket aktualizovany')
      setComment(''); setIsInternal(false); setNewStatus('')
      setAssigneeId(''); setLogHours(''); setLogHoursErr(false)
      setEditing(false)
    },
    onError: () => toast.error('Chyba pri aktualizacii'),
  })

  async function handleDeleteComment(commentId: string) {
    if (!confirm('Naozaj chcete vymazat tento zaznam prace?')) return
    setDeletingId(commentId)
    try {
      const res = await fetch('/api/comments/' + commentId, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      queryClient.invalidateQueries({ queryKey: ['ticket', id] })
      queryClient.refetchQueries({ queryKey: ['ticket', id] })
      toast.success('Zaznam bol vymazany')
    } catch { toast.error('Chyba pri mazani') }
    finally { setDeletingId(null) }
  }

  function startEdit() {
    setEditSubject(ticket.subject)
    setEditDesc(ticket.description)
    setEditPriority(ticket.priority)
    setEditCategory(ticket.category)
    setEditClientId(ticket.clientId ?? '')
    setEditing(true)
  }

  function handleSaveEdit() {
    const payload: any = {}
    if (editSubject !== ticket.subject) payload.subject = editSubject
    if (editDesc !== ticket.description) payload.description = editDesc
    if (editPriority !== ticket.priority) payload.priority = editPriority
    if (editCategory !== ticket.category) payload.category = editCategory
    if (editClientId !== (ticket.clientId ?? '')) payload.clientId = editClientId || null
    if (Object.keys(payload).length === 0) { setEditing(false); return }
    mutation.mutate(payload)
  }

  function handleComment() {
    if (!comment.trim()) return
    mutation.mutate({ comment: comment.trim(), isInternal })
  }

  function handleLogHours() {
    const hrs = parseFloat(logHours)
    if (isNaN(hrs) || hrs <= 0) { setLogHoursErr(true); toast.error('Zadajte platny pocet hodin'); return }
    setLogHoursErr(false)
    mutation.mutate({
      comment: 'Zaevidovany cas: ' + formatHours(hrs) + ' [' + (HOURS_TYPE_OPTIONS.find(o => o.value === logHoursType)?.label ?? logHoursType) + ']',
      isInternal: true,
      workedHours: hrs,
      hoursType: logHoursType,
    })
  }

  // ── Spotrebovaný materiál ──────────────────────────────────────────────
  const [stockUsages, setStockUsages] = useState<any[]>([])
  const [stockUsageLoading, setStockUsageLoading] = useState(false)
  const [showAddUsage, setShowAddUsage] = useState(false)
  const [usageItemSearch, setUsageItemSearch] = useState('')
  const [usageItemResults, setUsageItemResults] = useState<any[]>([])
  const [usageItemSelected, setUsageItemSelected] = useState<any>(null)
  const [usageQty, setUsageQty] = useState('')
  const [usageNote, setUsageNote] = useState('')
  const [usageSubmitting, setUsageSubmitting] = useState(false)
  const [usageError, setUsageError] = useState('')

  const fetchStockUsages = async () => {
    setStockUsageLoading(true)
    try {
      const res = await fetch(`/api/tickets/${id}/stock-usage`)
      if (res.ok) {
        const data = await res.json()
        setStockUsages(Array.isArray(data) ? data : (data.usages ?? []))
      }
    } finally {
      setStockUsageLoading(false)
    }
  }

  useEffect(() => {
    if (id) fetchStockUsages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const searchStockItems = async (q: string) => {
    setUsageItemSearch(q)
    setUsageItemSelected(null)
    if (q.length < 2) { setUsageItemResults([]); return }
    const res = await fetch(`/api/stock/items?search=${encodeURIComponent(q)}&limit=10`)
    if (res.ok) {
      const data = await res.json()
      setUsageItemResults(Array.isArray(data) ? data : (data.items ?? []))
    }
  }

  const handleAddUsage = async () => {
    if (!usageItemSelected) { setUsageError('Vyberte položku zo skladu'); return }
    const qty = parseFloat(usageQty)
    if (!qty || qty <= 0) { setUsageError('Zadajte platné množstvo'); return }
    setUsageError('')
    setUsageSubmitting(true)
    try {
      const res = await fetch(`/api/tickets/${id}/stock-usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockItemId: usageItemSelected.id, qty, note: usageNote }),
      })
      if (!res.ok) {
        const err = await res.json()
        setUsageError(err.error ?? 'Chyba pri pridávaní')
      } else {
        setShowAddUsage(false)
        setUsageItemSearch('')
        setUsageItemResults([])
        setUsageItemSelected(null)
        setUsageQty('')
        setUsageNote('')
        fetchStockUsages()
      }
    } finally {
      setUsageSubmitting(false)
    }
  }

  const handleDeleteUsage = async (usageId: string) => {
    if (!confirm('Odstrániť túto položku a vrátiť ju na sklad?')) return
    const res = await fetch(`/api/tickets/${id}/stock-usage/${usageId}`, { method: 'DELETE' })
    if (res.ok) fetchStockUsages()
    else alert('Chyba pri odstraňovaní')
  }
  // ── END Spotrebovaný materiál ──────────────────────────────────────────

  if (isLoading) return <PortalLayout><div className="flex items-center justify-center h-64 text-gray-400">Nacitavam...</div>

    </PortalLayout>
  if (!ticket || ticket.error) return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto py-4 md:py-8 px-4 md:px-6 text-center">
        <p className="text-gray-500">Tiket sa nenasel.</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-sycom-500 hover:underline">← Spat</button>
                </div>
    </PortalLayout>
  )

  const isStaff = role === 'ADMIN' || role === 'AGENT'
  const isAdmin = role === 'ADMIN'
  const slaBreached = ticket.slaDeadline && isSlaBreached(ticket.slaDeadline)
  const slaWarn = ticket.slaDeadline && isSlaWarning(ticket.slaDeadline)
  const totalHours = ticket.totalWorkedHours ?? 0
  const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
  const clientName = ticket.client?.name



  return (
    <PortalLayout>
      <div className="max-w-4xl mx-auto py-4 md:py-8 px-4 md:px-6">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-sycom-500 mb-5 transition-colors">
          <ArrowLeft size={15} /> Spat na tikety
        </button>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 mb-4 md:mb-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-sycom-500">#T-{ticket.ticketNumber}</span>
                {slaBreached && <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><AlertTriangle size={11} /> SLA porusena</span>}
                {!slaBreached && slaWarn && <span className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full"><Clock size={11} /> SLA blizi</span>}
                {isStaff && totalHours > 0 && <span className="flex items-center gap-1 text-xs font-bold text-sycom-600 bg-sycom-50 px-2 py-0.5 rounded-full"><Timer size={11} /> {formatHours(totalHours)} celkom</span>}
              </div>
              {editing ? (
                <input value={editSubject} onChange={e => setEditSubject(e.target.value)} className="w-full text-xl font-bold px-3 py-1.5 border border-sycom-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sycom-100 mb-2" />
              ) : (
                <h1 className="text-xl font-bold text-gray-900 mb-1">{ticket.subject}</h1>
              )}
              {clientName && <p className="flex items-center gap-1 text-xs text-gray-400"><Building2 size={12} /> {clientName}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={'text-xs font-bold px-3 py-1 rounded-full ' + (STATUS_COLORS[ticket.status] ?? 'bg-gray-100 text-gray-500')}>
                {statusLabels[ticket.status] ?? ticket.status}
              </span>
              {isAdmin && !editing && (
                <button onClick={startEdit} title="Upravit tiket" className="p-1.5 text-gray-400 hover:text-sycom-500 hover:bg-sycom-50 rounded-lg transition-colors">
                  <Pencil size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Priorita</p>
              {editing ? (
                <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                  {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{priorityLabels[p] ?? p}</option>)}
                </select>
              ) : (
                <span className={'font-bold px-2 py-0.5 rounded-full border ' + (PRIORITY_COLORS[ticket.priority] ?? '')}>{priorityLabels[ticket.priority] ?? ticket.priority}</span>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Kategoria</p>
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
                  <option value="">bez klienta</option>
                  {(clients ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : clientName ? (
                <span className="flex items-center gap-1 text-gray-800 font-medium"><Building2 size={11} /> {clientName}</span>
              ) : <span className="text-gray-300">-</span>}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Priradeny</p>
              {ticket.assignee ? <span className="flex items-center gap-1 text-gray-800 font-medium"><User size={11} /> {ticket.assignee.name}</span> : <span className="text-gray-300">Nepriradeny</span>}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">SLA</p>
              <span className="text-gray-800 font-medium">{ticket.slaDeadline ? 'do ' + new Date(ticket.slaDeadline).toLocaleDateString('sk') : '-'}</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Vytvorene</p>
              <span className="text-gray-800 font-medium">{formatDateTime(ticket.createdAt)}</span>
            </div>
            {isStaff && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Odpracovane hodiny</p>
                <span className="flex items-center gap-1 font-bold text-sycom-600"><Timer size={11} /> {formatHours(totalHours) ?? '0 hod'}</span>
              </div>
            )}
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Popis</p>
            {editing ? (
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-sycom-400" />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
            )}
          </div>
          {editing && (
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                <X size={14} /> Zrusit
              </button>
              <button onClick={handleSaveEdit} disabled={mutation.isPending} className="flex items-center gap-1.5 px-4 py-2 bg-sycom-500 text-white text-sm font-bold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
                <Save size={14} /> Ulozit zmeny
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-gray-700">Konverzacia ({(ticket.comments ?? []).length})</h2>
            {(ticket.comments ?? []).length === 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-sm text-gray-400">Zatial ziadne spravy.</div>
            )}
            {(ticket.comments ?? []).map((c: any) => (
              <div key={c.id} className={'bg-white border rounded-2xl p-4 ' + (c.isInternal ? 'border-orange-200 bg-orange-50' : 'border-gray-200')}>
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
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {isStaff && c.workedHours > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-sycom-600 bg-sycom-50 px-2 py-0.5 rounded-full">
                        <Timer size={9} /> {formatHours(c.workedHours)}
                      </span>
                    )}
                    {isStaff && c.hoursType && (
                      <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full ' + (HOURS_TYPE_OPTIONS.find(o => o.value === c.hoursType)?.color ?? 'bg-gray-100 text-gray-500')}>
                        {HOURS_TYPE_OPTIONS.find(o => o.value === c.hoursType)?.label ?? c.hoursType}
                      </span>
                    )}
                    {c.isInternal && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                        <Lock size={9} /> Interna
                      </span>
                    )}
                    {isAdmin && c.workedHours > 0 && (
                      <button onClick={() => handleDeleteComment(c.id)} disabled={deletingId === c.id} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-500 mb-2">Pridat spravu</p>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Napisite spravu..." rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100" />
              {isStaff && (
                <label className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                  <Lock size={11} /> Interna poznamka
                </label>
              )}
              <div className="flex justify-end mt-3">
                <button onClick={handleComment} disabled={mutation.isPending || !comment.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-sycom-500 text-white text-xs font-bold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
                  <Send size={13} /> {mutation.isPending ? 'Odosielam...' : 'Odoslat'}
                </button>
              </div>
            </div>
          </div>

          {isStaff && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-gray-700">Akcie</h2>
              <div className="bg-sycom-50 border border-sycom-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-sycom-700 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Timer size={13} /> Zaevidovat hodiny</p>
                <p className="text-[11px] text-sycom-600 mb-3">Mozete pridavat hodiny opakovane.</p>
                <label className="block text-[11px] font-semibold text-sycom-700 mb-1">Typ hodin</label>
                <select value={logHoursType} onChange={e => setLogHoursType(e.target.value as HoursType)}
                  className="w-full px-3 py-2 border border-sycom-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white mb-2">
                  {HOURS_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <label className="block text-[11px] font-semibold text-sycom-700 mb-1">Pocet hodin</label>
                <input type="number" min="0.25" max="24" step="0.25" value={logHours}
                  onChange={e => { setLogHours(e.target.value); setLogHoursErr(false) }}
                  placeholder="napr. 1.5"
                  className={'w-full px-3 py-2 border rounded-xl text-sm focus:outline-none mb-2 ' + (logHoursErr ? 'border-red-400 bg-red-50' : 'border-sycom-200 focus:border-sycom-400')}
                />
                {logHoursErr && <p className="text-xs text-red-500 mb-2">Zadajte platne hodiny</p>}
                <button onClick={handleLogHours} disabled={mutation.isPending || !logHours}
                  className="w-full px-3 py-2 bg-sycom-500 text-white text-xs font-bold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  <Timer size={13} /> Pridat hodiny
                </button>
                {totalHours > 0 && <p className="text-center text-xs font-bold text-sycom-600 mt-2">Spolu: {formatHours(totalHours)}</p>}
              </div>
              {!isResolved && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><CheckCircle size={13} /> Uzatvorit tiket</p>
                  <button onClick={() => mutation.mutate({ status: 'RESOLVED' })} disabled={mutation.isPending}
                    className="w-full px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
                    Oznacit ako vyrieseny
                  </button>
                </div>
              )}
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Zmenit stav</p>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">
                  <option value="">{statusLabels[ticket.status] ?? ticket.status}</option>
                  {STATUS_OPTIONS.filter(s => s !== ticket.status).map(s => (
                    <option key={s} value={s}>{statusLabels[s] ?? s}</option>
                  ))}
                </select>
                {newStatus && (
                  <button onClick={() => mutation.mutate({ status: newStatus })} disabled={mutation.isPending}
                    className="mt-2 w-full px-3 py-2 bg-sycom-500 text-white text-xs font-bold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
                    Ulozit stav
                  </button>
                )}
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Priradit technika</p>
                <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">
                  <option value="">{ticket.assignee?.name ?? 'Nepriradeny'}</option>
                  {(agentList ?? []).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.role === 'ADMIN' ? 'Admin' : 'Technik'})</option>
                  ))}
                </select>
                {assigneeId && (
                  <button onClick={() => mutation.mutate({ assigneeId })} disabled={mutation.isPending}
                    className="mt-2 w-full px-3 py-2 bg-sycom-500 text-white text-xs font-bold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
                    Priradit
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Spotrebovaný materiál ─────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mt-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              Spotrebovaný materiál
            </p>
            {(session?.user?.role === 'AGENT' || session?.user?.role === 'ADMIN') && !showAddUsage && (
              <button
                onClick={() => setShowAddUsage(true)}
                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-sycom-500 text-white rounded-xl hover:bg-sycom-600 transition-colors"
              >
                + Pridať položku
              </button>
            )}
          </div>
        
          {showAddUsage && (
            <div className="bg-sycom-50 border border-sycom-200 rounded-2xl p-4 mb-4">
              <p className="text-xs font-bold text-sycom-700 uppercase tracking-wider mb-3">Nová položka zo skladu</p>
              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="Hľadať položku..."
                  value={usageItemSearch}
                  onChange={e => searchStockItems(e.target.value)}
                  className="w-full border border-sycom-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100 bg-white"
                />
                {usageItemResults.length > 0 && (
                  <ul className="absolute z-10 bg-white border border-gray-200 rounded-xl shadow-md w-full mt-1 max-h-48 overflow-y-auto text-sm">
                    {usageItemResults.map((item: any) => (
                      <li
                        key={item.id}
                        onClick={() => { setUsageItemSelected(item); setUsageItemSearch(item.name); setUsageItemResults([]) }}
                        className="px-3 py-2 hover:bg-sycom-50 cursor-pointer flex justify-between items-center"
                      >
                        <span>
                          <span className="font-medium">{item.name}</span>
                          {item.sku && <span className="text-gray-400 text-xs ml-2">({item.sku})</span>}
                        </span>
                        <span className="text-gray-400 text-xs">{item.currentStock} {item.unit}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex gap-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Množstvo"
                    value={usageQty}
                    onChange={e => setUsageQty(e.target.value)}
                    className="w-28 border border-sycom-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-sycom-400 bg-white"
                  />
                  {usageItemSelected && (
                    <span className="text-xs font-semibold text-sycom-600">{usageItemSelected.unit}</span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Poznámka (voliteľné)"
                  value={usageNote}
                  onChange={e => setUsageNote(e.target.value)}
                  className="flex-1 border border-sycom-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-sycom-400 bg-white"
                />
              </div>
              {usageError && <p className="text-red-500 text-xs mb-2">{usageError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleAddUsage}
                  disabled={usageSubmitting}
                  className="px-4 py-2 bg-sycom-500 text-white text-xs font-bold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors"
                >
                  {usageSubmitting ? 'Ukladám...' : 'Pridať'}
                </button>
                <button
                  onClick={() => { setShowAddUsage(false); setUsageError(''); setUsageItemSearch(''); setUsageItemResults([]); setUsageItemSelected(null); setUsageQty(''); setUsageNote('') }}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Zrušiť
                </button>
              </div>
            </div>
          )}
        
          {stockUsageLoading ? (
            <p className="text-xs text-gray-400">Načítavam...</p>
          ) : stockUsages.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Žiadny materiál nebol spotrebovaný</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="text-left pb-2">Položka</th>
                  <th className="text-left pb-2">SKU</th>
                  <th className="text-right pb-2">Množstvo</th>
                  <th className="text-left pb-2 pl-4">Poznámka</th>
                  <th className="text-left pb-2 pl-4">Pridal</th>
                  {session?.user?.role === 'ADMIN' && <th className="w-8"></th>}
                </tr>
              </thead>
              <tbody>
                {stockUsages.map((u: any) => (
                  <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-2 font-medium text-gray-800">{u.stockItem?.name ?? '—'}</td>
                    <td className="py-2 text-gray-400 text-xs">{u.stockItem?.sku ?? '—'}</td>
                    <td className="py-2 text-right font-mono text-gray-700">{u.qty} {u.stockItem?.unit ?? ''}</td>
                    <td className="py-2 pl-4 text-gray-500">{u.note ?? ''}</td>
                    <td className="py-2 pl-4 text-gray-400 text-xs">{u.createdBy?.name ?? u.createdBy?.email ?? '—'}</td>
                    {session?.user?.role === 'ADMIN' && (
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleDeleteUsage(u.id)}
                          className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Odstrániť a vrátiť na sklad"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {/* ── END Spotrebovaný materiál ──────────────────────────────── */}
      </div>
    
          
    </PortalLayout>
  )
                  }
