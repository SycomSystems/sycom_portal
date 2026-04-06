'use client'
// src/app/(client)/tickets/page.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PortalLayout } from '@/components/layout/PortalLayout'
import Link from 'next/link'
import { Search, Plus, Filter, Eye } from 'lucide-react'
import { formatDateTime, priorityLabels, statusLabels, categoryLabels } from '@/lib/utils'
import { cn } from '@/lib/utils'

const STATUS_FILTERS = ['Všetky', 'OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']
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

  const params = new URLSearchParams()
  if (search)                params.set('search', search)
  if (status !== 'Všetky')   params.set('status', status)
  if (priority !== 'Všetky') params.set('priority', priority)

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', search, status, priority],
    queryFn:  () => fetch(`/api/tickets?${params}`).then(r => r.json()),
    placeholderData: (prev: any) => prev,
  })

  return (
    <PortalLayout>
      <div className="max-w-5xl mx-auto py-8 px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Moje tikety</h1>
            <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} tikety celkom</p>
          </div>
          <Link href="/tickets/new" className="flex items-center gap-2 px-4 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 transition-colors">
            <Plus size={15} /> Nový tiket
          </Link>
        </div>

        {/* Search + Filters */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"
              placeholder="Hľadať podľa predmetu alebo popisu…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
              <Filter size={10} /> Stav:
            </span>
            {STATUS_FILTERS.map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={cn('text-xs font-semibold px-3 py-1.5 rounded-full border transition-all',
                  status === s ? 'bg-sycom-500 text-white border-sycom-500' : 'bg-white text-gray-500 border-gray-200 hover:border-sycom-400')}>
                {statusLabels[s] ?? s}
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
              <Filter size={10} /> Priorita:
            </span>
            {PRIORITY_FILTERS.map(p => (
              <button key={p} onClick={() => setPriority(p)}
                className={cn('text-xs font-semibold px-3 py-1.5 rounded-full border transition-all',
                  priority === p ? 'bg-sycom-500 text-white border-sycom-500' : 'bg-white text-gray-500 border-gray-200 hover:border-sycom-400')}>
                {priorityLabels[p] ?? p}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">ID</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Predmet</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Stav</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Priorita</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Vytvorené</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400">Načítavam...</td></tr>
              ) : (data?.tickets ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">Žiadne tikety. Vytvorte prvý tiket.</td></tr>
              ) : (data?.tickets ?? []).map((t: any) => (
                <tr key={t.id} className="hover:bg-sycom-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs text-sycom-500 font-semibold">#T-{t.ticketNumber}</span>
                  </td>
                  <td className="px-5 py-3.5 max-w-[240px]">
                    <p className="text-sm font-semibold text-gray-800 truncate">{t.subject}</p>
                    {t.creator?.client && (
                      <p className="text-xs text-gray-400 mt-0.5">{t.creator.client.name}</p>
                    )}
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
                  <td className="px-5 py-3.5 text-xs text-gray-400">
                    {formatDateTime(t.createdAt)}
                  </td>
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/tickets/${t.id}`}
                      className="flex items-center gap-1.5 text-xs font-semibold text-sycom-500 hover:text-sycom-700 transition-colors"
                    >
                      <Eye size={13} /> Zobraziť
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PortalLayout>
  )
}
