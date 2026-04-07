'use client'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { priorityLabels, statusLabels, categoryLabels } from '@/lib/utils'
import { FileText, ArrowRight } from 'lucide-react'

const COLORS = ['#1a6fba', '#e63946', '#e9952a', '#2a9d5c', '#7b3fbe', '#d4a017']

const reportTypes = [
  {
    href: '/admin/reports/vykaz',
    title: 'Vykaz',
    desc: 'Odpracovane hodiny a predany tovar pre klienta za zvolene obdobie. Export do PDF.',
    icon: <FileText size={22} className="text-sycom-500" />,
    color: 'border-sycom-200 hover:border-sycom-400',
    badge: 'bg-sycom-50 text-sycom-600',
  },
]

export default function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => fetch('/api/reports').then(r => r.json()),
  })

  const s = data?.summary ?? {}
  const statusChartData = (data?.byStatus ?? []).map((x: any) => ({ name: statusLabels[x.status], value: x._count }))
  const categoryChartData = (data?.byCategory ?? []).map((x: any) => ({ name: categoryLabels[x.category], value: x._count }))

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Reporty & Statistiky</h1>
        <p className="text-sm text-gray-400 mt-0.5">Prehlad vykonnosti timu, tiketov a export reportov</p>
      </div>

      {/* Reports hub */}
      <div className="mb-8">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Exportovatelne reporty</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map(r => (
            <Link key={r.href} href={r.href}
              className={`group flex flex-col bg-white border-2 rounded-2xl p-5 transition-all ${r.color} hover:shadow-md`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-sycom-50 flex items-center justify-center">
                  {r.icon}
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-sycom-400 transition-colors mt-1" />
              </div>
              <p className="text-base font-bold text-gray-900 mb-1">{r.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{r.desc}</p>
            </Link>
          ))}
          {/* Placeholder for future reports */}
          <div className="flex flex-col bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-5 items-center justify-center text-center opacity-50">
            <p className="text-xs font-medium text-gray-400">Dalsi report</p>
            <p className="text-[11px] text-gray-400 mt-1">Coskoro</p>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-sycom-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Statistiky tiketov</h2>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Otvorene tikety', value: s.totalOpen ?? 0, color: '#1a6fba' },
              { label: 'Tento mesiac', value: s.totalThisMonth ?? 0, color: '#7b3fbe' },
              { label: 'SLA poruseni', value: s.slaBreached ?? 0, color: '#e63946' },
              { label: 'Priem. riesenie', value: `${s.avgResolutionHours ?? 0}h`, color: '#2a9d5c' },
            ].map(card => (
              <div key={card.label} className="card p-5">
                <p className="text-[11px] font-bold tracking-wider uppercase text-gray-400 mb-1">{card.label}</p>
                <p className="text-3xl font-bold tracking-tight" style={{ color: card.color }}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-5 mb-5">
            <div className="card">
              <div className="card-stripe" />
              <div className="card-header"><span className="card-title">Tikety za poslednych 7 dni</span></div>
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
              <div className="card-header"><span className="card-title">Tikety podla stavu</span></div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                      {statusChartData.map((_: any, i: number) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="card">
              <div className="card-stripe" />
              <div className="card-header"><span className="card-title">Tikety podla kategorie</span></div>
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
            <div className="card">
              <div className="card-stripe" />
              <div className="card-header"><span className="card-title">Dodrzovanie SLA</span></div>
              <div className="divide-y divide-gray-100">
                {[
                  { label: 'Kriticka — ciel 1 hod', pct: 87, color: '#e63946' },
                  { label: 'Vysoka — ciel 4 hod', pct: 94, color: '#e9952a' },
                  { label: 'Stredna — ciel 24 hod', pct: 99, color: '#2a9d5c' },
                  { label: 'Nizka — ciel 72 hod', pct: 100, color: '#7089a4' },
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
        </>
      )}
    </PortalLayout>
  )
}
