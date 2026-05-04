'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import Link from 'next/link'
import { Search, Plus, Filter, Building2, ChevronRight } from 'lucide-react'
import { formatDateTime, priorityLabels, statusLabels } from '@/lib/utils'
import { cn } from '@/lib/utils'

const STATUS_FILTERS   = ['Všetky', 'OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']
const PRIORITY_FILTERS = ['Všetky', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH:     'bg-orange-100 text-orange-700',
  MEDIUM:   'bg-yellow-100 text-yellow-700',
  LOW:      'bg-gray-100 text-gray-500',
}
const STATUS_COLORS: Record<string, string> = {
  OPEN:        'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  WAITING:     'bg-yellow-100 text-yellow-700',
  RESOLVED:    'bg-green-100 text-green-700',
  CLOSED:      'bg-gray-100 text-gray-500',
}

export default function TicketsPage() {
  const [search,   setSearch]   = useState('')
  const [status,   setStatus]   = useState('Všetky')
  const [priority, setPriority] = useState('Všetky')
  const [page,     setPage]     = useState(1)
  const [limit,    setLimit]    = useState(20)
  const { data: session } = useSession()
  const isAdmin = ['ADMIN', 'AGENT'].includes((session?.user as any)?.role)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatus,  setBulkStatus]  = useState('')
  const [bulkAssignee, setBulkAssignee] = useState('')
  const [bulkLoading,  setBulkLoading]  = useState(false)

  const params = new URLSearchParams()
  if (search)                params.set('search', search)
  if (status !== 'Všetky')   params.set('status', status)
  if (priority !== 'Všetky') params.set('priority', priority)
  params.set('page', String(page))
  params.set('limit', String(limit))

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', search, status, priority, page, limit],
    queryFn:  () => fetch(`/api/tickets?${params}`).then(r => r.json()),
    placeholderData: (prev: any) => prev,
  })

  const tickets = data?.tickets ?? []
  const { data: agentList } = useQuery({
    queryKey: ['agents'],
    queryFn: () => fetch('/api/users').then(r => r.json()),
    enabled: isAdmin,
  })
  const agents = (agentList ?? []).filter((u: any) => u.role === 'ADMIN' || u.role === 'AGENT')

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const selectAll = () => setSelectedIds(new Set(tickets.map((t: any) => t.id)))
  const clearSelection = () => setSelectedIds(new Set())

  const bulkAction = async (action: string, extra?: any) => {
    setBulkLoading(true)
    await fetch('/api/tickets/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ids: Array.from(selectedIds), ...extra }),
    })
    clearSelection()
    setBulkLoading(false)
    // trigger refetch
    setPage(p => p)
  }

  return (
    <PortalLayout>
      <div className="w-full py-2 px-4 md:px-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Tikety</h1>
            <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} tikety celkom</p>
          </div>
          <Link href="/tickets/new"
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 transition-colors">
            <Plus size={15} />
            <span className="hidden sm:inline">Nový tiket</span>
            <span className="sm:hidden">Nový</span>
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-2xl p-3 md:p-4 mb-3 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"
              placeholder="Hľadať podľa predmetu…" />
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1 mr-1"><Filter size={10} /> Stav:</span>
            {STATUS_FILTERS.map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border transition-all',
                  status === s ? 'bg-sycom-500 text-white border-sycom-500' : 'bg-white text-gray-500 border-gray-200 hover:border-sycom-400')}>
                {statusLabels[s] ?? s}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1 mr-1"><Filter size={10} /> Priorita:</span>
            {PRIORITY_FILTERS.map(p => (
              <button key={p} onClick={() => setPriority(p)}
                className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border transition-all',
                  priority === p ? 'bg-sycom-500 text-white border-sycom-500' : 'bg-white text-gray-500 border-gray-200 hover:border-sycom-400')}>
                {priorityLabels[p] ?? p}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk action bar */}
        {isAdmin && selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-sycom-50 border border-sycom-200 rounded-2xl px-4 py-2.5 mb-3">
            <span className="text-xs font-bold text-sycom-700">{selectedIds.size} vybraných</span>
            <button onClick={clearSelection} className="text-xs text-gray-500 hover:text-gray-700 underline">Zrušiť výber</button>
            <div className="flex-1" />
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
              <option value="">Zmeniť stav...</option>
              {['OPEN','IN_PROGRESS','WAITING','RESOLVED','CLOSED'].map(s => (
                <option key={s} value={s}>{statusLabels[s] ?? s}</option>
              ))}
            </select>
            {bulkStatus && <button onClick={() => bulkAction('status', { status: bulkStatus })} disabled={bulkLoading} className="text-xs px-3 py-1.5 bg-sycom-500 text-white rounded-lg hover:bg-sycom-600 disabled:opacity-50">Použiť</button>}
            <select value={bulkAssignee} onChange={e => setBulkAssignee(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
              <option value="">Priradiť technika...</option>
              {agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {bulkAssignee && <button onClick={() => bulkAction('assign', { assigneeId: bulkAssignee })} disabled={bulkLoading} className="text-xs px-3 py-1.5 bg-sycom-500 text-white rounded-lg hover:bg-sycom-600 disabled:opacity-50">Priradiť</button>}
            {(session?.user as any)?.role === 'ADMIN' && (
              <button onClick={() => { if(confirm(`Vymazať ${selectedIds.size} tikety?`)) bulkAction('delete') }} disabled={bulkLoading} className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
                Vymazať
              </button>
            )}
          </div>
        )}
        {/* Desktop table */}
        <div className="hidden md:block bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {isAdmin && (
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" onChange={e => e.target.checked ? selectAll() : clearSelection()}
                      checked={tickets.length > 0 && selectedIds.size === tickets.length}
                      className="rounded border-gray-300 text-sycom-500 cursor-pointer" />
                  </th>
                )}
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">ID</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Predmet</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Klient</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Stav</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Priorita</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Vytvorené</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Zadal</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Naposledy upravil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={8} className="px-5 py-4 text-center text-sm text-gray-400">Načítavam...</td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-gray-400">Žiadne tikety.</td></tr>
              ) : tickets.map((t: any) => (
                <tr key={t.id} className="hover:bg-sycom-50 transition-colors">
                  {isAdmin && (
                    <td className="px-4 py-3.5">
                      <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)}
                        className="rounded border-gray-300 text-sycom-500 cursor-pointer" />
                    </td>
                  )}
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs text-sycom-500 font-semibold">#T-{t.ticketNumber}</span>
                  </td>
                  <td className="px-5 py-3.5 max-w-[280px]">
                    <Link href={`/tickets/${t.id}`} className="text-sm font-semibold text-gray-800 hover:text-sycom-600 transition-colors truncate block">{t.subject}</Link>
                  </td>
                  <td className="px-5 py-3.5">
                    {t.client?.name ? (
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <Building2 size={12} className="text-gray-400 shrink-0" />{t.client.name}
                      </span>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {statusLabels[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[t.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                      {priorityLabels[t.priority] ?? t.priority}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-400">{formatDateTime(t.createdAt)}</td>
                <td className="px-5 py-3.5 text-xs text-gray-500">{t.creator?.name ?? '—'}</td>
                <td className="px-5 py-3.5">{t.updatedBy ? <div><p className="text-xs text-gray-700 font-medium">{t.updatedBy.name}</p><p className="text-[11px] text-gray-400">{formatDateTime(t.updatedAt)}</p></div> : <span className="text-xs text-gray-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-gray-400">Načítavam...</div>
          ) : tickets.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">Žiadne tikety.</div>
          ) : tickets.map((t: any) => (
            <Link key={t.id} href={`/tickets/${t.id}`}
              className="block bg-white border border-gray-200 rounded-2xl p-4 hover:border-sycom-300 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-sycom-500 font-semibold shrink-0">#T-{t.ticketNumber}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {statusLabels[t.status] ?? t.status}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${PRIORITY_COLORS[t.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                      {priorityLabels[t.priority] ?? t.priority}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 truncate">{t.subject}</p>
                  {t.client?.name && (
                    <p className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <Building2 size={11} className="text-gray-400" />{t.client.name}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(t.createdAt)}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>
      </div>
        {/* Pagination */}
        {(data?.total ?? 0) > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 px-1">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Riadkov na stránku:</span>
              {[20, 40, 80, 150].map(l => (
                <button key={l} onClick={() => { setLimit(l); setPage(1) }}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${limit === l ? 'bg-sycom-500 text-white border-sycom-500' : 'bg-white text-gray-500 border-gray-200 hover:border-sycom-400'}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {Math.min((page - 1) * limit + 1, data?.total ?? 0)}–{Math.min(page * limit, data?.total ?? 0)} z {data?.total ?? 0}
              </span>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                ‹ Späť
              </button>
              <span className="text-xs font-semibold text-gray-700 px-1">{page} / {Math.ceil((data?.total ?? 1) / limit)}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= (data?.total ?? 0)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Ďalší ›
              </button>
            </div>
          </div>
        )}
    </PortalLayout>
  )
}
