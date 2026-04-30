'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { Plus, Trash2 } from 'lucide-react'

interface Item { name: string; quantity: string; unit: string; clientNote: string }

export default function NewOrderPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const isStaff = role === 'ADMIN' || role === 'AGENT'
  const router = useRouter()

  const [clientNote, setClientNote] = useState('')
  const [clientId, setClientId] = useState('')
  const [items, setItems] = useState<Item[]>([{ name: '', quantity: '1', unit: 'ks', clientNote: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => fetch('/api/clients').then(r => r.json()),
    enabled: isStaff,
  })

  function addItem() { setItems(p => [...p, { name: '', quantity: '1', unit: 'ks', clientNote: '' }]) }
  function removeItem(i: number) { setItems(p => p.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, field: keyof Item, val: string) {
    setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const validItems = items.filter(it => it.name.trim())
    if (!validItems.length) { setError('Pridajte aspoň jednu položku'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientNote: clientNote.trim() || undefined,
          clientId: isStaff && clientId ? clientId : undefined,
          items: validItems.map(it => ({
            name: it.name.trim(),
            quantity: parseFloat(it.quantity) || 1,
            unit: it.unit.trim() || undefined,
            clientNote: it.clientNote.trim() || undefined,
          })),
        }),
      })
      if (!res.ok) { setError('Chyba pri odosielaní'); return }
      const order = await res.json()
      router.push(`/orders/${order.id}`)
    } finally { setSaving(false) }
  }

  return (
    <PortalLayout>
      <div className="w-full py-4 px-5 max-w-3xl">
        <h1 className="text-lg font-bold text-gray-800 mb-1">Nový cenový dopyt</h1>
        <p className="text-xs text-gray-400 mb-5">Zadajte položky, o ktoré máte záujem. My doplníme ceny a pošleme ponuku.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isStaff && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Klient</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— bez klienta —</option>
                {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Poznámka k dopytu</label>
            <textarea value={clientNote} onChange={e => setClientNote(e.target.value)} rows={2} placeholder="Voliteľná poznámka..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500">Položky</label>
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                <Plus size={13} /> Pridať položku
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start bg-gray-50 rounded-lg p-3">
                  <div className="col-span-5">
                    <input value={it.name} onChange={e => updateItem(i, 'name', e.target.value)} placeholder="Názov tovaru *" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" value={it.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} min="0.01" step="0.01" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <input value={it.unit} onChange={e => updateItem(i, 'unit', e.target.value)} placeholder="ks" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <input value={it.clientNote} onChange={e => updateItem(i, 'clientNote', e.target.value)} placeholder="Poznámka" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-1 flex justify-center pt-1">
                    {items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400"><Trash2 size={15} /></button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? 'Odosielam...' : 'Odoslať dopyt'}
            </button>
            <button type="button" onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Zrušiť</button>
          </div>
        </form>
      </div>
    </PortalLayout>
  )
}
