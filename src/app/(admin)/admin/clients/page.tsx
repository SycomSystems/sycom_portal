'use client'
// src/app/(admin)/admin/clients/page.tsx
import { useState, useEffect } from 'react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { Building2, Plus, Pencil, Trash2, CheckCircle, AlertCircle, Users, X, Save } from 'lucide-react'

interface Client {
  id: string
  name: string
  createdAt: string
  _count: { users: number }
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/clients')
      .then(r => r.json())
      .then(data => { setClients(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message })
    setTimeout(() => setStatus(null), 4000)
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chyba')
      setNewName('')
      load()
      showStatus('success', `Klient "${data.name}" bol pridaný.`)
    } catch (e: any) {
      showStatus('error', e.message)
    } finally {
      setAdding(false)
    }
  }

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chyba')
      setEditId(null)
      load()
      showStatus('success', `Klient bol premenovaný na "${data.name}".`)
    } catch (e: any) {
      showStatus('error', e.message)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Naozaj chcete vymazať klienta "${name}"? Používatelia nebudú vymazaní, iba sa odpojí ich priradenie.`)) return
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Chyba pri mazaní')
      load()
      showStatus('success', `Klient "${name}" bol vymazaný.`)
    } catch (e: any) {
      showStatus('error', e.message)
    }
  }

  return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto py-8 px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Klienti</h1>
          <p className="text-sm text-gray-500 mt-1">Spravujte zoznam klientov. Každý používateľ môže byť priradený ku klientovi.</p>
        </div>

        {/* Add new client */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Pridať nového klienta</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  placeholder="Názov klienta (napr. Acme s.r.o.)"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100 transition-all"
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={adding || !newName.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors"
              >
                <Plus size={15} />
                {adding ? 'Pridávam...' : 'Pridať'}
              </button>
            </div>

            {status && (
              <div className={`mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm ${status.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                {status.type === 'success' ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
                {status.message}
              </div>
            )}
          </div>
        </div>

        {/* Clients list */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Zoznam klientov</h2>
            <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{clients.length} klientov</span>
          </div>
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">Načítavam...</div>
            ) : clients.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Building2 size={32} className="mx-auto mb-3 text-gray-200" />
                <p className="text-sm text-gray-400">Žiadni klienti. Pridajte prvého klienta vyššie.</p>
              </div>
            ) : clients.map(client => (
              <div key={client.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-sycom-50 border border-sycom-100 flex items-center justify-center flex-shrink-0">
                  <Building2 size={16} className="text-sycom-500" />
                </div>
                <div className="flex-1 min-w-0">
                  {editId === client.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleEdit(client.id); if (e.key === 'Escape') setEditId(null) }}
                        autoFocus
                        className="flex-1 max-w-xs px-3 py-1.5 border border-sycom-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sycom-100"
                      />
                      <button onClick={() => handleEdit(client.id)} className="p-1.5 text-sycom-500 hover:text-sycom-700 transition-colors">
                        <Save size={15} />
                      </button>
                      <button onClick={() => setEditId(null)} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-gray-900">{client.name}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Users size={11} /> {client._count.users} používateľov
                      </p>
                    </>
                  )}
                </div>
                {editId !== client.id && (
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      onClick={() => { setEditId(client.id); setEditName(client.name) }}
                      className="p-2 text-gray-400 hover:text-sycom-500 hover:bg-sycom-50 rounded-lg transition-colors"
                      title="Premenovať"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(client.id, client.name)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Vymazať"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </PortalLayout>
  )
}
