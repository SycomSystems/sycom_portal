'use client'
import { useState, useEffect } from 'react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import {
  Building2, Plus, Pencil, Trash2, CheckCircle,
  AlertCircle, Users, X, Save, ChevronDown, ChevronUp, Euro,
} from 'lucide-react'

type HoursType = 'STANDARD' | 'STANDARD_MIMO' | 'SERVER' | 'SERVER_MIMO'
const HOURS_TYPES: HoursType[] = ['STANDARD', 'STANDARD_MIMO', 'SERVER', 'SERVER_MIMO']
const HOURS_LABELS: Record<HoursType, string> = {
  STANDARD: 'Standard',
  STANDARD_MIMO: 'Standard mimo prac. casu',
  SERVER: 'Server',
  SERVER_MIMO: 'Server mimo prac. casu',
}
type PricingMap = Record<HoursType, string>
interface ClientPricing { id: string; hoursType: HoursType; pricePerHour: number }
interface Client {
  id: string; name: string; contactPerson: string | null; phone: string | null
  ico: string | null; dic: string | null; dicDph: string | null
  address: string | null; www: string | null; notes: string | null
  createdAt: string; pricing: ClientPricing[]; _count: { users: number }
}
const emptyPricing = (): PricingMap => Object.fromEntries(HOURS_TYPES.map(t => [t, ''])) as PricingMap
const emptyForm = () => ({ name: '', contactPerson: '', phone: '', ico: '', dic: '', dicDph: '', address: '', www: '', notes: '', pricing: emptyPricing() })
type FormState = ReturnType<typeof emptyForm>

