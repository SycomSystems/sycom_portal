'use client'
// src/app/(client)/tickets/page.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PortalLayout } from '@/components/layout/PortalLayout'
import Link from 'next/link'
import { Search, Plus, Filter } from 'lucide-react'
import { formatDateTime, priorityLabels, statusLabels, categoryLabels } from '@/lib/utils'
import { cn } from '@/lib/utils'

const STATUS_FILTERS = ['Všetky', 'OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']
const PRIORITY_FILTERS = ['Všetky', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export default function TicketsPage() {
  const [search,   setSearch]   = useState('')
  const [status,   setStatus]   = useState('Všetky')
  const [priority, setPriority] = useState('Všetky')

  const params = new URLSearchParams()
  if (search)              params.set('search', search)
  if (status !== 'Všetky')   params.set('status', status)
  if (priority !== 'Všetky') params.set('priority', priority)

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', search, status, priority],
    queryFn:  () => fetch(`/api/tickets?${params}`).then(r => r.json()),
    placeholderData: (prev) => prev,
  })

  return (
    <PortalLayout>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Tikety</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {data?.total ?? 0} tiketov celkom
          </p>
        </div>
        <Link href="/tickets/new" className="btn btn-primary">
          <Plus size={14} /> Nový tiket
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="card mb-5">
        <div className="p-4 flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Hľadať podľa ID, predmetu alebo popisuа…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1 mr-1">
              <Filter size={10} /> Stav:
            </span>
            {STATUS_FILTERS.map(s => (
              <button key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  'text-xs font-semibold px-3 py-1.5 rounded-full border transition-all',
                  status === s
                    ? 'bg-sycom-500 text-white border-sycom-500 shadow-sm'
                    : 'bg-white text-gray-500 border-gray-300 hover:border-sycom-400 hover:text-sycom-500'
                )}>
                {statusLabels[s] ?? s}
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1 mr-1">
              <Filter size={10} /> Priorita:
            </span>
            {PRIORITY_FILTERS.map(p => (
              <button key={p}
                onClick={() => setPriority(p)}
                className={cn(
                  'text-xs font-semibold px-3 py-1.5 rounded-full border transition-all',
                  priority === p
                    ? 'bg-sycom-500 text-white border-sycom-500 shadow-sm'
                    : 'bg-white text-gray-500 border-gray-300 hover:border-sycom-400 hover:text-sycom-500'
                )}>
                {priorityLabels[p] ?? p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-stripe" />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['ID', 'Predmet', 'Žiadateľ', 'Kategória', 'Priorita', 'Stav', 'Vytvorené', ''].map(h => (
                  <th key={h} className="text-left text-[10px] font-bold tracking-widest uppercase text-gray-400 px-5 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">Načítavam...</td></tr>
              ) : (data?.tickets ?? []).length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">Žiadne tikety</td></tr>
              ) : (
                (data?.tickets ?? []).map((t: any) => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-sycom-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-sycom-500 font-medium">#T-{t.ticketNumber}</span>
                    </td>
                    <td className="px-5 py-3.5 max-w-[240px]">
                      <p className="text-sm font-semibold text-gray-800 truncate">{t.subject}</p>
                      {t.assignee && (
                        <p className="text-[11px] text-gray-400 mt-0.5">→ {t.assignee.name}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">{t.creator?.name}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-[11px] text-gray-400">{categoryLabels[t.category]}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`badge-${t.priority.toLowerCase()}`}>
                        ● {priorityLabels[t.priority]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`status-${t.status.toLowerCase()}`}>
                        {statusLabels[t.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[11px] font-mono text-gray-400 whitespace-nowrap">
                      {formatDateTime(t.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link href={`/tickets/${t.ticketNumber}`} className="btn btn-ghost btn-sm">
                        Zobraziť
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PortalLayout>
  )
}
