'use client'
import { useEffect, useState } from 'react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { Plus, Pencil, Trash2, Play, Power } from 'lucide-react'

const DAYS = ['Nedeľa','Pondelok','Utorok','Streda','Štvrtok','Piatok','Sobota']
const PRIORITIES = ['LOW','MEDIUM','HIGH','URGENT']
const SCHEDULE_TYPES = [
  { value: 'INTERVAL', label: 'Každých X dní' },
  { value: 'WEEKDAY',  label: 'Deň v týždni' },
  { value: 'MONTHDAY', label: 'Deň v mesiaci' },
]

function scheduleLabel(rt: any) {
  if (rt.scheduleType === 'INTERVAL') return `Každých ${rt.intervalDays} dní`
  if (rt.scheduleType === 'WEEKDAY')  return `Každý ${DAYS[rt.weekday]}`
  if (rt.scheduleType === 'MONTHDAY') return `Každý ${rt.monthDay}. v mesiaci`
  return '—'
}

const empty = { subject:'', description:'', clientId:'', assignedToId:'', priority:'MEDIUM', scheduleType:'INTERVAL', intervalDays:'7', weekday:'1', monthDay:'1', firstRunAt:'' }

export default function RecurringPage() {
  const [items, setItems]         = useState<any[]>([])
  const [clients, setClients]     = useState<any[]>([])
  const [users, setUsers]         = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<any>(null)
  const [form, setForm]           = useState<any>(empty)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const load = async () => {
    setLoading(true)
    const [r1, r2, r3] = await Promise.all([
      fetch('/api/admin/recurring-tickets'),
      fetch('/api/clients'),
      fetch('/api/users'),
    ])
    if (r1.ok) setItems(await r1.json())
    if (r2.ok) { const d = await r2.json(); setClients(Array.isArray(d) ? d : d.clients ?? []) }
    if (r3.ok) { const d = await r3.json(); setUsers(Array.isArray(d) ? d : d.users ?? []) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(empty); setError(''); setShowForm(true) }
  const openEdit = (rt: any) => {
    setEditing(rt)
    setForm({
      subject: rt.subject, description: rt.description || '', clientId: rt.clientId || '',
      assignedToId: rt.assignedToId || '', priority: rt.priority,
      scheduleType: rt.scheduleType, intervalDays: String(rt.intervalDays || 7),
      weekday: String(rt.weekday ?? 1), monthDay: String(rt.monthDay || 1),
      firstRunAt: rt.nextRunAt ? rt.nextRunAt.slice(0,10) : '',
    })
    setError(''); setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.subject.trim()) { setError('Predmet je povinný'); return }
    setSaving(true); setError('')
    const body: any = {
      subject: form.subject, description: form.description,
      clientId: form.clientId || null, assignedToId: form.assignedToId || null,
      priority: form.priority, scheduleType: form.scheduleType,
      intervalDays: form.scheduleType === 'INTERVAL' ? Number(form.intervalDays) : null,
      weekday:      form.scheduleType === 'WEEKDAY'  ? Number(form.weekday)      : null,
      monthDay:     form.scheduleType === 'MONTHDAY' ? Number(form.monthDay)     : null,
    }
    if (!editing && form.firstRunAt) body.firstRunAt = form.firstRunAt
    if (editing && form.firstRunAt) body.nextRunAt = form.firstRunAt

    const res = editing
      ? await fetch(`/api/admin/recurring-tickets/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/admin/recurring-tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { setShowForm(false); load() }
    else { const d = await res.json(); setError(d.error || 'Chyba') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Odstrániť tento opakujúci sa tiket?')) return
    await fetch(`/api/admin/recurring-tickets/${id}`, { method: 'DELETE' })
    load()
  }

  const handleToggle = async (rt: any) => {
    await fetch(`/api/admin/recurring-tickets/${rt.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !rt.isActive }),
    })
    load()
  }

  const f = (v: string, k: string) => setForm((p: any) => ({ ...p, [k]: v }))

  return (
    <PortalLayout>
      <div className="w-full py-0 px-5">
        <div className="flex items-center justify-between mb-6 mt-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Opakujúce sa tikety</h1>
            <p className="text-sm text-gray-500 mt-0.5">Šablóny tiketov ktoré sa vytvárajú automaticky</p>
          </div>
          <button onClick={openNew} className="flex items-center gap-2 bg-sycom-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-sycom-primary/90">
            <Plus size={16}/> Nová šablóna
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm">Načítavam...</p>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">Žiadne opakujúce sa tikety</p>
            <button onClick={openNew} className="mt-4 text-sycom-primary text-sm font-medium hover:underline">Vytvoriť prvú šablónu</button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Predmet</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Klient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plán</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ďalší beh</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stav</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(rt => (
                  <tr key={rt.id} className={`hover:bg-gray-50 ${!rt.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {rt.subject}
                      {rt.assignedTo && <span className="block text-xs text-gray-400">{rt.assignedTo.name}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{rt.client?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{scheduleLabel(rt)}</td>
                    <td className="px-4 py-3 text-gray-600">{rt.nextRunAt ? new Date(rt.nextRunAt).toLocaleDateString('sk-SK') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rt.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {rt.isActive ? 'Aktívny' : 'Vypnutý'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => handleToggle(rt)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title={rt.isActive ? 'Vypnúť' : 'Zapnúť'}><Power size={14}/></button>
                        <button onClick={() => openEdit(rt)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><Pencil size={14}/></button>
                        <button onClick={() => handleDelete(rt.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-base font-semibold text-gray-800 mb-4">{editing ? 'Upraviť šablónu' : 'Nová šablóna'}</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Predmet tiketu *</label>
                  <input value={form.subject} onChange={e => f(e.target.value,'subject')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sycom-primary/40" placeholder="napr. Mesačná údržba servera"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Popis</label>
                  <textarea value={form.description} onChange={e => f(e.target.value,'description')} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sycom-primary/40"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Klient</label>
                    <select value={form.clientId} onChange={e => f(e.target.value,'clientId')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                      <option value="">— bez klienta —</option>
                      {clients.map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Priradený</label>
                    <select value={form.assignedToId} onChange={e => f(e.target.value,'assignedToId')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                      <option value="">— nepriradený —</option>
                      {users.filter((u:any) => u.role === 'AGENT' || u.role === 'ADMIN').map((u:any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Priorita</label>
                    <select value={form.priority} onChange={e => f(e.target.value,'priority')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Typ plánu</label>
                    <select value={form.scheduleType} onChange={e => f(e.target.value,'scheduleType')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                      {SCHEDULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                {form.scheduleType === 'INTERVAL' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Každých X dní</label>
                    <input type="number" min="1" value={form.intervalDays} onChange={e => f(e.target.value,'intervalDays')} className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"/>
                  </div>
                )}
                {form.scheduleType === 'WEEKDAY' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Deň v týždni</label>
                    <select value={form.weekday} onChange={e => f(e.target.value,'weekday')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                      {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                )}
                {form.scheduleType === 'MONTHDAY' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Deň v mesiaci (1–28)</label>
                    <input type="number" min="1" max="28" value={form.monthDay} onChange={e => f(e.target.value,'monthDay')} className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"/>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{editing ? 'Ďalší beh' : 'Prvý beh (voliteľné)'}</label>
                  <input type="date" value={form.firstRunAt} onChange={e => f(e.target.value,'firstRunAt')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"/>
                </div>
              </div>
              {error && <p className="text-red-600 text-xs mt-3">{error}</p>}
              <div className="flex gap-2 mt-5">
                <button onClick={handleSave} disabled={saving} className="flex-1 bg-sycom-primary text-white text-sm py-2 rounded-lg hover:bg-sycom-primary/90 disabled:opacity-50">
                  {saving ? 'Ukladám...' : editing ? 'Uložiť' : 'Vytvoriť'}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Zrušiť</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  )
}