function PricingTable({ pricing, setPricing }: { pricing: PricingMap; setPricing: (p: PricingMap) => void }) {
  return (
    <div className="sm:col-span-2">
      <label className="block text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
        <Euro size={12} /> Cennik (EUR/hod)
      </label>
      <div className="grid grid-cols-2 gap-2">
        {HOURS_TYPES.map(type => (
          <div key={type} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <span className="text-xs text-gray-500 flex-1 leading-tight">{HOURS_LABELS[type]}</span>
            <div className="relative w-24 flex-shrink-0">
              <input
                type="number" min="0" step="0.01" value={pricing[type]}
                onChange={e => setPricing({ ...pricing, [type]: e.target.value })}
                placeholder="0.00"
                className="w-full pr-8 pl-2 py-1 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100 bg-white"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">EUR</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FormFields({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Nazov klienta *</label>
        <div className="relative">
          <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Acme s.r.o."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Kontaktna osoba</label>
        <input type="text" value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} placeholder="Jan Novak"
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Telefon</label>
        <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+421 900 000 000"
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">ICO</label>
        <input type="text" value={form.ico} onChange={e => setForm({ ...form, ico: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">DIC</label>
        <input type="text" value={form.dic} onChange={e => setForm({ ...form, dic: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">DIC DPH</label>
        <input type="text" value={form.dicDph} onChange={e => setForm({ ...form, dicDph: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">WWW</label>
        <input type="text" value={form.www} onChange={e => setForm({ ...form, www: e.target.value })} placeholder="https://example.sk"
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Adresa</label>
        <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Ulica 1, 811 01 Bratislava"
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100" />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-gray-500 mb-1">Poznamky</label>
        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100 resize-none" />
      </div>
      <PricingTable pricing={form.pricing} setPricing={p => setForm({ ...form, pricing: p })} />
    </div>
  )
}

function pricingToMap(pricing: ClientPricing[]): PricingMap {
  const map = emptyPricing()
  for (const p of pricing) map[p.hoursType] = p.pricePerHour.toString()
  return map
}
function pricingForApi(pricing: PricingMap): Record<string, number> {
  return Object.fromEntries(HOURS_TYPES.map(t => [t, parseFloat(pricing[t]) || 0]))
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState(emptyForm())
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/clients').then(r => r.json()).then(data => { setClients(data); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message }); setTimeout(() => setStatus(null), 4000)
  }

  const handleAdd = async () => {
    if (!newForm.name.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newForm, pricing: pricingForApi(newForm.pricing) }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chyba')
      setNewForm(emptyForm()); load(); showStatus('success', 'Klient ' + data.name + ' bol pridany.')
    } catch (e: any) { showStatus('error', e.message) }
    finally { setAdding(false) }
  }

  const handleEdit = async (id: string) => {
    if (!editForm.name.trim()) return
    try {
      const res = await fetch('/api/clients/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editForm, pricing: pricingForApi(editForm.pricing) }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chyba')
      setEditId(null); load(); showStatus('success', 'Klient ' + data.name + ' bol upraveny.')
    } catch (e: any) { showStatus('error', e.message) }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm('Naozaj chcete vymazat klienta ' + name + '? Pouzivatelia nebudu vymazani.')) return
    try {
      const res = await fetch('/api/clients/' + id, { method: 'DELETE' })
      if (!res.ok) throw new Error('Chyba pri mazani')
      load(); showStatus('success', 'Klient ' + name + ' bol vymazany.')
    } catch (e: any) { showStatus('error', e.message) }
  }

  const startEdit = (client: Client) => {
    setEditId(client.id)
    setEditForm({ name: client.name, contactPerson: client.contactPerson ?? '', phone: client.phone ?? '', ico: client.ico ?? '', dic: client.dic ?? '', dicDph: client.dicDph ?? '', address: client.address ?? '', www: client.www ?? '', notes: client.notes ?? '', pricing: pricingToMap(client.pricing) })
    setExpandedId(client.id)
  }

  const getPriceMap = (client: Client) => {
    const map: Record<string, number> = {}
    for (const p of client.pricing) map[p.hoursType] = p.pricePerHour
    return map as Record<HoursType, number>
  }

  return (
    <PortalLayout>
      <div className="w-full py-2 px-5">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Klienti</h1>
          <p className="text-sm text-gray-500 mt-1">Spravujte zoznam klientov a ich cenniky.</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-3">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Pridat noveho klienta</h2>
          </div>
          <div className="p-4 space-y-4">
            <FormFields form={newForm} setForm={setNewForm} />
            <div className="flex justify-end">
              <button onClick={handleAdd} disabled={adding || !newForm.name.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
                <Plus size={15} />{adding ? 'Pridavam...' : 'Pridat klienta'}
              </button>
            </div>
            {status && (
              <div className={(status.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800') + ' flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm'}>
                {status.type === 'success' ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
                {status.message}
              </div>
            )}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Zoznam klientov</h2>
            <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{clients.length} klientov</span>
          </div>
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="px-6 py-4 text-center text-sm text-gray-400">Nacitavam...</div>
            ) : clients.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Building2 size={32} className="mx-auto mb-3 text-gray-200" />
                <p className="text-sm text-gray-400">Ziadni klienti. Pridajte prveho klienta vyssie.</p>
              </div>
            ) : clients.map(client => {
              const priceMap = getPriceMap(client)
              return (
                <div key={client.id}>
                  <div className="px-6 py-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-sycom-50 border border-sycom-100 flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} className="text-sycom-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{client.name}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1"><Users size={11} /> {client._count.users} pouzivatelov</span>
                        {client.contactPerson && <span>{client.contactPerson}</span>}
                        {HOURS_TYPES.filter(t => priceMap[t] > 0).length > 0 && (
                          <span className="flex items-center gap-1 text-sycom-600">
                            <Euro size={10} />{HOURS_TYPES.filter(t => priceMap[t] > 0).map(t => priceMap[t].toFixed(2)).join(' / ')}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                      <button onClick={() => setExpandedId(expandedId === client.id ? null : client.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                        {expandedId === client.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <button onClick={() => startEdit(client)}
                        className="p-2 text-gray-400 hover:text-sycom-500 hover:bg-sycom-50 rounded-lg transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(client.id, client.name)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {expandedId === client.id && (
                    <div className="px-6 pb-5 bg-gray-50 border-t border-gray-100">
                      {editId === client.id ? (
                        <div className="pt-4 space-y-4">
                          <FormFields form={editForm} setForm={setEditForm} />
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => setEditId(null)}
                              className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors">
                              <X size={14} /> Zrusit
                            </button>
                            <button onClick={() => handleEdit(client.id)}
                              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-sycom-500 text-white rounded-xl hover:bg-sycom-600 transition-colors">
                              <Save size={14} /> Ulozit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-4 space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                            {([['ICO', client.ico], ['DIC', client.dic], ['DIC DPH', client.dicDph], ['Telefon', client.phone], ['WWW', client.www], ['Adresa', client.address]] as [string, string | null][])
                              .filter(([, v]) => v).map(([label, val]) => (
                                <div key={label}>
                                  <p className="text-xs text-gray-400">{label}</p>
                                  <p className="text-sm text-gray-700 font-medium break-all">{val}</p>
                                </div>
                              ))}
                            {client.notes && (
                              <div className="col-span-2 sm:col-span-3">
                                <p className="text-xs text-gray-400">Poznamky</p>
                                <p className="text-sm text-gray-700">{client.notes}</p>
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
                              <Euro size={12} /> Cennik (EUR/hod)
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {HOURS_TYPES.map(type => (
                                <div key={type} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2">
                                  <span className="text-xs text-gray-500">{HOURS_LABELS[type]}</span>
                                  <span className="text-sm font-semibold text-gray-800">
                                    {priceMap[type] > 0 ? (priceMap[type].toFixed(2) + ' EUR') : <span className="text-gray-300 font-normal">-</span>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </PortalLayout>
  )
}
