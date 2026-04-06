'use client'
// src/app/(admin)/admin/reports/page.tsx
import { useQuery } from '@tanstack/react-query'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { priorityLabels, statusLabels, categoryLabels } from '@/lib/utils'

const COLORS = ['#1a6fba', '#e63946', '#e9952a', '#2a9d5c', '#7b3fbe', '#d4a017']

export default function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn:  () => fetch('/api/reports').then(r => r.json()),
  })

  if (isLoading) return (
    <PortalLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sycom-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </PortalLayout>
  )

  const s = data?.summary ?? {}

  const statusChartData  = (data?.byStatus ?? []).map((x: any) => ({ name: statusLabels[x.status],   value: x._count }))
  const categoryChartData = (data?.byCategory ?? []).map((x: any) => ({ name: categoryLabels[x.category], value: x._count }))

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Reporty & Štatistiky</h1>
        <p className="text-sm text-gray-400 mt-0.5">Prehľad výkonnosti tímu a tiketov</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Otvorené tikety',    value: s.totalOpen ?? 0,           color: '#1a6fba' },
          { label: 'Tento mesiac',        value: s.totalThisMonth ?? 0,      color: '#7b3fbe' },
          { label: 'SLA porušení',        value: s.slaBreached ?? 0,         color: '#e63946' },
          { label: 'Priem. riešenie',     value: `${s.avgResolutionHours ?? 0}h`, color: '#2a9d5c' },
        ].map(card => (
          <div key={card.label} className="card p-5">
            <p className="text-[11px] font-bold tracking-wider uppercase text-gray-400 mb-1">{card.label}</p>
            <p className="text-3xl font-bold tracking-tight" style={{ color: card.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        <div className="card">
          <div className="card-stripe" />
          <div className="card-header"><span className="card-title">Tikety za posledných 7 dní</span></div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.ticketsPerDay ?? []} barSize={30}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7089a4' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#7089a4' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} cursor={{ fill: '#e8f2fc' }} />
                <Bar dataKey="count" name="Tikety" fill="#1a6fba" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-stripe" />
          <div className="card-header"><span className="card-title">Tikety podľa stavu</span></div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {statusChartData.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-2 gap-5">
        <div className="card">
          <div className="card-stripe" />
          <div className="card-header"><span className="card-title">Tikety podľa kategórie</span></div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryChartData} layout="vertical" barSize={16}>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#7089a4' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#7089a4' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} cursor={{ fill: '#e8f2fc' }} />
                <Bar dataKey="value" name="Tikety" fill="#1a6fba" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SLA compliance */}
        <div className="card">
          <div className="card-stripe" />
          <div className="card-header"><span className="card-title">Dodržiavanie SLA</span></div>
          <div className="divide-y divide-gray-100">
            {[
              { label: '🔴 Kritická — cieľ 1 hod',  pct: 87, color: '#e63946' },
              { label: '🟠 Vysoká — cieľ 4 hod',     pct: 94, color: '#e9952a' },
              { label: '🟢 Stredná — cieľ 24 hod',   pct: 99, color: '#2a9d5c' },
              { label: '⚪ Nízka — cieľ 72 hod',     pct: 100, color: '#7089a4' },
            ].map(item => (
              <div key={item.label} className="px-5 py-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-gray-700">{item.label}</span>
                  <span className="text-sm font-bold" style={{ color: item.color }}>{item.pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PortalLayout>
  )
}
