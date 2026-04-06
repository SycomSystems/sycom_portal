'use client'

import { useState, useEffect, useCallback } from 'react'

type User = {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'AGENT' | 'CLIENT'
  department: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  _count: { ticketsCreated: number; ticketsAssigned: number }
}

const emptyForm = {
  name: '', email: '', password: '', role: 'CLIENT' as User['role'],
  department: '', phone: '', isActive: true,
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [loading, setLoading] = useState(true)

  // Modal state
  const [modal, setModal] = useState<'none' | 'create' | 'edit'>('none')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Email sending state
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterRole) params.set('role', filterRole)
    const res = await fetch(`/api/users?${params}`)
    const data = await res.json()
    setUsers(data)
    setLoading(false)
  }, [search, filterRole])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  function openCreate() {
    setForm(emptyForm)
    setError('')
    setEditingUser(null)
    setModal('create')
  }

  function openEdit(user: User) {
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      department: user.department ?? '',
      phone: user.phone ?? '',
      isActive: user.isActive,
    })
    setError('')
    setEditingUser(user)
    setModal('edit')
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const body: any = { ...form }
      if (modal === 'edit' && !body.password) delete body.password

      const url = modal === 'create' ? '/api/users' : `/api/users/${editingUser!.id}`
      const method = modal === 'create' ? 'POST' : 'PATCH'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error?.fieldErrors ? Object.values(data.error.fieldErrors).flat().join(', ') : data.error || 'Chyba')
        return
      }

      setModal('none')
      fetchUsers()
    } finally {
      setSaving(false)
    }
  }

  async function handleSendPassword(user: User) {
    if (!confirm(`Vygenerovať nové heslo a poslať na ${user.email}?`)) return
    setSendingEmail(user.id)
    try {
      const res = await fetch(`/api/users/${user.id}/send-password`, { method: 'POST' })
      if (res.ok) {
        alert(`Heslo odoslané na ${user.email}`)
      } else {
        alert('Chyba pri odoslaní emailu')
      }
    } finally {
      setSendingEmail(null)
    }
  }

  async function handleToggleActive(user: User) {
    await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    fetchUsers()
  }

  const roleBadge: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-700',
    AGENT: 'bg-blue-100 text-blue-700',
    CLIENT: 'bg-gray-100 text-gray-700',
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Používatelia</h1>
        <button onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          + Nový používateľ
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          className="border rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Hľadať podľa mena alebo emailu..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
        >
          <option value="">Všetky role</option>
          <option value="ADMIN">Admin</option>
          <option value="AGENT">Agent</option>
          <option value="CLIENT">Klient</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Meno</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Rola</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Oddelenie</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Stav</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Tikety</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Akcie</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Načítavanie...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Žiadni používatelia</td></tr>
            ) : users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleBadge[user.role]}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{user.department ?? '—'}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleActive(user)}
                    className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}
                  >
                    {user.isActive ? 'Aktívny' : 'Neaktívny'}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {user._count.ticketsCreated} / {user._count.ticketsAssigned}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openEdit(user)}
                      className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-medium"
                    >
                      Upraviť
                    </button>
                    <button
                      onClick={() => handleSendPassword(user)}
                      disabled={sendingEmail === user.id}
                      className="px-3 py-1 text-xs bg-orange-50 text-orange-600 rounded hover:bg-orange-100 font-medium disabled:opacity-50"
                    >
                      {sendingEmail === user.id ? '...' : '📧 Heslo'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal !== 'none' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {modal === 'create' ? 'Nový používateľ' : `Upraviť: ${editingUser?.name}`}
            </h2>

            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 p-2 rounded">{error}</p>}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Meno *</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input type="email" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {modal === 'create' ? 'Heslo *' : 'Nové heslo (nechajte prázdne pre nezmenenie)'}
                </label>
                <input type="password" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={modal === 'edit' ? 'Ponechať heslo...' : ''} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rola *</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as User['role'] }))}>
                  <option value="CLIENT">Client</option>
                  <option value="AGENT">Agent</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Oddelenie</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Telefón</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              {modal === 'edit' && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isActive" checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                  <label htmlFor="isActive" className="text-sm text-gray-700">Aktívny účet</label>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal('none')}
                className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">
                Zrušiť
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Ukladám...' : modal === 'create' ? 'Vytvoriť' : 'Uložiť'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
