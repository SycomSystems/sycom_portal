'use client'
// src/app/(admin)/admin/sklad/page.tsx
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import {
  Plus, ShoppingCart, Package, Search, ChevronUp, ChevronDown,
  AlertTriangle, X, Check, Pencil, Trash2, Eye, Tag, ArrowUpRight,
  ArrowDownLeft, BarChart2, RefreshCw, List, Grid3x3,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

type MovementType = 'BUY'|'SELL'|'RETURN_FROM_CUSTOMER'|'RETURN_TO_SUPPLIER'|'WRITEOFF'|'CORRECTION'

const MOVEMENT_LABELS: Record<MovementType, string> = {
  BUY:'Nákup', SELL:'Predaj', RETURN_FROM_CUSTOMER:'Vrátenie od zákazníka',
  RETURN_TO_SUPPLIER:'Vrátenie dodávateľovi', WRITEOFF:'Odpis', CORRECTION:'Korekcia',
}
const MOVEMENT_COLORS: Record<MovementType, string> = {
  BUY:'bg-green-100 text-green-700 border border-green-200',
  SELL:'bg-blue-100 text-blue-700 border border-blue-200',
  RETURN_FROM_CUSTOMER:'bg-teal-100 text-teal-700 border border-teal-200',
  RETURN_TO_SUPPLIER:'bg-orange-100 text-orange-700 border border-orange-200',
  WRITEOFF:'bg-red-100 text-red-700 border border-red-200',
  CORRECTION:'bg-gray-100 text-gray-700 border border-gray-200',
}

function fmt(n: number) { return n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('sk-SK') }
function toInputDate(d: string) { return new Date(d).toISOString().slice(0, 10) }

interface SupplierPrice { id:string; price:number; currency:string; isPreferred:boolean; minOrderQty:number|null; leadTimeDays:number|null; supplierSku:string|null; note:string|null; lastUpdated:string; supplier:{id:string;name:string;email?:string;phone?:string} }
interface StockItem { id:string; name:string; sku:string|null; category:string|null; description:string|null; unit:string; vatRate:number; minStock:number; maxStock:number; currentStock:number; avgPurchasePrice:number; lastPurchasePrice:number; lastSalePrice:number; sellingPrice:number; location:string|null; serialTracking:boolean; supplierPrices?:SupplierPrice[] }
interface Supplier { id:string; name:string }
interface Client { id:string; name:string }
interface Movement { id:string; type:MovementType; quantity:number; pricePerUnit:number; totalPrice:number; vatRate:number; note:string|null; invoiceNumber:string|null; date:string; stockItem:StockItem; supplier:Supplier|null; client:{id:string;name:string}|null; addedBy:{id:string;name:string} }

function Autocomplete({ label, value, onChange, onSelect, suggestions, onNotFound, notFoundLabel, placeholder, required }: {
  label:string; value:string; onChange:(v:string)=>void; onSelect:(id:string,name:string,extra?:any)=>void
  suggestions:{id:string;name:string;sub?:string}[]; onNotFound?:(name:string)=>void; notFoundLabel?:string; placeholder?:string; required?:boolean
}) {
  const [open, setOpen] = useState(false)
  const filtered = value.length > 0 ? suggestions.filter(s => s.name.toLowerCase().includes(value.toLowerCase())) : suggestions.slice(0, 8)
  const exactMatch = suggestions.some(s => s.name.toLowerCase() === value.toLowerCase())
  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}{required && ' *'}</label>
      <input type="text" value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-400/10"
      />
      {open && (value.length > 0 || suggestions.length > 0) && (
        <div className="absolute z-30 mt-1 w-full border border-gray-200 rounded-xl overflow-hidden shadow-xl bg-white max-h-52 overflow-y-auto">
          {filtered.map(s => (
            <button key={s.id} onMouseDown={() => { onSelect(s.id, s.name, s); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-sycom-50 transition-colors flex items-center justify-between">
              <span className="font-medium">{s.name}</span>
              {s.sub && <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{s.sub}</span>}
            </button>
          ))}
          {!exactMatch && onNotFound && (
            <button onMouseDown={() => { onNotFound(value); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 text-sm text-green-700 font-semibold hover:bg-green-50 transition-colors border-t border-gray-100 flex items-center gap-1.5">
              <Plus size={13} /> {notFoundLabel ?? 'Pridať'}: „{value}"
            </button>
          )}
          {filtered.length === 0 && !onNotFound && (
            <p className="px-3 py-2.5 text-sm text-gray-400">Žiadne výsledky.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function SkladPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const router = useRouter()

  const [movements, setMovements] = useState<Movement[]>([])
  const [items, setItems] = useState<StockItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'movements'|'items'>('items')
  const [modal, setModal] = useState<'buy'|'sell'|'newItem'|null>(null)
  const [status, setStatus] = useState<{type:'success'|'error'; msg:string}|null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [sortCol, setSortCol] = useState('date')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')

  // Buy form
  const [buyItemId, setBuyItemId] = useState('')
  const [buyItemName, setBuyItemName] = useState('')
  const [buyIsNew, setBuyIsNew] = useState(false)
  const [buyQty, setBuyQty] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [buyVat, setBuyVat] = useState('23')
  const [buySupplierId, setBuySupplierId] = useState('')
  const [buySupplierName, setBuySupplierName] = useState('')
  const [buyDate, setBuyDate] = useState(new Date().toISOString().slice(0, 10))
  const [buyNote, setBuyNote] = useState('')
  const [buyInvoice, setBuyInvoice] = useState('')
  const [buySubmitting, setBuySubmitting] = useState(false)
  const [buySelectedItem, setBuySelectedItem] = useState<StockItem|null>(null)
  const [buySellingPrice, setBuySellingPrice] = useState('')

  // Sell form
  const [sellItemId, setSellItemId] = useState('')
  const [sellItemName, setSellItemName] = useState('')
  const [sellQty, setSellQty] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [sellClientId, setSellClientId] = useState('')
  const [sellClientName, setSellClientName] = useState('')
  const [sellDate, setSellDate] = useState(new Date().toISOString().slice(0, 10))
  const [sellNote, setSellNote] = useState('')
  const [sellInvoice, setSellInvoice] = useState('')
  const [sellMarkup, setSellMarkup] = useState('20')
  const [sellSubmitting, setSellSubmitting] = useState(false)
  const [sellSelectedItem, setSellSelectedItem] = useState<StockItem|null>(null)

  // Edit movement
  const [editMovement, setEditMovement] = useState<Movement|null>(null)
  const [eQty, setEQty] = useState('')
  const [ePrice, setEPrice] = useState('')
  const [eVat, setEVat] = useState('')
  const [eNote, setENote] = useState('')
  const [eDate, setEDate] = useState('')
  const [eInvoice, setEInvoice] = useState('')
  const [eSubmitting, setESubmitting] = useState(false)
  // New item card form
  const [niName, setNiName] = useState('')
  const [niSku, setNiSku] = useState('')
  const [niCategory, setNiCategory] = useState('')
  const [niUnit, setNiUnit] = useState('ks')
  const [niVat, setNiVat] = useState('20')
  const [niSellingPrice, setNiSellingPrice] = useState('')
  const [niMinStock, setNiMinStock] = useState('0')
  const [niSubmitting, setNiSubmitting] = useState(false)
  const [niError, setNiError] = useState('')
  const [eStatus, setEStatus] = useState<{type:'success'|'error'; msg:string}|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (filterFrom)     p.set('from', filterFrom)
      if (filterTo)       p.set('to', filterTo)
      if (filterSupplier) p.set('supplierId', filterSupplier)
      if (filterClient)   p.set('clientId', filterClient)
      if (filterType)     p.set('type', filterType)
      const [m, it, su, cl] = await Promise.all([
        fetch('/api/stock/movements?' + p).then(r => r.json()),
        fetch('/api/stock/items?withPrices=1').then(r => r.json()),
        fetch('/api/stock/suppliers').then(r => r.json()),
        fetch('/api/clients').then(r => r.json()),
      ])
      setMovements(Array.isArray(m) ? m : [])
      setItems(Array.isArray(it) ? it : [])
      setSuppliers(Array.isArray(su) ? su : [])
      setClients(Array.isArray(cl) ? cl : [])
    } catch {}
    setLoading(false)
  }, [filterFrom, filterTo, filterSupplier, filterClient, filterType])

  useEffect(() => { load() }, [load])

  // Auto-fill sell price from avg purchase price
  useEffect(() => {
    if (!sellSelectedItem || !sellSelectedItem.avgPurchasePrice) return
    const mu = Number(sellMarkup || 0)
    setSellPrice((sellSelectedItem.avgPurchasePrice * (1 + mu / 100)).toFixed(2))
  }, [sellMarkup])

  // Auto-fill buy price from preferred supplier
  useEffect(() => {
    if (buySelectedItem && buySupplierId && buySelectedItem.supplierPrices) {
      const sp = buySelectedItem.supplierPrices.find(p => p.supplier.id === buySupplierId)
      if (sp) setBuyPrice(String(sp.price))
    }
  }, [buySupplierId, buySelectedItem])

  const showStatus = (type: 'success'|'error', msg: string) => {
    setStatus({ type, msg }); setTimeout(() => setStatus(null), 4000)
  }

  const filtered = useMemo(() => {
    let data = [...movements]
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(m =>
        m.stockItem.name.toLowerCase().includes(q) ||
        (m.supplier?.name ?? '').toLowerCase().includes(q) ||
        (m.client?.name ?? '').toLowerCase().includes(q) ||
        m.addedBy.name.toLowerCase().includes(q) ||
        (m.note ?? '').toLowerCase().includes(q) ||
        (m.invoiceNumber ?? '').toLowerCase().includes(q)
      )
    }
    data.sort((a, b) => {
      let av: any, bv: any
      if (sortCol === 'date')      { av = new Date(a.date).getTime(); bv = new Date(b.date).getTime() }
      else if (sortCol === 'name') { av = a.stockItem.name; bv = b.stockItem.name }
      else if (sortCol === 'qty')  { av = a.quantity; bv = b.quantity }
      else if (sortCol === 'price'){ av = a.pricePerUnit; bv = b.pricePerUnit }
      else if (sortCol === 'total'){ av = a.totalPrice; bv = b.totalPrice }
      else if (sortCol === 'type') { av = a.type; bv = b.type }
      else if (sortCol === 'supplier') { av = a.supplier?.name ?? ''; bv = b.supplier?.name ?? '' }
      else if (sortCol === 'client')   { av = a.client?.name ?? ''; bv = b.client?.name ?? '' }
      else return 0
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return data
  }, [movements, search, sortCol, sortDir])

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ChevronUp size={11} className="text-gray-300" />
    return sortDir === 'asc' ? <ChevronUp size={11} className="text-sycom-500" /> : <ChevronDown size={11} className="text-sycom-500" />
  }

  const lowStock   = items.filter(i => i.minStock > 0 && i.currentStock <= i.minStock)
  const totalValue = items.reduce((s, i) => s + i.currentStock * i.avgPurchasePrice, 0)

  const itemSuggestions = items.map(i => ({ ...i, sub: `${i.currentStock} ${i.unit} | avg: ${fmt(i.avgPurchasePrice)} EUR` }))
  const supplierSuggestions = suppliers.map(s => ({ id: s.id, name: s.name }))
  const clientSuggestions   = clients.map(c => ({ id: c.id, name: c.name }))

  async function handleNewItem() {
    if (!niName.trim()) return
    setNiSubmitting(true)
    try {
      const res = await fetch('/api/stock/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: niName.trim(), sku: niSku.trim() || undefined,
          category: niCategory.trim() || undefined, unit: niUnit,
          vatRate: parseFloat(niVat) || 20,
          sellingPrice: parseFloat(niSellingPrice) || 0,
          minStock: parseInt(niMinStock) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chyba')
      setModal(null)
      setNiName(''); setNiSku(''); setNiCategory(''); setNiUnit('ks')
      setNiVat('20'); setNiSellingPrice(''); setNiMinStock('0')
      load()
      showStatus('success', 'Karta tovaru bola vytvorená.')
    } catch (e: any) { showStatus('error', e.message) }
    finally { setNiSubmitting(false) }
  }
  async function handleBuy() {
    if (!buyItemName.trim() || !buyQty || !buyPrice) return
    setBuySubmitting(true)
    try {
      const stockItemId = buyIsNew ? `NEW:${buyItemName.trim()}` : buyItemId
      const res = await fetch('/api/stock/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'BUY', stockItemId,
          quantity: parseFloat(buyQty), pricePerUnit: parseFloat(buyPrice), vatRate: parseFloat(buyVat),
          supplierId: buySupplierId || null,
          newSupplierName: !buySupplierId && buySupplierName.trim() ? buySupplierName.trim() : null,
          note: buyNote || null, date: buyDate, invoiceNumber: buyInvoice || null,
          newItemSellingPrice: parseFloat(buySellingPrice) || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chyba')
      setModal(null)
      resetBuyForm()
      load()
      showStatus('success', 'Tovar bol prijatý na sklad.')
    } catch (e: any) { showStatus('error', e.message) }
    finally { setBuySubmitting(false) }
  }

  function resetBuyForm() {
    setBuyItemId(''); setBuyItemName(''); setBuyIsNew(false); setBuyQty(''); setBuyPrice('')
    setBuyVat('23'); setBuySupplierId(''); setBuySupplierName(''); setBuyNote(''); setBuyInvoice('')
    setBuyDate(new Date().toISOString().slice(0, 10)); setBuySelectedItem(null)
    setBuySellingPrice('')
  }

  async function handleSell() {
    if (!sellItemId || !sellQty || !sellPrice) return
    setSellSubmitting(true)
    try {
      const res = await fetch('/api/stock/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'SELL', stockItemId: sellItemId,
          quantity: parseFloat(sellQty), pricePerUnit: parseFloat(sellPrice),
          vatRate: sellSelectedItem?.vatRate ?? 20,
          clientId: sellClientId || null,
          note: sellNote || null, date: sellDate, invoiceNumber: sellInvoice || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chyba')
      setModal(null)
      setSellItemId(''); setSellItemName(''); setSellQty(''); setSellPrice('')
      setSellMarkup('20'); setSellClientId(''); setSellClientName(''); setSellNote('')
      setSellInvoice(''); setSellDate(new Date().toISOString().slice(0, 10)); setSellSelectedItem(null)
      load()
      showStatus('success', 'Predaj bol zaznamenaný.')
    } catch (e: any) { showStatus('error', e.message) }
    finally { setSellSubmitting(false) }
  }

  function openEdit(m: Movement) {
    setEditMovement(m); setEQty(String(m.quantity)); setEPrice(String(m.pricePerUnit))
    setEVat(String(m.vatRate)); setENote(m.note || ''); setEDate(toInputDate(m.date))
    setEInvoice(m.invoiceNumber || ''); setEStatus(null)
  }

  async function handleEditSave() {
    if (!editMovement) return
    setESubmitting(true)
    try {
      const res = await fetch('/api/stock/movements?id=' + editMovement.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: parseFloat(eQty), pricePerUnit: parseFloat(ePrice), vatRate: parseFloat(eVat), note: eNote || null, date: eDate, invoiceNumber: eInvoice || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chyba')
      setEStatus({ type: 'success', msg: 'Uložené.' })
      load(); setTimeout(() => { setEStatus(null); setEditMovement(null) }, 1000)
    } catch (e: any) { setEStatus({ type: 'error', msg: e.message }) }
    finally { setESubmitting(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Naozaj vymazať tento pohyb skladu? Stav skladu bude upravený.')) return
    const res = await fetch('/api/stock/movements?id=' + id, { method: 'DELETE' })
    if (res.ok) { load(); showStatus('success', 'Záznam bol vymazaný.') }
    else showStatus('error', 'Chyba pri mazaní.')
  }

  const buyTotal  = (parseFloat(buyQty) || 0) * (parseFloat(buyPrice) || 0)
  const sellTotal = (parseFloat(sellQty) || 0) * (parseFloat(sellPrice) || 0)

  return (
    <PortalLayout>
      <div className="w-full max-w-[1400px] mx-auto py-6 px-4">

        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sklad</h1>
            <p className="text-sm text-gray-500 mt-0.5">Evidencia pohybov tovaru na sklade.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setView(v => v === 'movements' ? 'items' : 'movements')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              {view === 'movements' ? <><Grid3x3 size={14}/> Karty tovaru</> : <><List size={14}/> Pohyby</>}
            </button>
            <button onClick={() => setModal('newItem')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <Tag size={14}/> Nová karta tovaru
            </button>
            <button onClick={() => setModal('buy')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-sm shadow-green-600/20">
              <ArrowDownLeft size={15}/> Príjem tovaru
            </button>
            <button onClick={() => setModal('sell')}
              className="flex items-center gap-2 px-4 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 transition-colors shadow-sm shadow-sycom-500/20">
              <ArrowUpRight size={15}/> Predaj tovaru
            </button>
          </div>
        </div>

        {/* Status toast */}
        {status && (
          <div className={`mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm ${status.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {status.type === 'success' ? <Check size={15}/> : <X size={15}/>} {status.msg}
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3 mb-3">
          {[
            { label: 'Položiek na sklade', value: items.length, icon: <Package size={18}/>, color: 'text-sycom-500', bg: 'bg-sycom-50' },
            { label: 'Hodnota skladu', value: fmt(totalValue) + ' €', icon: <BarChart2 size={18}/>, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Pohybov celkom', value: movements.length, icon: <RefreshCw size={18}/>, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Nízky stav', value: lowStock.length, icon: <AlertTriangle size={18}/>, color: 'text-orange-600', bg: 'bg-orange-50' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                <span className={s.color}>{s.icon}</span>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{s.label}</p>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Low stock alert */}
        {lowStock.length > 0 && (
          <div className="mb-4 flex items-start gap-2.5 px-4 py-3 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl text-sm">
            <AlertTriangle size={15} className="shrink-0 mt-0.5"/>
            <span><strong>Nízky stav skladu:</strong> {lowStock.map(i => `${i.name} (${i.currentStock} ${i.unit})`).join(', ')}</span>
          </div>
        )}

        {/* ── ITEMS VIEW ── */}
        {view === 'items' && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800">Karty tovaru</h2>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input type="text" placeholder="Hľadať tovar..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-sycom-400 w-56"/>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Názov', 'SKU', 'Kategória', 'Jedn.', 'DPH', 'Min', 'Stav', 'Avg. nákup. cena', 'Predajná cena', 'Dodávatelia', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase())).map(item => (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${item.minStock > 0 && item.currentStock <= item.minStock ? 'bg-orange-50/50' : ''}`}>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {item.name}
                        {item.location && <span className="ml-1.5 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{item.location}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.sku ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{item.category ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                      <td className="px-4 py-3 text-gray-500">{item.vatRate}%</td>
                      <td className="px-4 py-3 text-gray-500">{item.minStock}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold flex items-center gap-1 ${item.minStock > 0 && item.currentStock <= item.minStock ? 'text-orange-600' : 'text-gray-900'}`}>
                          {item.minStock > 0 && item.currentStock <= item.minStock && <AlertTriangle size={12}/>}
                          {item.currentStock} {item.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{fmt(item.avgPurchasePrice)} €</td>
                      <td className="px-4 py-3 text-gray-700">{item.sellingPrice > 0 ? fmt(item.sellingPrice) + ' €' : '—'}</td>
                      <td className="px-4 py-3">
                        {/* Supplier price list */}
                        {(item.supplierPrices ?? []).length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {(item.supplierPrices ?? []).map(sp => (
                              <div key={sp.id} className={`flex items-center gap-1.5 text-xs ${sp.isPreferred ? 'text-sycom-600 font-semibold' : 'text-gray-500'}`}>
                                {sp.isPreferred && <span className="w-1.5 h-1.5 rounded-full bg-sycom-500 flex-shrink-0"/>}
                                <span className="truncate max-w-[120px]">{sp.supplier.name}</span>
                                <span className="font-mono flex-shrink-0">{fmt(sp.price)} €</span>
                              </div>
                            ))}
                          </div>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => router.push(`/admin/sklad/items/${item.id}`)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 text-sycom-600 bg-sycom-50 border border-sycom-200 rounded-lg hover:bg-sycom-100 transition-colors font-semibold">
                          <Eye size={11}/> Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={11} className="px-4 py-12 text-center">
                      <Package size={32} className="mx-auto mb-2 text-gray-200"/>
                      <p className="text-sm text-gray-400">Žiadne položky. Pridajte prvý tovar nákupom.</p>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── MOVEMENTS VIEW ── */}
        {view === 'movements' && (
          <>
            {/* Filters */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative sm:col-span-2 lg:col-span-2">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Hľadať..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/>
              </div>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none">
                <option value="">Všetky typy</option>
                {(Object.keys(MOVEMENT_LABELS) as MovementType[]).map(v => <option key={v} value={v}>{MOVEMENT_LABELS[v]}</option>)}
              </select>
              <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none">
                <option value="">Všetci dodávatelia</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none">
                <option value="">Všetci zákazníci</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex items-center gap-1 sm:col-span-2 lg:col-span-2">
                <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="flex-1 px-2 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none"/>
                <span className="text-gray-400 text-xs">—</span>
                <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="flex-1 px-2 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none"/>
              </div>
            </div>

            {/* Movements table */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {[['type','Typ'],['name','Názov'],['qty','Množstvo'],['price','Cena/ks'],['total','Spolu'],['date','Dátum'],['supplier','Dodávateľ'],['client','Zákazník'],['note','Faktúra/Pozn.'],['addedBy','Zapísal']].map(([col, label]) => (
                        <th key={col} onClick={() => toggleSort(col)}
                          className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none whitespace-nowrap">
                          <span className="flex items-center gap-1 sm:col-span-2 lg:col-span-2">{label} <SortIcon col={col}/></span>
                        </th>
                      ))}
                      {role === 'ADMIN' && <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr><td colSpan={11} className="px-4 py-4 text-center text-sm text-gray-400">Načítavam...</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={11} className="px-4 py-12 text-center">
                        <Package size={32} className="mx-auto mb-2 text-gray-200"/>
                        <p className="text-sm text-gray-400">Žiadne pohyby skladu.</p>
                      </td></tr>
                    ) : filtered.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${MOVEMENT_COLORS[m.type]}`}>{MOVEMENT_LABELS[m.type]}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                          {m.stockItem.name}
                          {m.stockItem.sku && <span className="ml-1 text-[10px] text-gray-400 font-mono">({m.stockItem.sku})</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{m.quantity} {m.stockItem.unit}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{fmt(m.pricePerUnit)} €</td>
                        <td className="px-4 py-3 font-semibold whitespace-nowrap">{fmt(m.totalPrice)} €</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-500">{fmtDate(m.date)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">{m.supplier?.name ?? '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">{m.client?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-[160px]">
                          {m.invoiceNumber && <span className="text-xs font-mono text-sycom-600 bg-sycom-50 px-1.5 py-0.5 rounded mr-1">{m.invoiceNumber}</span>}
                          <span className="truncate block text-xs">{m.note ?? ''}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">{m.addedBy.name}</td>
                        {role === 'ADMIN' && (
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1 sm:col-span-2 lg:col-span-2">
                              <button onClick={() => openEdit(m)} className="p-1.5 text-gray-400 hover:text-sycom-500 hover:bg-sycom-50 rounded-lg transition-colors"><Pencil size={12}/></button>
                              <button onClick={() => handleDelete(m.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={12}/></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length > 0 && (
                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                  <span>{filtered.length} záznamov</span>
                  <div className="flex items-center gap-4">
                    <span>Príjem: <strong className="text-green-600">{fmt(filtered.filter(m => ['BUY','RETURN_FROM_CUSTOMER'].includes(m.type)).reduce((s, m) => s + m.totalPrice, 0))} €</strong></span>
                    <span>Predaj: <strong className="text-sycom-600">{fmt(filtered.filter(m => m.type === 'SELL').reduce((s, m) => s + m.totalPrice, 0))} €</strong></span>
                    <span>Celkom: <strong className="text-gray-700">{fmt(filtered.reduce((s, m) => s + m.totalPrice, 0))} €</strong></span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── BUY MODAL ── */}
      {modal === 'buy' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2"><ArrowDownLeft size={16} className="text-green-600"/><h2 className="text-base font-semibold text-gray-900">Príjem tovaru</h2></div>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X size={16}/></button>
            </div>
            <div className="p-4 space-y-4">
              <Autocomplete label="Názov tovaru" value={buyItemName}
                onChange={v => { setBuyItemName(v); setBuyItemId(''); setBuyIsNew(false); setBuySelectedItem(null) }}
                onSelect={(id, name, extra) => { setBuyItemId(id); setBuyItemName(name); setBuyIsNew(false); setBuySelectedItem(extra as StockItem); setBuyVat(String((extra as StockItem).vatRate)) }}
                suggestions={itemSuggestions}
                onNotFound={name => { setBuyItemName(name); setBuyItemId(''); setBuyIsNew(true); setBuySelectedItem(null) }}
                notFoundLabel="Vytvoriť nový tovar" placeholder="Hľadať alebo zadať nový tovar..." required
              />
              {buyIsNew && <p className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-xl">Nový tovar bude vytvorený automaticky pri uložení.</p>}

              {/* Supplier with price list hint */}
              <Autocomplete label="Dodávateľ" value={buySupplierName}
                onChange={v => { setBuySupplierName(v); setBuySupplierId('') }}
                onSelect={(id, name) => { setBuySupplierId(id); setBuySupplierName(name) }}
                suggestions={supplierSuggestions}
                onNotFound={name => { setBuySupplierName(name); setBuySupplierId('') }}
                notFoundLabel="Pridať nového dodávateľa" placeholder="Hľadať alebo zadať nového dodávateľa..."
              />

              {/* Show supplier price list if item selected */}
              {buySelectedItem && (buySelectedItem.supplierPrices ?? []).length > 0 && (
                <div className="bg-sycom-50 border border-sycom-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-sycom-700 mb-2">💰 Cenník dodávateľov</p>
                  <div className="space-y-1">
                    {(buySelectedItem.supplierPrices ?? []).map(sp => (
                      <button key={sp.id}
                        onClick={() => { setBuySupplierId(sp.supplier.id); setBuySupplierName(sp.supplier.name); setBuyPrice(String(sp.price)) }}
                        className={`w-full flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg transition-colors text-left ${buySupplierId === sp.supplier.id ? 'bg-sycom-500 text-white' : 'bg-white text-gray-700 hover:bg-sycom-100 border border-sycom-200'}`}>
                        <span className="flex items-center gap-1.5">
                          {sp.isPreferred && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1 rounded">★ PREFEROVANÝ</span>}
                          {sp.supplier.name}
                        </span>
                        <span className="font-bold font-mono">{fmt(sp.price)} €</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Množstvo *</label><input type="number" min="0.01" step="0.01" value={buyQty} onChange={e => setBuyQty(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Cena/ks bez DPH (€) *</label><input type="number" min="0" step="0.01" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">DPH (%)</label><input type="number" min="0" max="100" value={buyVat} onChange={e => setBuyVat(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Predajná cena/ks bez DPH (€)</label><input type="number" min="0" step="0.01" value={buySellingPrice} onChange={e => setBuySellingPrice(e.target.value)} placeholder="Nastaví predajnú cenu na karte tovaru" className="w-full px-3 py-2 border border-sycom-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-sycom-50"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Č. faktúry / dokladu</label><input type="text" value={buyInvoice} onChange={e => setBuyInvoice(e.target.value)} placeholder="F2024/001" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Dátum nákupu</label><input type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Poznámka</label><input type="text" value={buyNote} onChange={e => setBuyNote(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-xs text-gray-500 font-medium">Spolu bez DPH</p>
                <p className="text-xl font-bold text-gray-900">{fmt(buyTotal)} €</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={() => { setModal(null); resetBuyForm() }} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Zrušiť</button>
              <button onClick={handleBuy} disabled={buySubmitting || !buyItemName.trim() || !buyQty || !buyPrice}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
                <ArrowDownLeft size={15}/> {buySubmitting ? 'Ukladám...' : 'Prijať na sklad'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SELL MODAL ── */}
      {modal === 'sell' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2"><ArrowUpRight size={16} className="text-sycom-500"/><h2 className="text-base font-semibold text-gray-900">Predaj tovaru</h2></div>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X size={16}/></button>
            </div>
            <div className="p-4 space-y-4">
              <Autocomplete label="Tovar" value={sellItemName}
                onChange={v => { setSellItemName(v); setSellItemId(''); setSellSelectedItem(null); setSellPrice('') }}
                onSelect={(id, name, extra) => { const it = extra as StockItem; setSellItemId(id); setSellItemName(name); setSellSelectedItem(it); const sp = it?.sellingPrice ?? 0; const avg = it?.avgPurchasePrice ?? 0; if (sp > 0) setSellPrice(sp.toFixed(2)); setSellMarkup(avg > 0 && sp > 0 ? ((sp - avg) / avg * 100).toFixed(1) : '0') }}
                suggestions={itemSuggestions.filter(i => { const item = items.find(x => x.id === i.id); return (item?.currentStock ?? 0) > 0 })}
                placeholder="Hľadať tovar na sklade..." required
              />
              {sellSelectedItem && (
                <div className="bg-gray-50 rounded-xl px-3 py-2.5 grid grid-cols-3 gap-3 text-xs">
                  <div><p className="text-gray-400 font-semibold">Skladom</p><p className="font-bold text-gray-800">{sellSelectedItem.currentStock} {sellSelectedItem.unit}</p></div>
                  <div><p className="text-gray-400 font-semibold">Avg. nák. cena</p><p className="font-bold text-gray-800">{fmt(sellSelectedItem.avgPurchasePrice)} €</p></div>
                  <div><p className="text-gray-400 font-semibold">Predajná cena</p><p className="font-bold text-sycom-600">{sellSelectedItem.sellingPrice > 0 ? fmt(sellSelectedItem.sellingPrice) + ' €' : '—'}</p></div>
                </div>
              )}

              <Autocomplete label="Zákazník" value={sellClientName}
                onChange={v => { setSellClientName(v); setSellClientId('') }}
                onSelect={(id, name) => { setSellClientId(id); setSellClientName(name) }}
                suggestions={clientSuggestions} placeholder="Hľadať zákazníka..."
              />

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Množstvo *</label><input type="number" min="0.01" step="0.01" value={sellQty} onChange={e => setSellQty(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Prirážka (%)</label><input type="number" min="0" value={sellMarkup} onChange={e => { setSellMarkup(e.target.value); const mu = parseFloat(e.target.value) || 0; const avg = sellSelectedItem?.avgPurchasePrice ?? 0; if (avg > 0) setSellPrice((avg * (1 + mu / 100)).toFixed(2)) }} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Predajná cena/ks bez DPH (€) *</label>
                <input type="number" min="0" step="0.01" value={sellPrice} onChange={e => { setSellPrice(e.target.value); const price = parseFloat(e.target.value) || 0; const avg = sellSelectedItem?.avgPurchasePrice ?? 0; if (avg > 0 && price > 0) setSellMarkup(((price - avg) / avg * 100).toFixed(1)) }} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Č. faktúry / dokladu</label><input type="text" value={sellInvoice} onChange={e => setSellInvoice(e.target.value)} placeholder="F2024/001" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Dátum predaja</label><input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Poznámka</label><input type="text" value={sellNote} onChange={e => setSellNote(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>

              {sellSelectedItem && sellSelectedItem.avgPurchasePrice > 0 && parseFloat(sellPrice) > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 grid grid-cols-2 gap-3 text-xs">
                  <div><p className="text-gray-500 font-semibold">Marža/ks</p><p className="font-bold text-green-700">{fmt(parseFloat(sellPrice) - sellSelectedItem.avgPurchasePrice)} €</p></div>
                  <div><p className="text-gray-500 font-semibold">% marže</p><p className="font-bold text-green-700">{((parseFloat(sellPrice) - sellSelectedItem.avgPurchasePrice) / sellSelectedItem.avgPurchasePrice * 100).toFixed(1)}%</p></div>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-xs text-gray-500 font-medium">Spolu bez DPH</p>
                <p className="text-xl font-bold text-gray-900">{fmt(sellTotal)} €</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Zrušiť</button>
              <button onClick={handleSell} disabled={sellSubmitting || !sellItemId || !sellQty || !sellPrice}
                className="flex items-center gap-2 px-5 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
                <ArrowUpRight size={15}/> {sellSubmitting ? 'Ukladám...' : 'Zapísať predaj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MOVEMENT MODAL ── */}
      {editMovement && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Pencil size={15} className="text-sycom-500"/> Upraviť pohyb</h2>
                <p className="text-xs text-gray-400 mt-0.5">{editMovement.stockItem.name} — <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${MOVEMENT_COLORS[editMovement.type]}`}>{MOVEMENT_LABELS[editMovement.type]}</span></p>
              </div>
              <button onClick={() => setEditMovement(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X size={16}/></button>
            </div>
            <div className="p-4 space-y-4">
              {eStatus && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${eStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {eStatus.type === 'success' ? <Check size={13}/> : <X size={13}/>} {eStatus.msg}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Množstvo *</label><input type="number" min="0.01" step="0.01" value={eQty} onChange={e => setEQty(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Cena/ks bez DPH (€)</label><input type="number" min="0" step="0.01" value={ePrice} onChange={e => setEPrice(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">DPH (%)</label><input type="number" min="0" max="100" value={eVat} onChange={e => setEVat(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Dátum</label><input type="date" value={eDate} onChange={e => setEDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Č. faktúry</label><input type="text" value={eInvoice} onChange={e => setEInvoice(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Poznámka</label><input type="text" value={eNote} onChange={e => setENote(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl flex items-center gap-1.5"><AlertTriangle size={12}/> Zmena množstva automaticky upraví stav skladu.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setEditMovement(null)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Zrušiť</button>
              <button onClick={handleEditSave} disabled={eSubmitting || !eQty || !ePrice}
                className="flex items-center gap-2 px-5 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
                <Check size={15}/> {eSubmitting ? 'Ukladám...' : 'Uložiť zmeny'}
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* ── Nová karta tovaru modal ───────────────────────────────────── */}
      {modal === 'newItem' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Nová karta tovaru</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Názov *</label>
                <input
                  type="text"
                  value={niName}
                  onChange={e => setNiName(e.target.value)}
                  placeholder="Názov položky"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sycom-primary/40"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">SKU / Kód</label>
                  <input
                    type="text"
                    value={niSku}
                    onChange={e => setNiSku(e.target.value)}
                    placeholder="napr. KABEL-CAT6"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sycom-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Kategória</label>
                  <input
                    type="text"
                    value={niCategory}
                    onChange={e => setNiCategory(e.target.value)}
                    placeholder="napr. Káble"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sycom-primary/40"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Jednotka *</label>
                  <input
                    type="text"
                    value={niUnit}
                    onChange={e => setNiUnit(e.target.value)}
                    placeholder="ks / m / kg"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sycom-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Predajná cena (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={niSellingPrice}
                    onChange={e => setNiSellingPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sycom-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">DPH (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={niVat}
                    onChange={e => setNiVat(e.target.value)}
                    placeholder="20"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sycom-primary/40"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Min. zásoba</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={niMinStock}
                  onChange={e => setNiMinStock(e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sycom-primary/40"
                />
              </div>
            </div>
            {niError && <p className="text-red-600 text-xs mt-3">{niError}</p>}
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleNewItem}
                disabled={niSubmitting}
                className="flex-1 bg-sycom-primary text-white text-sm py-2 rounded-lg hover:bg-sycom-primary/90 disabled:opacity-50"
              >
                {niSubmitting ? 'Ukladám...' : 'Vytvoriť kartu'}
              </button>
              <button
                onClick={() => { setModal(null); setNiName(''); setNiSku(''); setNiCategory(''); setNiUnit('ks'); setNiVat('20'); setNiSellingPrice(''); setNiMinStock(''); setNiError('') }}
                className="px-4 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Zrušiť
              </button>
            </div>
          </div>
        </div>
      )}

    </PortalLayout>
  )
}
