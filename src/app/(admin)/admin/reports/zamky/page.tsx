'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Lock, Unlock, FileText, ShieldCheck } from 'lucide-react'

const MONTHS = ['Januar','Februar','Marec','April','Maj','Jun','Jul','August','September','Oktober','November','December']

function TabNav() {
  return (
    <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
      <Link href="/admin/reports/vykaz" className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-800 border-b-2 border-transparent -mb-px">Vykaz</Link>
      <Link href="/admin/reports/zamky" className="px-4 py-2.5 text-sm font-semibold text-sycom-600 border-b-2 border-sycom-500 -mb-px">Zamky mesiacov</Link>
    </div>
  )
}

export default function ZamkyPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [busy, setBusy] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => fetch('/api/clients').then(r => r.json()) })
  const { data: locks, refetch } = useQuery({
    queryKey: ['vykaz-locks', year],
    queryFn: () => fetch('/api/vykaz/locks?year=' + year).then(r => r.json()),
  })

  const lockedSet = useMemo(() => {
    const s = new Set<string>()
    for (const l of (locks ?? [])) if (l.year === year && l.month === month) s.add(l.clientId)
    return s
  }, [locks, year, month])

  const sortedClients = useMemo(
    () => [...(clients ?? [])].sort((a: any, b: any) => a.name.localeCompare(b.name, 'sk')),
    [clients]
  )
  const lockedCount = sortedClients.filter((c: any) => lockedSet.has(c.id)).length

  async function toggleOne(clientId: string, isLocked: boolean) {
    setBusy(clientId)
    try {
      if (isLocked) {
        await fetch(`/api/vykaz/locks?clientId=${clientId}&year=${year}&month=${month}`, { method: 'DELETE' })
      } else {
        await fetch('/api/vykaz/locks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, year, month }) })
      }
      await refetch()
    } finally { setBusy(null) }
  }

  async function lockAll() {
    setBusy('*')
    try {
      await fetch('/api/vykaz/locks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true, year, month }) })
      await refetch()
    } finally { setBusy(null) }
  }
  async function unlockAll() {
    setBusy('*')
    try {
      await fetch(`/api/vykaz/locks?all=1&year=${year}&month=${month}`, { method: 'DELETE' })
      await refetch()
    } finally { setBusy(null) }
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSelectAll() {
    setSelected(prev => prev.size === sortedClients.length ? new Set() : new Set(sortedClients.map((c: any) => c.id)))
  }
  async function lockSelected() {
    if (selected.size === 0) return
    setBusy('*')
    try {
      await fetch('/api/vykaz/locks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientIds: Array.from(selected), year, month }) })
      setSelected(new Set()); await refetch()
    } finally { setBusy(null) }
  }
  async function unlockSelected() {
    if (selected.size === 0) return
    setBusy('*')
    try {
      await fetch(`/api/vykaz/locks?clientIds=${Array.from(selected).join(',')}&year=${year}&month=${month}`, { method: 'DELETE' })
      setSelected(new Set()); await refetch()
    } finally { setBusy(null) }
  }

  if (role && role !== 'ADMIN') {
    return (
      <PortalLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <ShieldCheck size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-700 font-semibold">Pristup zamietnuty</p>
          <p className="text-sm text-gray-400 mt-1">Sekcia zamkov je dostupna iba administratorovi.</p>
          <Link href="/admin/reports/vykaz" className="mt-4 text-sm text-sycom-600 hover:underline">Spat na vykaz</Link>
        </div>
      </PortalLayout>
    )
  }

  const years = [now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  return (
    <PortalLayout>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2"><FileText size={22} className="text-sycom-500" /> Vykazy</h1>
        <p className="text-sm text-gray-400 mt-0.5">Uzamykanie vykazov po mesiacoch a klientoch (do fakturacie)</p>
      </div>

      <TabNav />

      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Rok</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-sycom-400">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mesiac</label>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-sycom-400">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="flex-1" />
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={lockSelected} disabled={busy !== null || selected.size === 0} className="flex items-center gap-2 px-4 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors"><Lock size={14} /> Zamknut oznacene{selected.size > 0 ? ` (${selected.size})` : ''}</button>
            <button onClick={unlockSelected} disabled={busy !== null || selected.size === 0} className="flex items-center gap-2 px-4 py-2 border border-sycom-200 text-sycom-600 text-sm font-semibold rounded-xl hover:bg-sycom-50 disabled:opacity-50 transition-colors"><Unlock size={14} /> Odomknut oznacene{selected.size > 0 ? ` (${selected.size})` : ''}</button>
            <span className="w-px h-6 bg-gray-200 mx-1" />
            <button onClick={lockAll} disabled={busy !== null} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm font-semibold rounded-xl hover:bg-gray-900 disabled:opacity-50 transition-colors"><Lock size={14} /> Zamknut vsetkych</button>
            <button onClick={unlockAll} disabled={busy !== null} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"><Unlock size={14} /> Odomknut vsetkych</button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
          <span className="font-semibold text-gray-700">{MONTHS[month - 1]} {year}</span>
          <span className="text-gray-300">|</span>
          <span>Zamknutych: <span className="font-semibold text-gray-700">{lockedCount}</span> / {sortedClients.length}</span>
        </div>

        <div className="overflow-x-auto border border-gray-100 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" aria-label="Oznacit vsetkych"
                    checked={sortedClients.length > 0 && selected.size === sortedClients.length}
                    ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < sortedClients.length }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-sycom-500 focus:ring-sycom-400 cursor-pointer" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Klient</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Stav</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Akcia</th>
              </tr>
            </thead>
            <tbody>
              {sortedClients.map((c: any) => {
                const isLocked = lockedSet.has(c.id)
                return (
                  <tr key={c.id} className={'border-b border-gray-50 last:border-0 hover:bg-gray-50/50 ' + (selected.has(c.id) ? 'bg-sycom-50/40' : '')}>
                    <td className="px-4 py-2.5">
                      <input type="checkbox" aria-label={`Oznacit ${c.name}`}
                        checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                        className="w-4 h-4 rounded border-gray-300 text-sycom-500 focus:ring-sycom-400 cursor-pointer" />
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{c.name}</td>
                    <td className="px-4 py-2.5">
                      {isLocked
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600"><Lock size={11} /> Zamknuty</span>
                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-green-50 text-green-600"><Unlock size={11} /> Odomknuty</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => toggleOne(c.id, isLocked)} disabled={busy !== null}
                        className={'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ' +
                          (isLocked ? 'border border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-gray-800 text-white hover:bg-gray-900')}>
                        {isLocked ? <><Unlock size={12} /> Odomknut</> : <><Lock size={12} /> Zamknut</>}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {sortedClients.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">Ziadni klienti</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 mt-4 leading-relaxed">
          Zamknutim sa vykaz daneho klienta za mesiac zmrazi — technici ani admin nemozu upravovat manualne hodiny,
          kym ho admin opat neodomkne. Sluzi ako hranica pred fakturaciou (faktury sa tvoria v uctovnictve).
        </p>
      </div>
    </PortalLayout>
  )
}
