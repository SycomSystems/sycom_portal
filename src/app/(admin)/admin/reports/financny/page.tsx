'use client'
import { useState, useEffect, useCallback } from 'react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, AlertTriangle,
  CheckCircle, Clock, Users, Building2, ChevronLeft, Loader2, X, RefreshCw,
} from 'lucide-react'
import Link from 'next/link'

function fmt(n: number) {
  return n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function fmtShort(n: number) {
  if (Math.abs(n) >= 1000) return (n / 1000).toLocaleString('sk-SK', { maximumFractionDigits: 1 }) + 'k €'
  return n.toLocaleString('sk-SK', { maximumFractionDigits: 0 }) + ' €'
}
function monthLabel(k: string) {
  const [y, m] = k.split('-')
  return ['jan','feb','mar','apr','máj','jún','júl','aug','sep','okt','nov','dec'][parseInt(m)-1] + ' ' + y.slice(2)
}
function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

const COLORS = ['#1a6fba','#e63946','#2a9d5c','#e9952a','#7b3fbe','#d4a017','#14b8a6','#f43f5e']

function SummaryCard({ title, value, sub, icon, color, negative }: {
  title: string; value: string; sub?: string; icon: React.ReactNode; color: string; negative?: boolean
}) {
  return (
    <div className="bg-white border rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{title}</p>
        <p className={`text-xl font-bold ${negative ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold">{fmtShort(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// Quick month presets derived from data
function MonthButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
        active ? 'bg-sycom-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}>
      {label}
    </button>
  )
}


// ── Per-company section ──────────────────────────────────────────────────────
function PerCompanySection() {
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom]       = useState('')
  const [to, setTo]           = useState('')
  const [activePreset, setActivePreset] = useState('all')
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const load = useCallback((f: string, t: string) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (f) params.set('from', f)
    if (t) params.set('to', t)
    fetch(`/api/reports/financial?${params}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Fetch on mount and whenever the page becomes visible again (e.g. after navigating back)
  // Load on mount + every time page is shown (handles soft navigation & browser back)
  useEffect(() => {
    load(from, to)
    const onShow = () => load(from, to)
    window.addEventListener('pageshow', onShow)
    window.addEventListener('focus', onShow)
    return () => {
      window.removeEventListener('pageshow', onShow)
      window.removeEventListener('focus', onShow)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyPreset = (key: string, f: string, t: string) => {
    setActivePreset(key); setFrom(f); setTo(t); load(f, t)
  }
  const clearFilter = () => { setActivePreset('all'); setFrom(''); setTo(''); setSelectedYear(null); load('', '') }
  const applyCustom = () => { setActivePreset('custom'); load(from, to) }

  const allMonthsC: { key: string; label: string; from: string; to: string; year: number }[] = (data?.monthly ?? []).map((m: any) => {
    const [y, mo] = m.month.split('-').map(Number)
    const last = new Date(y, mo, 0).getDate()
    return { key: m.month, label: monthLabel(m.month), year: y, from: m.month + '-01', to: `${m.month}-${String(last).padStart(2,'0')}` }
  })
  const availableYearsC = Array.from(new Set(allMonthsC.map(m => m.year))).sort((a,b) => b-a)
  const monthsInYearC = (y: number) => allMonthsC.filter(m => m.year === y)
  const companies: any[] = data?.perCompany ?? []
  const SYCOM_SYSTEMS_ICO = '53035780'

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Building2 className="w-5 h-5 text-sycom-500" />
        <h2 className="text-base font-bold text-gray-800">Prehľad podľa firiem</h2>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-1" />}
      </div>

      {/* Company section filter — hierarchical */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rok:</span>
          <MonthButton label="Všetko" active={activePreset === 'all' && !selectedYear} onClick={clearFilter} />
          {availableYearsC.map(y => (
            <MonthButton key={y} label={String(y)} active={selectedYear === y}
              onClick={() => { setSelectedYear(selectedYear === y ? null : y); setActivePreset('all') }} />
          ))}
        </div>
        {selectedYear && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mesiac:</span>
            <MonthButton label="Celý rok" active={activePreset === `year-${selectedYear}`}
              onClick={() => applyPreset(`year-${selectedYear}`, `${selectedYear}-01-01`, `${selectedYear}-12-31`)} />
            {monthsInYearC(selectedYear).map(mp => (
              <MonthButton key={mp.key} label={mp.label} active={activePreset === mp.key}
                onClick={() => applyPreset(mp.key, mp.from, mp.to)} />
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap border-t border-gray-100 pt-3">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-sycom-300" />
          <span className="text-gray-400 text-sm">—</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-sycom-300" />
          <button onClick={applyCustom}
            className="px-4 py-1.5 bg-sycom-500 text-white text-sm font-medium rounded-lg hover:bg-sycom-600">
            Použiť
          </button>
          {activePreset !== 'all' && (
            <button onClick={clearFilter} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" /> Zrušiť
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-100">
              <th className="text-left pb-3 pr-6 text-xs font-bold text-gray-500 uppercase tracking-wide">Firma</th>
              <th className="text-right pb-3 pr-4 text-xs font-bold text-gray-500 uppercase tracking-wide">Vydané faktúry</th>
              <th className="text-right pb-3 pr-4 text-xs font-bold text-gray-500 uppercase tracking-wide">z toho uhradené</th>
              <th className="text-right pb-3 pr-4 text-xs font-bold text-gray-500 uppercase tracking-wide">Prijaté faktúry</th>
              <th className="text-right pb-3 pr-4 text-xs font-bold text-gray-500 uppercase tracking-wide">Odh. zisk</th>
              <th className="text-right pb-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Odhad DPH</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {companies.map((co: any) => {
              const isPositive = co.zisk >= 0
              return (
                <tr key={co.id} className="hover:bg-gray-50/60">
                  <td className="py-3.5 pr-6">
                    <div className="font-semibold text-gray-900">{co.name}</div>
                    <div className="text-xs text-gray-400">IČO: {co.ico}</div>
                  </td>
                  <td className="py-3.5 pr-4 text-right">
                    <div className="font-semibold text-gray-900">{fmt(co.sumaVydane)}</div>
                    <div className="text-xs text-gray-400">{co.countVydane} fakt.</div>
                  </td>
                  <td className="py-3.5 pr-4 text-right">
                    <div className={`font-semibold ${co.sumaUhrad > 0 ? 'text-green-600' : 'text-gray-400'}`}>{fmt(co.sumaUhrad)}</div>
                    <div className="text-xs text-gray-400">{co.countUhrad} fakt.</div>
                  </td>
                  <td className="py-3.5 pr-4 text-right">
                    <div className="font-semibold text-gray-900">{fmt(co.sumaPrijate)}</div>
                    <div className="text-xs text-gray-400">{co.countPrijate} fakt.</div>
                  </td>
                  <td className="py-3.5 pr-4 text-right">
                    <div className={`font-bold text-base ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? '+' : ''}{fmt(co.zisk)}
                    </div>
                  </td>
                  <td className="py-3.5 text-right">
                    {co.dph != null ? (
                      <div>
                        <div className={`font-bold text-base ${co.dph >= 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {co.dph >= 0 ? '+' : ''}{fmt(co.dph)}
                        </div>
                        <div className="text-xs text-gray-400">23% zo zisku</div>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {companies.length > 0 && (
              <tr className="border-t-2 border-gray-200 bg-gray-50/50">
                <td className="py-3 pr-6 text-xs font-bold text-gray-500 uppercase tracking-wide">Spolu</td>
                <td className="py-3 pr-4 text-right font-bold text-gray-900">{fmt(companies.reduce((s:number, c:any) => s + c.sumaVydane, 0))}</td>
                <td className="py-3 pr-4 text-right font-bold text-green-600">{fmt(companies.reduce((s:number, c:any) => s + c.sumaUhrad, 0))}</td>
                <td className="py-3 pr-4 text-right font-bold text-gray-900">{fmt(companies.reduce((s:number, c:any) => s + c.sumaPrijate, 0))}</td>
                <td className="py-3 pr-4 text-right">
                  {(() => { const t = companies.reduce((s:number,c:any) => s+c.zisk,0); return <span className={`font-bold text-base ${t>=0?'text-green-600':'text-red-600'}`}>{t>=0?'+':''}{fmt(t)}</span> })()}
                </td>
                <td className="py-3 text-right">
                  {(() => { const t = companies.filter((c:any)=>c.dph!=null).reduce((s:number,c:any)=>s+c.dph,0); return companies.some((c:any)=>c.dph!=null) ? <span className="font-bold text-amber-600">{t>=0?'+':''}{fmt(t)}</span> : null })()}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function FinancnyReport() {
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom]           = useState('')
  const [to, setTo]               = useState('')
  const [activePreset, setActivePreset] = useState<string>('all')
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const load = useCallback((f: string, t: string) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (f) params.set('from', f)
    if (t) params.set('to', t)
    fetch(`/api/reports/financial?${params}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Fetch on mount and whenever the page becomes visible again (e.g. after navigating back)
  useEffect(() => { load(from, to) }, [])
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(from, to) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [from, to, load])

  const applyCustomRange = () => {
    setActivePreset('custom')
    load(from, to)
  }

  const applyPreset = (key: string, f: string, t: string) => {
    setActivePreset(key)
    setFrom(f); setTo(t)
    load(f, t)
  }

  const clearFilter = () => {
    setFrom(''); setTo(''); setActivePreset('all')
    load('', '')
  }

  // Build year list + months-per-year from available data
  const allMonths: { key: string; label: string; from: string; to: string; year: number }[] = (data?.monthly ?? []).map((m: any) => {
    const [y, mo] = m.month.split('-').map(Number)
    const last = new Date(y, mo, 0).getDate()
    return {
      key: m.month, label: monthLabel(m.month), year: y,
      from: m.month + '-01',
      to: `${m.month}-${String(last).padStart(2, '0')}`,
    }
  })
  const availableYears = Array.from(new Set(allMonths.map(m => m.year))).sort((a,b) => b-a)
  const monthsInYear = (y: number) => allMonths.filter(m => m.year === y)

  if (!data && loading) return (
    <PortalLayout>
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-sycom-500" />
      </div>
    </PortalLayout>
  )

  const { summary = {}, monthly = [], topSuppliers = [], topCustomers = [], unpaid = [], invoiceCount = {} } = data ?? {}
  const monthlyLabeled = monthly.map((m: any) => ({ ...m, label: monthLabel(m.month) }))
  const overdueCount = unpaid.filter((i: any) => i.overdueDays > 0).length
  const hasFilter = activePreset !== 'all'

  return (
    <PortalLayout>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/admin/reports" className="text-gray-400 hover:text-sycom-500">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Finančný report</h1>
            <p className="text-sm text-gray-400 mt-0.5">Príjmy, výdavky a pohľadávky z faktúr</p>
          </div>
          <button onClick={() => load(from, to)}
            className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Obnoviť
          </button>
        </div>

        {/* Filter bar — hierarchical year → month */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rok:</span>
            <MonthButton label="Všetko" active={activePreset === 'all' && !selectedYear} onClick={clearFilter} />
            {availableYears.map(y => (
              <MonthButton key={y} label={String(y)} active={selectedYear === y}
                onClick={() => { setSelectedYear(selectedYear === y ? null : y); setActivePreset('all') }} />
            ))}
          </div>
          {selectedYear && (
            <div className="flex items-center gap-3 flex-wrap border-t border-gray-100 pt-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mesiac {selectedYear}:</span>
              <MonthButton label="Celý rok" active={activePreset === `year-${selectedYear}`}
                onClick={() => applyPreset(`year-${selectedYear}`, `${selectedYear}-01-01`, `${selectedYear}-12-31`)} />
              {monthsInYear(selectedYear).map(mp => (
                <MonthButton key={mp.key} label={mp.label} active={activePreset === mp.key}
                  onClick={() => applyPreset(mp.key, mp.from, mp.to)} />
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap border-t border-gray-100 pt-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vlastný rozsah:</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sycom-300" />
            <span className="text-gray-400 text-sm">—</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sycom-300" />
            <button onClick={applyCustomRange}
              className="px-4 py-1.5 bg-sycom-500 text-white text-sm font-medium rounded-lg hover:bg-sycom-600">
              Použiť
            </button>
            {hasFilter && (
              <button onClick={clearFilter} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" /> Zrušiť filter
              </button>
            )}
          </div>
        </div>

        {/* Summary cards row 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Príjmy (vydané faktúry)" value={fmt(summary.totalIncome ?? 0)}
            sub={`${invoiceCount.income ?? 0} odberateľských faktúr`}
            icon={<TrendingUp className="w-5 h-5 text-green-600" />} color="bg-green-50" />
          <SummaryCard title="Výdavky (prijaté faktúry)" value={fmt(summary.totalExpense ?? 0)}
            sub={`${invoiceCount.expense ?? 0} dodávateľských faktúr`}
            icon={<TrendingDown className="w-5 h-5 text-red-500" />} color="bg-red-50" />
          <SummaryCard title="Odhadovaný zisk" value={fmt(summary.netProfit ?? 0)}
            sub="vydané − prijaté faktúry"
            icon={<DollarSign className="w-5 h-5 text-sycom-600" />} color="bg-sycom-50"
            negative={(summary.netProfit ?? 0) < 0} />
          <SummaryCard title="Čistý cashflow" value={fmt(summary.cashflow ?? 0)}
            sub="uhradené príjmy − výdavky"
            icon={<CheckCircle className="w-5 h-5 text-teal-600" />} color="bg-teal-50"
            negative={(summary.cashflow ?? 0) < 0} />
        </div>

        {/* Summary cards row 2 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Uhradené príjmy" value={fmt(summary.totalPaid ?? 0)}
            sub={`${invoiceCount.paid ?? 0} z ${invoiceCount.income ?? 0} faktúr uhradených`}
            icon={<CheckCircle className="w-5 h-5 text-green-600" />} color="bg-green-50" />
          <SummaryCard title="Pohľadávky (neuhradené)" value={fmt(summary.totalUnpaid ?? 0)}
            sub={overdueCount > 0 ? `z toho ${overdueCount} po splatnosti` : 'žiadne po splatnosti'}
            icon={<AlertTriangle className="w-5 h-5 text-amber-500" />} color="bg-amber-50"
            negative={(summary.totalUnpaid ?? 0) > 0} />
          <SummaryCard title="Priemerná doba úhrady"
            value={summary.avgPayDays != null ? `${summary.avgPayDays} dní` : '—'}
            sub="od vystavenia po úhradu"
            icon={<Clock className="w-5 h-5 text-purple-600" />} color="bg-purple-50" />
          <SummaryCard title="Počet faktúr" value={String(invoiceCount.total ?? 0)}
            sub={`${invoiceCount.income ?? 0} príjmových / ${invoiceCount.expense ?? 0} výdavkových`}
            icon={<DollarSign className="w-5 h-5 text-gray-500" />} color="bg-gray-100" />
        </div>

        {/* Chart: Príjmy vs výdavky */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-gray-700 mb-5">Príjmy vs výdavky po mesiacoch</h2>
          {monthlyLabeled.length === 0
            ? <p className="text-sm text-gray-400 text-center py-10">Žiadne dáta pre zvolené obdobie</p>
            : <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyLabeled} barGap={4} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#9ca3af' }} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income"  name="Príjmy"   fill="#2a9d5c" radius={[4,4,0,0]} />
                  <Bar dataKey="expense" name="Výdavky"  fill="#e63946" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
          }
        </div>

        {/* Chart: Vydané vs uhradené + zisk */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-sm font-bold text-gray-700 mb-1">Vydané vs uhradené faktúry</h2>
            <p className="text-xs text-gray-400 mb-4">iba odberateľské (príjmy)</p>
            {monthlyLabeled.length === 0
              ? <p className="text-sm text-gray-400 text-center py-10">Žiadne dáta</p>
              : <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={monthlyLabeled} barGap={4} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#9ca3af' }} width={70} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="income" name="Vydané"   fill="#1a6fba" radius={[4,4,0,0]} />
                    <Bar dataKey="paid"   name="Uhradené" fill="#2a9d5c" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
            }
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-sm font-bold text-gray-700 mb-1">Odhadovaný zisk po mesiacoch</h2>
            <p className="text-xs text-gray-400 mb-4">vydané − prijaté faktúry za daný mesiac</p>
            {monthlyLabeled.length === 0
              ? <p className="text-sm text-gray-400 text-center py-10">Žiadne dáta</p>
              : <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={monthlyLabeled}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#9ca3af' }} width={70} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line dataKey="profit" name="Zisk" stroke="#7b3fbe" strokeWidth={2.5}
                      dot={{ fill: '#7b3fbe', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
            }
          </div>
        </div>

        {/* Top suppliers & customers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Building2 className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-bold text-gray-700">Top dodávatelia</h2>
            </div>
            {topSuppliers.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">Žiadne dáta</p>
              : <div className="space-y-2.5">
                  {topSuppliers.map((s: any, i: number) => {
                    const pct = topSuppliers[0].total > 0 ? (s.total / topSuppliers[0].total) * 100 : 0
                    return (
                      <div key={s.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700 font-medium truncate max-w-[200px]">{s.name}</span>
                          <span className="font-semibold text-gray-900 ml-2 flex-shrink-0">{fmt(s.total)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full">
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Users className="w-4 h-4 text-green-600" />
              <h2 className="text-sm font-bold text-gray-700">Top odberatelia</h2>
            </div>
            {topCustomers.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">Žiadne dáta</p>
              : <div className="space-y-2.5">
                  {topCustomers.map((c: any, i: number) => {
                    const pct = topCustomers[0].total > 0 ? (c.total / topCustomers[0].total) * 100 : 0
                    return (
                      <div key={c.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700 font-medium truncate max-w-[200px]">{c.name}</span>
                          <span className="font-semibold text-gray-900 ml-2 flex-shrink-0">{fmt(c.total)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full">
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: '#2a9d5c' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        </div>

        {/* Unpaid receivables */}
        {unpaid.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-gray-700">Neuhradené pohľadávky ({unpaid.length})</h2>
              <span className="ml-auto text-sm font-semibold text-gray-900">{fmt(summary.totalUnpaid ?? 0)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Odberateľ','Číslo faktúry','Dátum vydania','Suma','Splatnosť','Stav'].map(h => (
                      <th key={h} className="text-left pb-2 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {unpaid.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 pr-4 font-medium text-gray-900 max-w-[200px] truncate">{inv.customerName || '—'}</td>
                      <td className="py-2.5 pr-4 text-gray-500 font-mono text-xs">{inv.invoiceNumber || '—'}</td>
                      <td className="py-2.5 pr-4 text-gray-500 text-xs">{inv.issueDate || '—'}</td>
                      <td className="py-2.5 pr-4 font-semibold">{fmt(inv.totalAmount)}</td>
                      <td className="py-2.5 pr-4 text-gray-500">{inv.dueDate || '—'}</td>
                      <td className="py-2.5">
                        {inv.overdueDays == null
                          ? <span className="text-xs text-gray-400">bez splatnosti</span>
                          : inv.overdueDays > 0
                            ? <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Po splatnosti {inv.overdueDays}d</span>
                            : <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Splatná o {-inv.overdueDays}d</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Per-company breakdown */}
        <PerCompanySection />

      </div>
    </PortalLayout>
  )
}
