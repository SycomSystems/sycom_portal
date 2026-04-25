'use client'
// src/app/(admin)/admin/users/page.tsx
import { useState, useEffect, useCallback } from 'react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { Plus, Pencil, Trash2, CheckCircle, X, Send, ToggleLeft, ToggleRight, Building2 } from 'lucide-react'

type User = {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'AGENT' | 'CLIENT' | 'CLIENT_MANAGER'
  department: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  clientId: string | null
  client: { id: string; name: string } | null
}

type Client = { id: string; name: string }

const emptyForm = {
  name: '', email: '', password: '', role: 'CLIENT' as User['role'],
  department: '', phone: '', clientId: '',
}

const ROLE_LABELS: Record<User['role'], string> = {
  ADMIN: 'Admin',
  AGENT: 'Technik',
  CLIENT: 'Klient',
  CLIENT_MANAGER: 'Klient manažér',
}

const ROLE_COLORS: Record<User['role'], string> = {
  ADMIN: 'bg-red-100 text-red-700',
  AGENT: 'bg-blue-100 text-blue-700',
  CLIENT: 'bg-gray-100 text-gray-700',
  CLIENT_MANAGER: 'bg-purple-100 text-purple-700',
}


const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const special = '!@#$'
  let pwd = special[Math.floor(Math.random() * special.length)]
  for (let i = 0; i < 9; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  return pwd.split('').sort(() => Math.random() - 0.5).join('')
}
export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/users').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
    ]).then(([u, c]) => {
      setUsers(u)
      setClients(c)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const showFlash = (msg: string) => {
    setFlash(msg)
    setTimeout(() => setFlash(null), 3500)
  }

  const openCreate = () => {
    setForm(emptyForm)
    setEditing(null)
    setModal('create')
  }

  const openEdit = (u: User) => {
    setForm({ name: u.name, email: u.email, password: '', role: u.role, department: u.department || '', phone: u.phone || '', clientId: u.clientId || '' })
    setEditing(u)
    setModal('edit')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const url = editing ? `/api/users/${editing.id}` : '/api/users'
      const method = editing ? 'PATCH' : 'POST'
      const body: any = { name: form.name, email: form.email, role: form.role, department: form.department || null, phone: form.phone || null, clientId: form.clientId || null }
      if (!editing || form.password) body.password = form.password
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Chyba') }
      setModal(null)
      load()
      showFlash(editing ? 'Používateľ bol aktualizovaný.' : 'Používateľ bol vytvorený.')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (u: User) => {
    await fetch(`/api/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !u.isActive }) })
    load()
  }

  const handleSendAndSave = async () => {
    if (!editing) return
    const pwd = form.password || generatePassword()
    if (!form.password) setForm(f => ({ ...f, password: pwd }))
    const res = await fetch(`/api/users/${editing.id}/send-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    })
    if (res.ok) {
      alert(`Heslo "${pwd}" bolo odoslané na ${editing.email}`)
      await handleSave()
    } else {
      alert('Chyba pri odoslaní emailu')
    }
  }
  const handleSendPassword = async (u: User) => {
    await fetch(`/api/users/${u.id}/send-password`, { method: 'POST' })
    showFlash(`Heslo bolo odoslané na ${u.email}`)
  }

  const handleDelete = async (u: User) => {
    if (!confirm(`Vymazať používateľa ${u.name}?`)) return
    await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
    load()
    showFlash('Používateľ bol vymazaný.')
  }

  const clientRoles: User['role'][] = ['CLIENT', 'CLIENT_MANAGER']
  const showClientField = clientRoles.includes(form.role)

  return (
    <PortalLayout>
      <div className="w-full py-2 px-5">
        {flash && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-sm">
            <CheckCircle size={16} /> {flash}
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Používatelia</h1>
            <p className="text-sm text-gray-500 mt-0.5">{users.length} používateľov celkom</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 transition-colors">
            <Plus size={15} /> Nový používateľ
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Meno</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Rola</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Klient</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Stav</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-4 text-center text-gray-400">Načítavam...</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {u.client ? (
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <Building2 size={12} className="text-gray-400" /> {u.client.name}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => handleToggleActive(u)} className="flex items-center gap-1.5 text-xs">
                      {u.isActive
                        ? <><ToggleRight size={16} className="text-green-500" /><span className="text-green-600 font-medium">Aktívny</span></>
                        : <><ToggleLeft size={16} className="text-gray-400" /><span className="text-gray-400">Neaktívny</span></>
                      }
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => handleSendPassword(u)} title="Odoslať heslo" className="p-1.5 text-gray-400 hover:text-sycom-500 hover:bg-sycom-50 rounded-lg transition-colors"><Send size={13} /></button>
                      <button onClick={() => openEdit(u)} title="Upraviť" className="p-1.5 text-gray-400 hover:text-sycom-500 hover:bg-sycom-50 rounded-lg transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => handleDelete(u)} title="Vymazať" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">{modal === 'create' ? 'Nový používateľ' : 'Upraviť používateľa'}</h2>
              <button onClick={() => setModal(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Celé meno *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100" placeholder="Ján Novák" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100" placeholder="jan@firma.sk" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">{modal === 'edit' ? 'Nové heslo (nechajte prázdne pre zachovanie)' : 'Heslo *'}</label>
                  <div className="flex gap-2">
                    <input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100 font-mono" placeholder="••••••••" />
                    <button type="button" onClick={() => { const p = generatePassword(); setForm(f => ({ ...f, password: p })) }}
                      className="px-3 py-2 bg-sycom-50 border border-sycom-200 text-sycom-600 text-xs font-medium rounded-xl hover:bg-sycom-100 transition-colors whitespace-nowrap">
                      Generovať
                    </button>
                  </div>
                  {form.password && <p className="mt-1 text-xs text-sycom-600 font-mono bg-sycom-50 px-2 py-1 rounded-lg">Heslo: <span className="font-bold select-all">{form.password}</span></p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Rola</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as User['role'] }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">
                    <option value="CLIENT">Klient</option>
                    <option value="CLIENT_MANAGER">Klient manažér</option>
                    <option value="AGENT">Technik</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Oddelenie</label>
                  <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100" placeholder="IT, HR..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Telefón</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100" placeholder="+421 9xx xxx xxx" />
                </div>
                {showClientField && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                      <Building2 size={11} /> Klient
                    </label>
                    <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">
                      <option value="">— Bez klienta —</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              {modal === 'edit' && form.password && (
                <button type="button" onClick={handleSendAndSave}
                  className="px-4 py-2 bg-green-50 border border-green-200 text-green-700 text-sm font-medium rounded-xl hover:bg-green-100 transition-colors">
                  Odoslať heslo e-mailom
                </button>
              )}
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Zrušiť</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.email}
                className="px-5 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
                {saving ? 'Ukladám...' : modal === 'create' ? 'Vytvoriť' : 'Uložiť'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  )
}
