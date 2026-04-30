'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { ArrowLeft, Check, X, Save } from 'lucide-react'

const STATUS_LABEL: Record<string, string> = {
  DOPYT:           'Dopyt',
  PONUKA_ODOSLANA: 'Ponuka odoslaná',
  SCHVALENA:       'Schválená',
  ZAMIETNUTA:      'Zamietnutá',
}
const STATUS_COLOR: Record<string, string> = {
  DOPYT:           'bg-gray-100 text-gray-600',
  PONUKA_ODOSLANA: 'bg-blue-100 text-blue-700',
  SCHVALENA:       'bg-green-100 text-green-700',
  ZAMIETNUTA:      'bg-red-100 text-red-600',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('sk-SK', { day:'2-digit', month:'2-digit', year:'numeric' })
}

export default function OrderDetailPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const isStaff = role === 'ADMIN' || role === 'AGENT'
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => fetch(`/api/orders/${id}`).then(r => r.json()),
  })

  const [prices, setPrices] = useState<Record<string, string>>({})
  const [adminNote, setAdminNote] = useState('')
  const [adminStatus, setAdminStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Init adminNote ked sa nacita order
  useEffect(() => {
    if (order && adminNote === '') setAdminNote(order.adminNote ?? '')
  }, [order?.id])

  function getPrice(itemId: string, current: number | null) {
    if (prices[itemId] !== undefined) return prices[itemId]
    return current != null ? String(current) : ''
  }

  function handlePriceChange(itemId: string, val: string) {
    setPrices(p => ({ ...p, [itemId]: val }))
    setIsDirty(true)
  }

  function handleNoteChange(val: string) {
    setAdminNote(val)
    setIsDirty(true)
  }

  async function callPatch(data: any) {
    setSaving(true)
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await qc.refetchQueries({ queryKey: ['order', id] })
    await qc.refetchQueries({ queryKey: ['orders'] })
    setSaving(false)
  }

  // Ulozi ceny a poznamku BEZ zmeny stavu
  async function saveChanges() {
    const items = order.items.map((it: any) => ({
      id: it.id,
      unitPrice: parseFloat(prices[it.id] ?? String(it.unitPrice ?? 0)) || 0,
    }))
    await callPatch({ adminNote, items })
    setIsDirty(false)
  }

  // Odosle ponuku — zmeni stav na PONUKA_ODOSLANA (ceny uz su ulozene)
  async function sendOffer() {
    await callPatch({ status: 'PONUKA_ODOSLANA' })
    setIsDirty(false)
  }

  // Admin zmeni stav cez dropdown
  async function changeStatus() {
    await callPatch({ status: adminStatus || order.status })
    setAdminStatus('')
    setIsDirty(false)
  }

  if (isLoading) return <PortalLayout><div className="p-8 text-center text-gray-400 text-sm">Načítavam...</div></PortalLayout>
  if (!order || order.error) return <PortalLayout><div className="p-8 text-center text-gray-400 text-sm">Objednávka nenájdená</div></PortalLayout>

  const total = order.items.reduce((s: number, it: any) => s + (it.quantity * (it.unitPrice ?? 0)), 0)
  const canSendOffer = isStaff && !isDirty && (order.status === 'DOPYT' || order.status === 'PONUKA_ODOSLANA')
  const canApprove = !isStaff && order.status === 'PONUKA_ODOSLANA'
  const statusChanged = adminStatus && adminStatus !== order.status

  return (
    <PortalLayout>
      <div className="w-full py-4 px-5 max-w-4xl">
        <button onClick={() => router.push('/orders')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-4">
          <ArrowLeft size={13} /> Späť na zoznam
        </button>

        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-lg font-bold text-gray-800">Objednávka #{order.orderNumber}</h1>
            <p className="text-xs text-gray-400">{formatDate(order.createdAt)} · {order.creator?.name}{order.client ? ` · ${order.client.name}` : ''}</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[order.status]}`}>
            {STATUS_LABEL[order.status]}
          </span>
        </div>

        {/* Polozky */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-400 uppercase">Položka</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-400 uppercase">Množstvo</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-400 uppercase">Poznámka</th>
                <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-400 uppercase">Cena/ks</th>
                <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-400 uppercase">Spolu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {order.items.map((it: any) => (
                <tr key={it.id}>
                  <td className="px-4 py-3 text-sm text-gray-700">{it.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{it.quantity} {it.unit ?? ''}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{it.clientNote ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {isStaff ? (
                      <input
                        type="number" min="0" step="0.01"
                        value={getPrice(it.id, it.unitPrice)}
                        onChange={e => handlePriceChange(it.id, e.target.value)}
                        className="w-24 border border-gray-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    ) : (
                      <span className="text-sm text-gray-700">{it.unitPrice != null ? `${it.unitPrice.toFixed(2)} €` : '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                    {it.unitPrice != null ? `${(it.quantity * it.unitPrice).toFixed(2)} €` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-gray-500 text-right">Celkom</td>
                <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-800">{total > 0 ? `${total.toFixed(2)} €` : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Poznamky */}
        {order.clientNote && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-gray-400 mb-1">Poznámka klienta</p>
            <p className="text-sm text-gray-600">{order.clientNote}</p>
          </div>
        )}

        {isStaff && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Správa pre klienta / poznámka</label>
            <textarea
              value={adminNote}
              onChange={e => handleNoteChange(e.target.value)}
              rows={2} placeholder="Napr. dodacia lehota, podmienky..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        )}

        {order.adminNote && !isStaff && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-blue-400 mb-1">Správa od dodávateľa</p>
            <p className="text-sm text-blue-700">{order.adminNote}</p>
          </div>
        )}

        {/* Akcie */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Admin: Ulozit (vzdy ak su zmeny) */}
          {isStaff && isDirty && (
            <button onClick={saveChanges} disabled={saving}
              className="flex items-center gap-1.5 bg-gray-700 text-white text-sm px-5 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition">
              <Save size={14} /> {saving ? 'Ukladám...' : 'Uložiť zmeny'}
            </button>
          )}

          {/* Admin: Odoslat ponuku (len ked nie su neuložené zmeny) */}
          {canSendOffer && (
            <button onClick={sendOffer} disabled={saving}
              className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? 'Odosielam...' : 'Odoslať ponuku klientovi'}
            </button>
          )}

          {/* Admin: Zmena stavu cez dropdown */}
          {isStaff && (
            <div className="flex items-center gap-2 ml-auto">
              <select
                value={adminStatus || order.status}
                onChange={e => setAdminStatus(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="DOPYT">Dopyt</option>
                <option value="PONUKA_ODOSLANA">Ponuka odoslaná</option>
                <option value="SCHVALENA">Schválená</option>
                <option value="ZAMIETNUTA">Zamietnutá</option>
              </select>
              {statusChanged && (
                <button onClick={changeStatus} disabled={saving}
                  className="bg-gray-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-40 transition">
                  Zmeniť stav
                </button>
              )}
            </div>
          )}

          {/* Klient: schvalit/zamietnut */}
          {canApprove && (
            <>
              <button onClick={() => callPatch({ status: 'SCHVALENA' })} disabled={saving}
                className="flex items-center gap-1.5 bg-green-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
                <Check size={15} /> Schváliť
              </button>
              <button onClick={() => callPatch({ status: 'ZAMIETNUTA' })} disabled={saving}
                className="flex items-center gap-1.5 bg-red-500 text-white text-sm px-5 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 transition">
                <X size={15} /> Zamietnuť
              </button>
            </>
          )}
        </div>
      </div>
    </PortalLayout>
  )
}
