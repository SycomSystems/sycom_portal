'use client'

import { useEffect, useState } from 'react'
import PortalLayout from '@/components/layout/PortalLayout'
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Clock, Repeat } from 'lucide-react'

interface RecurringReport {
  id: string
  name: string
  hoursType: string
  hours: number
  note: string | null
  isService: boolean
  isActive: boolean
  scheduleType: string
  intervalDays: number | null
  weekday: number | null
  monthDay: number | null
  nextRunAt: string
  lastRunAt: string | null
  user: { id: string; name: string; email: string }
  client: { id: string; name: string } | null
  createdBy: { id: string; name: string }
}

interface User { id: string; name: string; email: string }
interface Client { id: string; name: string }

const WEEKDAYS = ['Nedeľa','Pondelok','Utorok','Streda','Štvrtok','Piatok','Sobota']
const HOURS_TYPES = ['práca','pohotovosť','služobná cesta','dovolenka','PN']

function scheduleLabel(r: RecurringReport) {
  if (r.scheduleType === 'INTERVAL') return `Každých ${r.intervalDays} dní`
  if (r.scheduleType === 'WEEKDAY') return `Každý ${WEEKDAYS[r.weekday ?? 0]}`
  if (r.scheduleType === 'MONTHDAY') return `${r.monthDay}. v mesiaci`
  return r.scheduleType
}

const emptyForm = {
  name: '',
  hoursType: 'práca',
  hours: 1,
  note: '',
  isService: false,
  assignedUserId: '',
  clientId: '',
  scheduleType: 'WEEKDAY',
  intervalDays: 7,
  weekday: 0,
  monthDay: 1,
  firstRunAt: '',
}

