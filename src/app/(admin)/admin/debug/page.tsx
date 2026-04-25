'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { RefreshCw, Bug, Filter, Clock, ScrollText, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'

interface LogEntry { ts: string; level: string; msg: string }
interface AuditEntry {
  id: string; entityType: string; entityId: string; action: string
  oldValue: string | null; newValue: string | null; createdAt: string
  user: { id: string; name: string; email: string }
}

const LEVEL_STYLES: Record<string, string> = {
  info:  'bg-blue-50 text-blue-700 border-blue-200',
  warn:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  error: 'bg-red-50 text-red-700 border-red-200',
}
const LEVEL_DOT: Record<string, string> = {
  info: 'bg-blue-400', warn: 'bg-yellow-400', error: 'bg-red-500',
}
const ACTION_LABELS: Record<string, string> = {
  status_changed:        'Zmena stavu',
  priority_changed:      'Zmena priority',
  assignee_changed:      'Zmena technika',
  client_changed:        'Zmena klienta',
  comment_added:         'Komentar pridany',
  internal_comment_added:'Interni komentar',
}

export default function DebugPage() {
  const [tab, setTab] = useState<'poller' | 'audit'>('poller')

  // ── Poller logs ──
  const [entries, setEntries]   = useState<LogEntry[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [level, setLevel]       = useState('all')
  const [days, setDays]         = useState(1)
  const [autoRefresh, setAuto]  = useState(true)
  const [lastUpdate, setLast]   = useState<Date | null>(null)
  const [search, setSearch]     = useState('')
  const timerRef                = useRef<NodeJS.Timeout | null>(null)

  // ── Audit log ──
  const [auditLogs, setAuditLogs]     = useState<AuditEntry[]>([])
  const [auditTotal, setAuditTotal]   = useState(0)
  const [auditLoading, setAuditLoad] = useState(false)
  const [auditFrom, setAuditFrom]     = useState('')
  const [auditTo, setAuditTo]         = useState('')
  const [auditAction, setAuditAction] = useState('')

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

  const loadAudit = useCallback(async () => {
    setAuditLoad(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (auditFrom) params.set('from', auditFrom)
      if (auditTo)   params.set('to', auditTo)
      const r = await fetch(`/api/admin/audit-log?${params}`)
      const d = await r.json()
      setAuditLogs(d.logs || [])
      setAuditTotal(d.total || 0)
    } catch {}
    finally { setAuditLoad(false) }
  }, [auditFrom, auditTo])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (tab === 'audit') loadAudit() }, [tab, loadAudit])
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoRefresh) timerRef.current = setInterval(load, 30000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [autoRefresh, load])

  const fmt = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleDateString('sk-SK') + ' ' + d.toLocaleTimeString('sk-SK')
  }
  const levels  = ['all','info','warn','error']
  const dayOpts = [
    { v: 1, l: '1 den' }, { v: 7, l: '7 dni' }, { v: 30, l: '30 dni' },
    { v: 90, l: '90 dni' }, { v: 365, l: '365 dni' }
  ]
  const filtered = search
    ? entries.filter(e => e.msg.toLowerCase().includes(search.toLowerCase()))
    : entries
  const filteredAudit = auditAction
    ? auditLogs.filter(l => l.action === auditAction)
    : auditLogs

  return (
    <PortalLayout>
      <div className="w-full py-0 px-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 pt-6">
          <div className="flex items-center gap-2.5">
            <Bug size={20} className="text-gray-400" />
            <h1 className="text-xl font-bold text-gray-900">Debug</h1>
          </div>
          {tab === 'poller' && (
            <div className="flex items-center gap-2">
              <button onClick={() => setAuto(!autoRefresh)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${autoRefresh ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500'}`}>
                <Clock size={12} />{autoRefresh ? 'Auto 30s' : 'Manual'}
              </button>
              <button onClick={load} disabled={loading}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                Obnovit
              </button>
            </div>
          )}
          {tab === 'audit' && (
            <button onClick={loadAudit} disabled={auditLoading}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw size={12} className={auditLoading ? 'animate-spin' : ''} />
              Obnovit
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          <button onClick={() => setTab('poller')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${tab === 'poller' ? 'border-sycom-500 text-sycom-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Email Poller {total > 0 && <span className="ml-1 text-xs text-gray-400">({total})</span>}
          </button>
          <button onClick={() => setTab('audit')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${tab === 'audit' ? 'border-sycom-500 text-sycom-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <ScrollText size={14} />
            Audit log {auditTotal > 0 && <span className="text-xs text-gray-400">({auditTotal})</span>}
          </button>
        </div>

        {/* ── POLLER TAB ── */}
        {tab === 'poller' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                <Filter size={12} className="text-gray-400" />
                {levels.map(l => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${level === l ? 'bg-sycom-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                <Clock size={12} className="text-gray-400" />
                {dayOpts.map(o => (
                  <button key={o.v} onClick={() => setDays(o.v)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${days === o.v ? 'bg-sycom-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                    {o.l}
                  </button>
                ))}
              </div>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Hladat v logoch..."
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-sycom-400 bg-white" />
              {lastUpdate && <span className="text-[10px] text-gray-400 ml-auto">Aktualizovane: {lastUpdate.toLocaleTimeString('sk-SK')}</span>}
            </div>
            <div className="bg-gray-950 rounded-xl overflow-hidden border border-gray-800">
              <div className="overflow-y-auto max-h-[calc(100vh-280px)] font-mono text-xs">
                {filtered.length === 0 ? (
                  <div className="text-gray-500 text-center py-12">Ziadne zaznamy</div>
                ) : filtered.map((e, i) => (
                  <div key={i} className={`flex items-start gap-3 px-4 py-2 border-b border-gray-800 hover:bg-gray-900 ${e.level === 'error' ? 'bg-red-950/30' : ''}`}>
                    <span className="text-gray-500 shrink-0 w-40">{fmt(e.ts)}</span>
                    <span className={`shrink-0 w-12 text-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${LEVEL_STYLES[e.level] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>{e.level}</span>
                    <span className="text-gray-200 break-all leading-relaxed">{e.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── AUDIT TAB ── */}
        {tab === 'audit' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <select value={auditAction} onChange={e => setAuditAction(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:border-sycom-400">
                <option value="">Vsetky akcie</option>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Od:</span>
                <input type="date" value={auditFrom} onChange={e => setAuditFrom(e.target.value)}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-sycom-400 bg-white" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Do:</span>
                <input type="date" value={auditTo} onChange={e => setAuditTo(e.target.value)}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-sycom-400 bg-white" />
              </div>
              <span className="text-[11px] text-gray-400 ml-auto">{filteredAudit.length} zaznamov</span>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-36">Cas</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Pouzivatel</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Akcia</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Stara hodnota</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Nova hodnota</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tiket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAudit.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-10 text-gray-400">Ziadne zaznamy</td></tr>
                    ) : filteredAudit.map(l => (
                      <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{fmt(l.createdAt)}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-700">{l.user.name}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">
                            {ACTION_LABELS[l.action] ?? l.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 max-w-[160px] truncate" title={l.oldValue ?? ''}>{l.oldValue ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700 max-w-[160px] truncate" title={l.newValue ?? ''}>{l.newValue ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          {l.entityType === 'ticket' && (
                            <Link href={`/tickets/${l.entityId}`} className="text-sycom-500 hover:underline flex items-center gap-1">
                              <LinkIcon size={11} /> tiket
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </PortalLayout>
  )
}
