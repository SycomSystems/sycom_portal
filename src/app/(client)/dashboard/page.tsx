'use client'
// src/app/(client)/dashboard/page.tsx
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
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
      <div className="h-[120px] w-full" style={{ background: color }} />
      <div className="p-3 flex items-start gap-4">
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
  const { data: session } = useSession()
  const role    = (session?.user as any)?.role ?? 'CLIENT'
  const isStaff = role === 'ADMIN' || role === 'AGENT'
  const router = useRouter()
  useEffect(() => {
    if (!session) return
    if (role === 'CLIENT' || role === 'CLIENT_MANAGER') router.replace('/tickets')
  }, [role, session, router])

  const { data, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn:  () => fetch('/api/reports').then(r => r.json()),
    refetchInterval: 60_000,
  })

  const { data: ticketsData } = useQuery({
    queryKey: ['tickets-recent'],
    queryFn:  () => fetch('/api/tickets?limit=5').then(r => r.json()),
  })

  const stats = [
    { label: 'Otvorené tikety',      value: data?.summary?.totalOpen       ?? '—', icon: <Ticket size={20} />,       color: '#3b82f6', sub: 'celkom aktívnych' },
    { label: 'Vyriešené dnes',       value: data?.summary?.resolvedToday   ?? '—', icon: <CheckCircle size={20} />,   color: '#10b981', sub: 'dnes uzatvorených' },
    { label: 'Priemerný čas',        value: data?.summary?.avgResolutionHours ?? '—', icon: <Clock size={20} />,       color: '#8b5cf6', sub: 'hodín na vyriešenie' },
    { label: 'Kritické tikety',      value: data?.summary?.criticalOpen    ?? '—', icon: <AlertTriangle size={20} />, color: '#ef4444', sub: 'vyžaduje pozornosť' },
  ]

  const PRIORITY_COLORS: Record<string, string> = {
    LOW:      '#22c55e', MEDIUM: '#f59e0b',
    HIGH:     '#f97316', CRITICAL: '#ef4444',
  }

  return (
    <PortalLayout>
      <div className="w-full py-0 px-5">

        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Prehľad portálu podpory</p>
        </div>

        {/* Stat cards — staff only */}
        {isStaff && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
            {stats.map(s => <StatCard key={s.label} {...s} />)}
          </div>
        )}

        {/* Charts + Recent — staff only */}
        {isStaff && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">

            {/* Bar chart — tickets per day */}
            <div className="card">
              <div className="card-stripe" />
              <div className="card-header">
                <TrendingUp size={15} className="text-sycom-500" />
                <span className="card-title">Tikety za posledných 7 dní</span>
              </div>
              <div className="p-3">
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
                <Activity size={15} className="text-sycom-500" />
                <span className="card-title">Tikety podľa priority</span>
              </div>
              <div className="p-3 space-y-3">
                {(data?.byPriority ?? []).map((p: any) => {
                  const total = (data?.byPriority ?? []).reduce((s: number, x: any) => s + x._count, 0)
                  const pct = total ? Math.round((p._count / total) * 100) : 0
                  const color = PRIORITY_COLORS[p.priority] ?? '#94a3b8'
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
        )}

        {/* SLA + Recent Tickets — staff only */}
        {isStaff && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            {/* SLA */}
            <div className="card">
              <div className="card-stripe" />
              <div className="card-header">
                <Clock size={15} className="text-sycom-500" />
                <span className="card-title">Dodržiavanie SLA</span>
              </div>
              <div className="p-3 space-y-3">
                {[
                  { label: 'Dnes',        value: data?.summary?.slaToday,   total: data?.summary?.resolvedToday },
                  { label: 'Tento týždeň', value: data?.summary?.slaWeek,    total: data?.summary?.resolvedWeek },
                  { label: 'Tento mesiac', value: data?.summary?.slaMonth,   total: data?.summary?.resolvedMonth },
                ].map(({ label, value, total }) => {
                  const pct = total ? Math.round(((value ?? 0) / total) * 100) : 0
                  const color = pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444'
                  return (
                    <div key={label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-600">{label}</span>
                        <span className="text-xs font-bold" style={{ color }}>{value ?? 0}/{total ?? 0} ({pct}%)</span>
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
                  <Link key={t.id} href={`/tickets/${t.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-sycom-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs text-sycom-500 font-medium">#T-{t.ticketNumber}</span>
                        <span className={`badge-${t.priority.toLowerCase()}`}>{priorityLabels[t.priority]}</span>
                      </div>
                      <p className="text-sm text-gray-700 truncate font-medium">{t.subject}</p>
                      <p className="text-[11px] text-gray-400">{formatDateTime(t.createdAt)}</p>
                    </div>
                    <span className={`badge-${t.status.toLowerCase().replace('_','-')}`}>{statusLabels[t.status]}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CLIENT / CLIENT_MANAGER view */}
        {!isStaff && (
          <div className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
              <Ticket size={32} className="text-sycom-400 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-gray-800 mb-1">Vaše tikety</h2>
              <p className="text-sm text-gray-500 mb-4">Sledujte stav vašich požiadaviek na podporu.</p>
              <div className="flex gap-3 justify-center">
                <Link href="/tickets" className="px-4 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 transition-colors">
                  Zobraziť tikety
                </Link>
                <Link href="/tickets/new" className="px-4 py-2 border border-sycom-200 text-sycom-600 text-sm font-semibold rounded-xl hover:bg-sycom-50 transition-colors">
                  Nový tiket
                </Link>
              </div>
            </div>

            {/* Show their own recent tickets */}
            {(ticketsData?.tickets ?? []).length > 0 && (
              <div className="card">
                <div className="card-stripe" />
                <div className="card-header">
                  <Ticket size={15} className="text-sycom-500" />
                  <span className="card-title">Moje posledné tikety</span>
                  <Link href="/tickets" className="btn btn-ghost btn-sm">Všetky</Link>
                </div>
                <div className="divide-y divide-gray-100">
                  {(ticketsData?.tickets ?? []).map((t: any) => (
                    <Link key={t.id} href={`/tickets/${t.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-sycom-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-xs text-sycom-500 font-medium">#T-{t.ticketNumber}</span>
                          <span className={`badge-${t.priority.toLowerCase()}`}>{priorityLabels[t.priority]}</span>
                        </div>
                        <p className="text-sm text-gray-700 truncate font-medium">{t.subject}</p>
                        <p className="text-[11px] text-gray-400">{formatDateTime(t.createdAt)}</p>
                      </div>
                      <span className={`badge-${t.status.toLowerCase().replace('_','-')}`}>{statusLabels[t.status]}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </PortalLayout>
  )
}