export default function RecurringReportsPage() {
  const [records, setRecords] = useState<RecurringReport[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [tab, setTab] = useState<'work' | 'service'>('work')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [rr, ru, rc] = await Promise.all([
      fetch('/api/admin/recurring-reports').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
    ])
    setRecords(Array.isArray(rr) ? rr : [])
    setUsers(Array.isArray(ru) ? ru : [])
    setClients(Array.isArray(rc) ? rc : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate(isService: boolean) {
    setEditId(null)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(20, 0, 0, 0)
    setForm({ ...emptyForm, isService, firstRunAt: tomorrow.toISOString().slice(0, 16) })
    setShowModal(true)
  }

  function openEdit(r: RecurringReport) {
    setEditId(r.id)
    setForm({
      name: r.name,
      hoursType: r.hoursType,
      hours: r.hours,
      note: r.note ?? '',
      isService: r.isService,
      assignedUserId: r.user.id,
      clientId: r.client?.id ?? '',
      scheduleType: r.scheduleType,
      intervalDays: r.intervalDays ?? 7,
      weekday: r.weekday ?? 0,
      monthDay: r.monthDay ?? 1,
      firstRunAt: r.nextRunAt ? new Date(r.nextRunAt).toISOString().slice(0, 16) : '',
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.name.trim() || !form.assignedUserId) return
    setSaving(true)
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      hoursType: form.hoursType,
      hours: Number(form.hours),
      note: form.note || null,
      isService: form.isService,
      assignedUserId: form.assignedUserId,
      clientId: form.clientId || null,
      scheduleType: form.scheduleType,
      intervalDays: form.scheduleType === 'INTERVAL' ? Number(form.intervalDays) : null,
      weekday: form.scheduleType === 'WEEKDAY' ? Number(form.weekday) : null,
      monthDay: form.scheduleType === 'MONTHDAY' ? Number(form.monthDay) : null,
      firstRunAt: form.firstRunAt || null,
    }
    const url = editId ? `/api/admin/recurring-reports/${editId}` : '/api/admin/recurring-reports'
    const method = editId ? 'PATCH' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function toggleActive(r: RecurringReport) {
    await fetch(`/api/admin/recurring-reports/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !r.isActive }),
    })
    load()
  }

  async function confirmDelete() {
    if (!deleteId) return
    await fetch(`/api/admin/recurring-reports/${deleteId}`, { method: 'DELETE' })
    setDeleteId(null)
    load()
  }

  const filtered = records.filter(r => r.isService === (tab === 'service'))

  return (
    <PortalLayout>
      <div className="w-full py-4 px-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Opakujúce sa záznamy</h1>
            <p className="text-sm text-gray-500 mt-0.5">Automatické výkazy práce a paušálne služby</p>
          </div>
          <button
            onClick={() => openCreate(tab === 'service')}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} />
            Pridať záznam
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          <button
            onClick={() => setTab('work')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'work' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Výkazy práce
          </button>
          <button
            onClick={() => setTab('service')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'service' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Paušály / Služby
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">Načítavam...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Repeat size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Žiadne záznamy</p>
            <button onClick={() => openCreate(tab === 'service')} className="mt-3 text-blue-600 text-sm hover:underline">
              Pridať prvý záznam
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Názov</th>
                  <th className="px-4 py-3 text-left">Klient</th>
                  <th className="px-4 py-3 text-left">Technik</th>
                  <th className="px-4 py-3 text-left">Hodiny</th>
                  <th className="px-4 py-3 text-left">Plán</th>
                  <th className="px-4 py-3 text-left">Ďalší beh</th>
                  <th className="px-4 py-3 text-left">Aktívny</th>
                  <th className="px-4 py-3 text-right">Akcie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => (
                  <tr key={r.id} className={`hover:bg-gray-50 ${!r.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {r.name}
                      {r.note && <div className="text-xs text-gray-400 mt-0.5">{r.note}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.client?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{r.user.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.hours}h
                      {!r.isService && <span className="ml-1 text-xs text-gray-400">({r.hoursType})</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        <Clock size={10} />
                        {scheduleLabel(r)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(r.nextRunAt).toLocaleString('sk-SK', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(r)} title={r.isActive ? 'Deaktivovať' : 'Aktivovať'}>
                        {r.isActive
                          ? <ToggleRight size={22} className="text-green-500" />
                          : <ToggleLeft size={22} className="text-gray-400" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-blue-600 p-1 rounded" title="Upraviť">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => setDeleteId(r.id)} className="text-gray-400 hover:text-red-600 p-1 rounded" title="Zmazať">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editId ? 'Upraviť záznam' : (form.isService ? 'Nová paušálna služba' : 'Nový výkaz práce')}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Názov *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={form.isService ? 'napr. Mesačný monitoring' : 'napr. Kontrola servera'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Technician */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Technik *</label>
                <select
                  value={form.assignedUserId}
                  onChange={e => setForm(f => ({ ...f, assignedUserId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— vybrať technika —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              {/* Client */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Klient</label>
                <select
                  value={form.clientId}
                  onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— bez klienta —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Hours + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Hodiny *</label>
                  <input
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={form.hours}
                    onChange={e => setForm(f => ({ ...f, hours: parseFloat(e.target.value) || 1 }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {!form.isService && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Typ hodín</label>
                    <select
                      value={form.hoursType}
                      onChange={e => setForm(f => ({ ...f, hoursType: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {HOURS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Schedule type */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Frekvencia</label>
                <select
                  value={form.scheduleType}
                  onChange={e => setForm(f => ({ ...f, scheduleType: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="WEEKDAY">Každý týždeň (deň v týždni)</option>
                  <option value="MONTHDAY">Každý mesiac (deň v mesiaci)</option>
                  <option value="INTERVAL">Každých N dní</option>
                </select>
              </div>

              {/* Conditional schedule fields */}
              {form.scheduleType === 'WEEKDAY' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Deň v týždni</label>
                  <select
                    value={form.weekday}
                    onChange={e => setForm(f => ({ ...f, weekday: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              )}
              {form.scheduleType === 'MONTHDAY' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Deň v mesiaci (1–28)</label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={form.monthDay}
                    onChange={e => setForm(f => ({ ...f, monthDay: parseInt(e.target.value) || 1 }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              {form.scheduleType === 'INTERVAL' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Počet dní</label>
                  <input
                    type="number"
                    min="1"
                    value={form.intervalDays}
                    onChange={e => setForm(f => ({ ...f, intervalDays: parseInt(e.target.value) || 7 }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* First run */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Prvý / ďalší beh</label>
                <input
                  type="datetime-local"
                  value={form.firstRunAt}
                  onChange={e => setForm(f => ({ ...f, firstRunAt: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Poznámka</label>
                <textarea
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Zrušiť
              </button>
              <button
                onClick={save}
                disabled={saving || !form.name.trim() || !form.assignedUserId}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Ukladám...' : (editId ? 'Uložiť' : 'Vytvoriť')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Zmazať záznam?</h3>
            <p className="text-sm text-gray-500 mb-6">Táto akcia je nezvratná. Vytvorené výkazy zostanú zachované.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Zrušiť</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Zmazať</button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  )
}
