'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { RefreshCw, Bug, Filter, Clock } from 'lucide-react'

interface LogEntry { ts: string; level: string; msg: string }

const LEVEL_STYLES: Record<string, string> = {
  info:  'bg-blue-50 text-blue-700 border-blue-200',
  warn:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  error: 'bg-red-50 text-red-700 border-red-200',
}
const LEVEL_DOT: Record<string, string> = {
  info: 'bg-blue-400', warn: 'bg-yellow-400', error: 'bg-red-500',
}

export default function DebugPage() {
  const [entries, setEntries]   = useState<LogEntry[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [level, setLevel]       = useState('all')
  const [days, setDays]         = useState(1)
  const [autoRefresh, setAuto]  = useState(true)
  const [lastUpdate, setLast]   = useState<Date | null>(null)
  const [search, setSearch]       = useState('')
  const timerRef                = useRef<NodeJS.Timeout | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/poller-logs?days=${days}&level=${level}`)
      const d = await r.json()
      setEntries(d.entries || [])
      setTotal(d.total || 0)
      setLast(new Date())
    } catch {}
    finally { setLoading(false) }
  }, [days, level])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoRefresh) timerRef.current = setInterval(load, 30000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [autoRefresh, load])

  const fmt = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleDateString('sk-SK') + ' ' + d.toLocaleTimeString('sk-SK')
  }

  const levels = ['all','info','warn','error']
  const dayOpts = [
    { v: 1, l: '1 deň' }, { v: 7, l: '7 dní' }, { v: 30, l: '30 dní' },
    { v: 90, l: '90 dní' }, { v: 365, l: '365 dní' }
  ]

  return (
    <PortalLayout>
      <div className="w-full py-0 px-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 pt-6">
          <div className="flex items-center gap-2.5">
            <Bug size={20} className="text-gray-400" />
            <h1 className="text-xl font-bold text-gray-900">Debug — Email Poller</h1>
            {total > 0 && (
              <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {entries.length} / {total}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAuto(!autoRefresh)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${autoRefresh ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500'}`}>
              <Clock size={12} />{autoRefresh ? 'Auto 30s' : 'Manual'}
            </button>
            <button onClick={load} disabled={loading}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Načítavam...' : 'Obnoviť'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-1">
            <Filter size={13} className="text-gray-400" />
            <span className="text-xs text-gray-400 font-medium">Level:</span>
            {levels.map(l => (
              <button key={l} onClick={() => setLevel(l)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${level === l ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {l === 'all' ? 'Všetko' : l.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 font-medium">Obdobie:</span>
            {dayOpts.map(o => (
              <button key={o.v} onClick={() => setDays(o.v)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${days === o.v ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {o.l}
              </button>
            ))}
          </div>
          {lastUpdate && (
            <span className="text-xs text-gray-400 ml-auto">
              Posledná aktualizácia: {lastUpdate.toLocaleTimeString('sk-SK')}
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hľadať v logoch..."
            className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sycom-300 bg-white"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          )}
        </div>

        {/* Log table */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Bug size={32} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">{loading ? 'Načítavam logy...' : 'Žiadne záznamy'}</p>
              <p className="text-xs mt-1 opacity-70">Poller musí byť zapnutý v Nastaveniach</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {entries.filter(e => !search || e.msg.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">Žiadne výsledky pre „{search}"</div>
              )}
              {entries.filter(e => !search || e.msg.toLowerCase().includes(search.toLowerCase())).map((e, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  <span className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${LEVEL_STYLES[e.level] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT[e.level] || 'bg-gray-400'}`} />
                    {e.level.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-400 font-mono shrink-0 mt-0.5 w-36">{fmt(e.ts)}</span>
                  <span className="text-sm text-gray-700 break-all">{e.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {total > 1000 && (
          <p className="text-xs text-center text-gray-400 mt-3">
            Zobrazených 1 000 z {total} záznamov — zúžte filter pre presnejšie výsledky
          </p>
        )}
        <div className="pb-6" />
      </div>
    </PortalLayout>
  )
}
