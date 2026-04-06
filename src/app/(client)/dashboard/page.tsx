'use client'
// src/app/(client)/dashboard/page.tsx
import { useQuery } from '@tanstack/react-query'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Ticket, Clock, CheckCircle, AlertTriangle, TrendingUp, Activity } from 'lucide-react'
import { formatDateTime, statusLabels, priorityLabels } from '@/lib/utils'
import Link from 'next/link'

function StatCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: React.ReactNode
  color: string; sub?: string
}) {
  return (
    <div className="card">
      <div className="h-[3px] w-full" style={{ background: color }} />
      <div className="p-5 flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: color + '18' }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <div>
          <p className="text-[11px] font-bold tracking-wider uppercase text-gray-400 mb-1">{label}</p>
          <p className="text-3xl font-bold text-gray-800 leading-none tracking-tight"
            style={{ color }}>{value}</p>
          {sub && <p className="text-[11px] text-gray-400 mt-1.5">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn:  () => fetch('/api/reports').then(r => r.json()),
    refetchInterval: 60_000,
  })

  const { data: ticketsData } = useQuery({
    queryKey: ['tickets-recent'],
    queryFn:  () => fetch('/api/tickets?limit=5').then(r => r.json()),
  })

  if (isLoading) return (
    <PortalLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sycom-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </PortalLayout>
  )

  const s = data?.summary ?? {}

  const priorityColors: Record<string, string> = {
    CRITICAL: '#e63946', HIGH: '#e9952a', MEDIUM: '#d4a017', LOW: '#2a9d5c',
  }

  return (
    <PortalLayout>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link href="/tickets/new" className="btn btn-primary">
          <span>+</span> Nový tiket
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Otvorené tikety"  value={s.totalOpen ?? 0}        icon={<Ticket size={20}/>}        color="#1a6fba" sub={`${s.criticalOpen ?? 0} kritických`} />
        <StatCard label="V riešení"         value={s.totalInProgress ?? 0}  icon={<Activity size={20}/>}      color="#e9952a" sub="Aktívne prípady" />
        <StatCard label="Vyriešené dnes"    value={s.resolvedToday ?? 0}    icon={<CheckCircle size={20}/>}   color="#2a9d5c" sub="Dnes uzavreté" />
        <StatCard label="Priem. riešenie"   value={`${s.avgResolutionHours ?? 0}h`} icon={<Clock size={20}/>} color="#7b3fbe" sub="Čas odozvy" />
      </div>

      {/* Charts + Recent */}
      <div className="grid grid-cols-2 gap-5 mb-5">

        {/* Bar chart - tickets per day */}
        <div className="card">
          <div className="card-stripe" />
          <div className="card-header">
            <TrendingUp size={15} className="text-sycom-500" />
            <span className="card-title">Tikety za posledných 7 dní</span>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data?.ticketsPerDay ?? []} barSize={28}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7089a4' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#7089a4' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'white', border: '1px solid #dde3ec', borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: '#e8f2fc' }}
                />
                <Bar dataKey="count" name="Tikety" radius={[4, 4, 0, 0]} fill="#1a6fba" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority breakdown */}
        <div className="card">
          <div className="card-stripe" />
          <div className="card-header">
            <AlertTriangle size={15} className="text-sycom-500" />
            <span className="card-title">Tikety podľa priority</span>
          </div>
          <div className="p-5 space-y-3">
            {(data?.byPriority ?? []).map((p: any) => {
              const total = (data?.byPriority ?? []).reduce((a: number, x: any) => a + x._count, 0)
              const pct   = total ? Math.round((p._count / total) * 100) : 0
              const color = priorityColors[p.priority] ?? '#1a6fba'
              return (
                <div key={p.priority}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-600">{priorityLabels[p.priority]}</span>
                    <span className="text-xs font-bold" style={{ color }}>{p._count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* SLA + Recent Tickets */}
      <div className="grid grid-cols-2 gap-5">

        {/* SLA */}
        <div className="card">
          <div className="card-stripe" />
          <div className="card-header">
            <Clock size={15} className="text-sycom-500" />
            <span className="card-title">Dodržiavanie SLA</span>
            <span className="text-[11px] text-gray-400">Posledných 30 dní</span>
          </div>
          {[
            { label: '🔴 Kritická — cieľ 1 hod',   pct: 87, color: '#e63946' },
            { label: '🟠 Vysoká — cieľ 4 hod',      pct: 94, color: '#e9952a' },
            { label: '🟢 Stredná — cieľ 24 hod',    pct: 99, color: '#2a9d5c' },
          ].map(item => (
            <div key={item.label} className="px-5 py-3.5 border-b border-gray-100 last:border-0">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-gray-700">{item.label}</span>
                <span className="text-sm font-bold" style={{ color: item.color }}>{item.pct}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: item.color }} />
              </div>
            </div>
          ))}
        </div>

        {/* Recent Tickets */}
        <div className="card">
          <div className="card-stripe" />
          <div className="card-header">
            <Ticket size={15} className="text-sycom-500" />
            <span className="card-title">Posledné tikety</span>
            <Link href="/tickets" className="btn btn-ghost btn-sm">Všetky</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {(ticketsData?.tickets ?? []).map((t: any) => (
              <Link key={t.id} href={`/tickets/${t.ticketNumber}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-sycom-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs text-sycom-500 font-medium">#T-{t.ticketNumber}</span>
                    <span className={`badge-${t.priority.toLowerCase()}`}>
                      {priorityLabels[t.priority]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 truncate font-medium">{t.subject}</p>
                  <p className="text-[11px] text-gray-400">{formatDateTime(t.createdAt)}</p>
                </div>
                <span className={`status-${t.status.toLowerCase()}`}>
                  {statusLabels[t.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PortalLayout>
  )
}
