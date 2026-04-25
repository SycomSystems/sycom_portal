'use client'
// src/app/(admin)/admin/sklad/items/[id]/page.tsx
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { ChevronLeft, Plus, Pencil, Trash2, Check, X, Star, Package, AlertTriangle, BarChart2, ArrowDownLeft, ArrowUpRight } from 'lucide-react'

function fmt(n: number) { return n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('sk-SK') }

const MOVEMENT_LABELS: Record<string, string> = {
  BUY: 'Nákup', SELL: 'Predaj', RETURN_FROM_CUSTOMER: 'Vrátenie od zákazníka',
  RETURN_TO_SUPPLIER: 'Vrátenie dodávateľovi', WRITEOFF: 'Odpis', CORRECTION: 'Korekcia',
}
const MOVEMENT_COLORS: Record<string, string> = {
  BUY: 'bg-green-100 text-green-700', SELL: 'bg-blue-100 text-blue-700',
  RETURN_FROM_CUSTOMER: 'bg-teal-100 text-teal-700', RETURN_TO_SUPPLIER: 'bg-orange-100 text-orange-700',
  WRITEOFF: 'bg-red-100 text-red-700', CORRECTION: 'bg-gray-100 text-gray-700',
}

export default function StockItemDetailPage() {
  const { id } = useParams() as { id: string }
  const router  = useRouter()

  const [item,      setItem]      = useState<any>(null)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editing,   setEditing]   = useState(false)
  const [status,    setStatus]    = useState<{type:'success'|'error'; msg:string}|null>(null)

  // Edit form
  const [eName,            setEName]            = useState('')
  const [eSku,             setESku]             = useState('')
  const [eCategory,        setECategory]        = useState('')
  const [eDescription,     setEDescription]     = useState('')
  const [eUnit,            setEUnit]            = useState('ks')
  const [eVatRate,         setEVatRate]         = useState('20')
  const [eMinStock,        setEMinStock]        = useState('0')
  const [eMaxStock,        setEMaxStock]        = useState('0')
  const [eLocation,        setELocation]        = useState('')
  const [eSellingPrice,    setESellingPrice]    = useState('0')

  // New supplier price form
  const [showPriceForm, setShowPriceForm] = useState(false)
  const [pSupplierId,   setPSupplierId]   = useState('')
  const [pSupplierName, setPSupplierName] = useState('')
  const [pPrice,        setPPrice]        = useState('')
  const [pIsPreferred,  setPIsPreferred]  = useState(false)
  const [pMinQty,       setPMinQty]       = useState('')
  const [pLeadTime,     setPLeadTime]     = useState('')
  const [pSupplierSku,  setPSupplierSku]  = useState('')
  const [pNote,         setPNote]         = useState('')
  const [pSubmitting,   setPSubmitting]   = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [itemRes, supRes] = await Promise.all([
        fetch(`/api/stock/items/${id}`).then(r => r.json()),
        fetch('/api/stock/suppliers').then(r => r.json()),
      ])
      setItem(itemRes)
      setSuppliers(Array.isArray(supRes) ? supRes : [])
      // Fill edit form
      setEName(itemRes.name || '')
      setESku(itemRes.sku || '')
      setECategory(itemRes.category || '')
      setEDescription(itemRes.description || '')
      setEUnit(itemRes.unit || 'ks')
      setEVatRate(String(itemRes.vatRate || 20))
      setEMinStock(String(itemRes.minStock || 0))
      setEMaxStock(String(itemRes.maxStock || 0))
      setELocation(itemRes.location || '')
      setESellingPrice(String(itemRes.sellingPrice ?? 0))
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const showStatus = (type: 'success'|'error', msg: string) => {
    setStatus({ type, msg }); setTimeout(() => setStatus(null), 4000)
  }

  async function handleSave() {
    try {
      const res = await fetch(`/api/stock/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: eName, sku: eSku, category: eCategory, description: eDescription,
          unit: eUnit, vatRate: parseFloat(eVatRate), minStock: parseInt(eMinStock),
          maxStock: parseInt(eMaxStock), location: eLocation,
          sellingPrice: parseFloat(eSellingPrice) || 0,
        }),
      })
      if (!res.ok) throw new Error('Chyba pri ukladaní')
      setEditing(false)
      load()
      showStatus('success', 'Karta tovaru bola uložená.')
    } catch (e: any) { showStatus('error', e.message) }
  }

  async function handleAddPrice() {
    if (!pPrice) return
    setPSubmitting(true)
    try {
      let finalSupplierId = pSupplierId
      if (!finalSupplierId && pSupplierName.trim()) {
        const r = await fetch('/api/stock/suppliers', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: pSupplierName.trim() }),
        })
        const s = await r.json()
        finalSupplierId = s.id
      }
      if (!finalSupplierId) throw new Error('Vyberte dodávateľa')

      const res = await fetch('/api/stock/supplier-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockItemId: id, supplierId: finalSupplierId,
          price: parseFloat(pPrice), isPreferred: pIsPreferred,
          minOrderQty: pMinQty ? parseFloat(pMinQty) : null,
          leadTimeDays: pLeadTime ? parseInt(pLeadTime) : null,
          supplierSku: pSupplierSku || null, note: pNote || null,
        }),
      })
      if (!res.ok) throw new Error('Chyba')
      setShowPriceForm(false)
      setPSupplierId(''); setPSupplierName(''); setPPrice(''); setPIsPreferred(false)
      setPMinQty(''); setPLeadTime(''); setPSupplierSku(''); setPNote('')
      load(); showStatus('success', 'Cena dodávateľa bola pridaná.')
    } catch (e: any) { showStatus('error', e.message) }
    finally { setPSubmitting(false) }
  }

  async function handleDeletePrice(priceId: string) {
    if (!confirm('Zmazať cenu dodávateľa?')) return
    await fetch(`/api/stock/supplier-prices?id=${priceId}`, { method: 'DELETE' })
    load(); showStatus('success', 'Cena bola odstránená.')
  }

  async function handleSetPreferred(priceId: string, supplierId: string, price: number) {
    await fetch('/api/stock/supplier-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stockItemId: id, supplierId, price, isPreferred: true }),
    })
    load()
  }

  if (loading) return (
    <PortalLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sycom-500 border-t-transparent rounded-full animate-spin"/>
      </div>
    </PortalLayout>
  )

  if (!item) return (
    <PortalLayout>
      <p className="text-gray-400 text-center py-20">Tovar nenájdený.</p>
    </PortalLayout>
  )

  const movements  = item.movements   ?? []
  const spList     = item.supplierPrices ?? []
  const lowestPrice = spList.reduce((min: number, sp: any) => sp.price < min ? sp.price : min, Infinity)

  return (
    <PortalLayout>
      <div className="max-w-5xl mx-auto py-6 px-4">

        {/* Back */}
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-sycom-500 transition-colors mb-5">
          <ChevronLeft size={14}/> Späť na sklad
        </button>

        {status && (
          <div className={`mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm ${status.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {status.type === 'success' ? <Check size={14}/> : <X size={14}/>} {status.msg}
          </div>
        )}

        <div className="grid grid-cols-3 gap-5">

          {/* Left: Card info */}
          <div className="col-span-2 space-y-4">

            {/* Basic info card */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-sycom-500 to-sycom-300"/>
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{item.name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    {item.sku && <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{item.sku}</span>}
                    {item.category && <span className="text-xs text-sycom-600 bg-sycom-50 px-2 py-0.5 rounded font-semibold">{item.category}</span>}
                    {item.location && <span className="text-xs text-gray-500 flex items-center gap-1">📍 {item.location}</span>}
                  </div>
                </div>
                <button onClick={() => setEditing(!editing)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:border-sycom-400 hover:text-sycom-500 transition-colors">
                  <Pencil size={12}/> {editing ? 'Zrušiť' : 'Upraviť'}
                </button>
              </div>

              {editing ? (
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-semibold text-gray-500 mb-1">Názov *</label><input value={eName} onChange={e => setEName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                    <div><label className="block text-xs font-semibold text-gray-500 mb-1">SKU / kód</label><input value={eSku} onChange={e => setESku(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                    <div><label className="block text-xs font-semibold text-gray-500 mb-1">Kategória</label><input value={eCategory} onChange={e => setECategory(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                    <div><label className="block text-xs font-semibold text-gray-500 mb-1">Jednotka</label>
                      <select value={eUnit} onChange={e => setEUnit(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none bg-white">
                        {['ks', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'h', 'bal', 'set'].map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div><label className="block text-xs font-semibold text-gray-500 mb-1">DPH (%)</label><input type="number" value={eVatRate} onChange={e => setEVatRate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                    <div><label className="block text-xs font-semibold text-gray-500 mb-1">Predajná cena bez DPH (€)</label><input type="number" min="0" step="0.01" value={eSellingPrice} onChange={e => setESellingPrice(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                    <div><label className="block text-xs font-semibold text-gray-500 mb-1">Umiestnenie (polica/miestnosť)</label><input value={eLocation} onChange={e => setELocation(e.target.value)} placeholder="napr. Polica A3" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                    <div><label className="block text-xs font-semibold text-gray-500 mb-1">Min. stav</label><input type="number" value={eMinStock} onChange={e => setEMinStock(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                    <div><label className="block text-xs font-semibold text-gray-500 mb-1">Max. stav</label><input type="number" value={eMaxStock} onChange={e => setEMaxStock(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                  </div>
                  <div><label className="block text-xs font-semibold text-gray-500 mb-1">Popis</label><textarea value={eDescription} onChange={e => setEDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 resize-y"/></div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Zrušiť</button>
                    <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600"><Check size={14}/> Uložiť</button>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  {item.description && <p className="text-sm text-gray-600 mb-4">{item.description}</p>}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Aktuálny stav',    value: `${item.currentStock} ${item.unit}`, color: item.minStock > 0 && item.currentStock <= item.minStock ? 'text-orange-600' : 'text-gray-900' },
                      { label: 'Avg. nák. cena',   value: fmt(item.avgPurchasePrice) + ' €',   color: 'text-gray-900' },
                      { label: 'Predajná cena',     value: item.sellingPrice > 0 ? fmt(item.sellingPrice) + ' €' : '—', color: 'text-sycom-600' },
                      { label: 'Hodnota skladu',   value: fmt(item.currentStock * item.avgPurchasePrice) + ' €', color: 'text-sycom-600' },
                    ].map(s => (
                      <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{s.label}</p>
                        <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                  {item.minStock > 0 && item.currentStock <= item.minStock && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 px-3 py-2 rounded-xl">
                      <AlertTriangle size={13}/> Nízky stav skladu! Min. stav: {item.minStock} {item.unit}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Movement history */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-sycom-500 to-sycom-300"/>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800">História pohybov ({movements.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {['Typ','Množstvo','Cena/ks','Spolu','Dátum','Dodávateľ/Zákazník','Faktúra','Zapísal'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {movements.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">Žiadne pohyby.</td></tr>
                    ) : movements.map((m: any) => (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${MOVEMENT_COLORS[m.type] || 'bg-gray-100 text-gray-700'}`}>{MOVEMENT_LABELS[m.type] || m.type}</span>
                        </td>
                        <td className="px-4 py-2.5 font-medium">{m.quantity} {item.unit}</td>
                        <td className="px-4 py-2.5">{fmt(m.pricePerUnit)} €</td>
                        <td className="px-4 py-2.5 font-semibold">{fmt(m.totalPrice)} €</td>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(m.date)}</td>
                        <td className="px-4 py-2.5 text-gray-600">{m.supplier?.name || m.client?.name || '—'}</td>
                        <td className="px-4 py-2.5 text-xs font-mono text-sycom-600">{m.invoiceNumber || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{m.addedBy?.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right: Supplier price list */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-sycom-500 to-sycom-300"/>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800">Cenník dodávateľov</h2>
                <button onClick={() => setShowPriceForm(!showPriceForm)}
                  className="flex items-center gap-1 text-xs font-semibold text-sycom-600 bg-sycom-50 border border-sycom-200 px-2.5 py-1.5 rounded-lg hover:bg-sycom-100 transition-colors">
                  <Plus size={12}/> Pridať
                </button>
              </div>

              {showPriceForm && (
                <div className="p-4 border-b border-gray-100 bg-sycom-50 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Dodávateľ *</label>
                    <select value={pSupplierId} onChange={e => setPSupplierId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-sycom-400">
                      <option value="">— Vybrať —</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {!pSupplierId && (
                      <input value={pSupplierName} onChange={e => setPSupplierName(e.target.value)} placeholder="alebo zadajte nového..." className="w-full mt-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Cena bez DPH (€) *</label><input type="number" min="0" step="0.01" value={pPrice} onChange={e => setPPrice(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Kód u dodávateľa</label><input value={pSupplierSku} onChange={e => setPSupplierSku(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Min. obj. množstvo</label><input type="number" min="0" value={pMinQty} onChange={e => setPMinQty(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Dodacia lehota (dni)</label><input type="number" min="0" value={pLeadTime} onChange={e => setPLeadTime(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                  </div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Poznámka</label><input value={pNote} onChange={e => setPNote(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={pIsPreferred} onChange={e => setPIsPreferred(e.target.checked)} className="accent-sycom-500"/>
                    Nastaviť ako preferovaného dodávateľa
                  </label>
                  <div className="flex gap-2">
                    <button onClick={() => setShowPriceForm(false)} className="flex-1 py-2 text-xs text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-100">Zrušiť</button>
                    <button onClick={handleAddPrice} disabled={pSubmitting || !pPrice}
                      className="flex-1 py-2 text-xs font-semibold bg-sycom-500 text-white rounded-xl hover:bg-sycom-600 disabled:opacity-50">
                      {pSubmitting ? 'Ukladám...' : 'Uložiť cenu'}
                    </button>
                  </div>
                </div>
              )}

              <div className="divide-y divide-gray-100">
                {spList.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-gray-400 text-center">Žiadne ceny dodávateľov.<br/>Pridajte prvého kliknutím na „Pridať".</p>
                ) : spList.map((sp: any) => (
                  <div key={sp.id} className={`p-4 ${sp.isPreferred ? 'bg-amber-50' : ''}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        {sp.isPreferred && <Star size={12} className="text-amber-500 fill-amber-500"/>}
                        <span className="text-sm font-bold text-gray-800">{sp.supplier.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {!sp.isPreferred && (
                          <button onClick={() => handleSetPreferred(sp.id, sp.supplier.id, sp.price)}
                            className="p-1 text-gray-300 hover:text-amber-500 transition-colors" title="Nastaviť ako preferovaného">
                            <Star size={13}/>
                          </button>
                        )}
                        <button onClick={() => handleDeletePrice(sp.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xl font-bold text-sycom-600">{fmt(sp.price)} €</span>
                      {sp.price === lowestPrice && spList.length > 1 && (
                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">NAJLACNEJŠÍ</span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {sp.supplierSku    && <p className="text-xs text-gray-400">Kód: <span className="font-mono text-gray-600">{sp.supplierSku}</span></p>}
                      {sp.minOrderQty    && <p className="text-xs text-gray-400">Min. obj.: {sp.minOrderQty} ks</p>}
                      {sp.leadTimeDays   && <p className="text-xs text-gray-400">Dodanie: {sp.leadTimeDays} dní</p>}
                      {sp.note           && <p className="text-xs text-gray-400 italic">{sp.note}</p>}
                      <p className="text-[10px] text-gray-300 mt-1">Aktualizované: {fmtDate(sp.lastUpdated)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick stats */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Štatistiky</h3>
              {[
                { label: 'Celkový pohybov', value: movements.length },
                { label: 'Prijaté celkom', value: movements.filter((m:any) => m.type === 'BUY').reduce((s:number, m:any) => s + m.quantity, 0) + ' ' + item.unit },
                { label: 'Predané celkom', value: movements.filter((m:any) => m.type === 'SELL').reduce((s:number, m:any) => s + m.quantity, 0) + ' ' + item.unit },
                { label: 'Obrat (predaj)', value: fmt(movements.filter((m:any) => m.type === 'SELL').reduce((s:number, m:any) => s + m.totalPrice, 0)) + ' €' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-semibold">{s.label}</span>
                  <span className="font-bold text-gray-700">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PortalLayout>
  )
}
