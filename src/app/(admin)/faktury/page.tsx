'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PortalLayout } from '@/components/layout/PortalLayout'
import {
  FileText, RefreshCw, Loader2, CheckCircle, XCircle,
  Clock, Package, X, Pencil, Save, ExternalLink, Trash2,
  Search, Filter, ChevronLeft, ChevronRight, Plus, Trash,
} from 'lucide-react'

interface Invoice {
  id: string; createdAt: string; direction: string | null
  supplierName: string | null; supplierIco: string | null
  customerName: string | null; customerIco: string | null
  invoiceNumber: string | null; variableSymbol: string | null
  totalAmount: number | null; dueDate: string | null
  items: string | null; sourceEmail: string | null
  filename: string | null; filePath: string | null
  extractedText: string | null
  recognitionMethod: string | null; error: string | null
  isDuplicate: boolean; duplicateOfId: string | null; stockStatus: string
  isPaid: boolean; paidAt: string | null
  issueDate: string | null
}

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtEur(n: number | null) {
  if (n == null) return '—'
  return Number(n).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function StockBadge({ status }: { status: string }) {
  if (status === 'accepted') return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200"><CheckCircle className="w-3 h-3" />Zaevidované</span>
  if (status === 'rejected') return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200"><XCircle className="w-3 h-3" />Preskočené</span>
  if (status === 'pending')  return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3 h-3" />Čaká</span>
  return null
}

// ── Edit form ──────────────────────────────────────────────────────────────────
function EditForm({ inv, onSave, onCancel }: {
  inv: Invoice; onSave: (u: Partial<Invoice>) => void; onCancel: () => void
}) {
  const [form, setForm] = useState({
    direction:      inv.direction      || 'dodavatel',
    supplierName:   inv.supplierName   || '',
    supplierIco:    inv.supplierIco    || '',
    customerName:   inv.customerName   || '',
    customerIco:    inv.customerIco    || '',
    invoiceNumber:  inv.invoiceNumber  || '',
    variableSymbol: inv.variableSymbol || '',
    totalAmount:    inv.totalAmount != null ? String(inv.totalAmount) : '',
    dueDate:        inv.dueDate        || '',
    stockStatus:    inv.stockStatus    || 'na',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true); setSaveError(null)
    try {
      const res = await fetch(`/api/faktury/${inv.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, totalAmount: form.totalAmount ? Number(form.totalAmount) : null }),
      })
      const r = await res.json()
      if (!res.ok || r.error) { setSaveError(r.error || 'Chyba pri ukladaní'); return }
      onSave(r)
    } catch (e: any) { setSaveError(e.message) }
    finally { setSaving(false) }
  }

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sycom-300'
  const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1'

  return (
    <div className="space-y-4 pt-3">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={lbl}>Smer</label>
          <select value={form.direction} onChange={set('direction')} className={inp}>
            <option value="dodavatel">Dodávateľská (niekto fakturuje nám)</option>
            <option value="odberatel">Odberateľská (my fakturujeme)</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Číslo faktúry</label>
          <input className={inp} value={form.invoiceNumber} onChange={set('invoiceNumber')} />
        </div>
        <div>
          <label className={lbl}>Variabilný symbol</label>
          <input className={inp} value={form.variableSymbol} onChange={set('variableSymbol')} />
        </div>
        <div>
          <label className={lbl}>Celková suma (€)</label>
          <input type="number" step="0.01" className={inp} value={form.totalAmount} onChange={set('totalAmount')} />
        </div>
        <div>
          <label className={lbl}>Splatnosť</label>
          <input className={inp} value={form.dueDate} onChange={set('dueDate')} placeholder="DD.MM.YYYY" />
        </div>
        <div>
          <label className={lbl}>Dodávateľ — názov</label>
          <input className={inp} value={form.supplierName} onChange={set('supplierName')} />
        </div>
        <div>
          <label className={lbl}>Dodávateľ — IČO</label>
          <input className={inp} value={form.supplierIco} onChange={set('supplierIco')} />
        </div>
        <div>
          <label className={lbl}>Odberateľ — názov</label>
          <input className={inp} value={form.customerName} onChange={set('customerName')} />
        </div>
        <div>
          <label className={lbl}>Odberateľ — IČO</label>
          <input className={inp} value={form.customerIco} onChange={set('customerIco')} />
        </div>
        <div className="col-span-2">
          <label className={lbl}>Stav skladu</label>
          <select value={form.stockStatus} onChange={set('stockStatus')} className={inp}>
            <option value="na">N/A — nevzťahuje sa</option>
            <option value="pending">Čaká na rozhodnutie</option>
            <option value="accepted">Zaevidované do skladu</option>
            <option value="rejected">Preskočené</option>
          </select>
        </div>
      </div>
      {saveError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</div>}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-sycom-500 hover:bg-sycom-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Uložiť zmeny
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
          <X className="w-4 h-4" /> Zrušiť
        </button>
      </div>
    </div>
  )
}

// ── Invoice detail modal ───────────────────────────────────────────────────────
function InvoiceDetail({ inv: initialInv, onClose, onAccept, onReject, onPay, actionLoading, onUpdate, onDelete }: {
  inv: Invoice; onClose: () => void
  onAccept: (id: string) => void; onReject: (id: string) => void; onPay: (id: string, isPaid: boolean) => void
  actionLoading: string | null
  onUpdate: (u: Invoice) => void
  onDelete: (id: string) => void
}) {
  const [inv, setInv]                     = useState(initialInv)
  const [editing, setEditing]             = useState(false)
  useEffect(() => { setInv(initialInv) }, [initialInv.isPaid, initialInv.paidAt])
  const [reprocessing, setReprocessing]   = useState(false)
  const [reprocessError, setRepError]     = useState<string | null>(null)
  const [showText, setShowText]           = useState(false)

  const handleSaved = (updated: Partial<Invoice>) => {
    const merged = { ...inv, ...updated } as Invoice
    setInv(merged); onUpdate(merged); setEditing(false)
  }

  const handleReprocess = async () => {
    setReprocessing(true); setRepError(null)
    try {
      const r = await fetch(`/api/faktury/${inv.id}/reprocess`, { method: 'POST' }).then(r => r.json())
      if (r.error) { setRepError(r.error); return }
      const merged = { ...inv, ...r.updated } as Invoice
      setInv(merged); onUpdate(merged)
    } catch (e: any) { setRepError(e.message) }
    finally { setReprocessing(false) }
  }

  let items: any[] = []
  try { items = inv.items ? JSON.parse(inv.items) : [] } catch { /**/ }
  const isDodavatel = inv.direction === 'dodavatel'
  const isPending   = inv.stockStatus === 'pending'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-10 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className={`px-6 py-4 rounded-t-2xl flex items-start justify-between ${isDodavatel ? 'bg-red-50 border-b border-red-200' : 'bg-blue-50 border-b border-blue-200'}`}>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isDodavatel ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                {isDodavatel ? 'Dodávateľská' : 'Odberateľská'}
              </span>
              {inv.isDuplicate && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 font-semibold">DUPLICITNÁ</span>}
              {inv.recognitionMethod && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">{inv.recognitionMethod}</span>}
              <StockBadge status={inv.stockStatus} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              {isDodavatel ? (inv.supplierName || '—') : (inv.customerName || '—')}
            </h2>
            <p className="text-sm text-gray-500">{fmtDt(inv.createdAt)} · {inv.sourceEmail}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {!editing && (
              <>
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                  <Pencil className="w-3.5 h-3.5" /> Upraviť
                </button>
                <button onClick={() => { if (confirm('Naozaj vymazať túto faktúru?')) onDelete(inv.id) }}
                  className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" /> Vymazať
                </button>
                {inv.direction === 'odberatel' && (
                  <button onClick={() => onPay(inv.id, !inv.isPaid)} disabled={actionLoading === inv.id + '-pay'}
                    className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium ${inv.isPaid ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                    <CheckCircle className="w-3.5 h-3.5" />
                    {actionLoading === inv.id + '-pay' ? '…' : inv.isPaid ? `Uhradené ${inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('sk-SK') : ''}` : 'Označiť ako uhradené'}
                  </button>
                )}
                {inv.filePath && (
                  <button onClick={handleReprocess} disabled={reprocessing}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 disabled:opacity-60">
                    {reprocessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Znovu spracovať
                  </button>
                )}
              </>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-5">
          {editing ? (
            <EditForm inv={inv} onSave={handleSaved} onCancel={() => setEditing(false)} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div><span className="text-gray-500">Dátum vydania:</span> <span className="font-medium ml-1">{inv.issueDate || '—'}</span></div>
                <div><span className="text-gray-500">Číslo faktúry:</span> <span className="font-medium ml-1">{inv.invoiceNumber || '—'}</span></div>
                <div><span className="text-gray-500">Variabilný symbol:</span> <span className="font-medium ml-1">{inv.variableSymbol || '—'}</span></div>
                <div><span className="text-gray-500">Celková suma:</span> <span className="font-semibold ml-1 text-gray-900">{fmtEur(inv.totalAmount)}</span></div>
                <div><span className="text-gray-500">Splatnosť:</span> <span className="font-medium ml-1">{inv.dueDate || '—'}</span></div>
                <div><span className="text-gray-500">Dodávateľ:</span> <span className="font-medium ml-1">{inv.supplierName || '—'}{inv.supplierIco ? ` (IČO: ${inv.supplierIco})` : ''}</span></div>
                <div><span className="text-gray-500">Odberateľ:</span> <span className="font-medium ml-1">{inv.customerName || '—'}{inv.customerIco ? ` (IČO: ${inv.customerIco})` : ''}</span></div>
                <div>
                  <span className="text-gray-500">Súbor:</span>{' '}
                  {inv.filePath
                    ? <a href={inv.filePath} target="_blank" rel="noopener noreferrer" className="font-medium ml-1 text-sycom-600 hover:text-sycom-700 inline-flex items-center gap-1">
                        {inv.filename || inv.filePath.split('/').pop()}<ExternalLink className="w-3 h-3" />
                      </a>
                    : <span className="font-medium ml-1 text-xs text-gray-400">{inv.filename || '—'}</span>
                  }
                </div>
              </div>
              {reprocessError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{reprocessError}</div>
              )}
              {(inv.extractedText !== null || inv.filePath) && (
                <div>
                  <button onClick={() => setShowText(v => !v)} className="text-xs text-gray-400 hover:text-gray-600 underline">
                    {showText ? 'Skryť' : 'Zobraziť'} extrahovaný text z PDF
                  </button>
                  {showText && (
                    <pre className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap max-h-48">
                      {inv.extractedText || '(text ešte nebol extrahovaný — klikni Znovu spracovať)'}
                    </pre>
                  )}
                </div>
              )}
              {items.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Položky faktúry ({items.length})</h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Názov','Množstvo','Jednotka','Cena/j','Celkom'].map(h => (
                            <th key={h} className="text-left px-3 py-2 font-medium text-gray-600 border-b text-xs">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map((it: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="px-3 py-2 text-sm">{it.name || '—'}</td>
                            <td className="px-3 py-2 text-sm">{it.qty ?? '—'}</td>
                            <td className="px-3 py-2 text-sm text-gray-500">{it.unit || '—'}</td>
                            <td className="px-3 py-2 text-sm">{it.unit_price != null ? `${it.unit_price} €` : '—'}</td>
                            <td className="px-3 py-2 text-sm font-medium">{it.total != null ? `${it.total} €` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {inv.error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{inv.error}</div>}
              {inv.isDuplicate && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  Duplicitná faktúra — nebola automaticky evidovaná.{inv.duplicateOfId && ` Originál ID: ${inv.duplicateOfId}`}
                </div>
              )}
              {isDodavatel && isPending && (
                <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  {items.length > 0 ? (
                    <>
                      <button onClick={() => onAccept(inv.id)} disabled={!!actionLoading}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
                        {actionLoading === inv.id + '-accept' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                        Zaevidovať tovar do skladu
                      </button>
                      <button onClick={() => onReject(inv.id)} disabled={!!actionLoading}
                        className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 hover:bg-gray-50">
                        {actionLoading === inv.id + '-reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Nezaevidovať
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-gray-500 italic">Žiadne položky — nie je čo evidovať.</p>
                      <button onClick={() => onReject(inv.id)} disabled={!!actionLoading}
                        className="flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-60 hover:bg-gray-50">
                        {actionLoading === inv.id + '-reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Uzavrieť
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [20, 40, 60, 100, 200, -1] as const


// ── Items edit modal ───────────────────────────────────────────────────────────
function ItemsEditModal({ inv, onConfirm, onCancel, loading }: {
  inv: Invoice
  onConfirm: (items: any[]) => void
  onCancel: () => void
  loading: boolean
}) {
  const parseItems = () => {
    try { return inv.items ? JSON.parse(inv.items) : [] } catch { return [] }
  }
  const [items, setItems] = useState<any[]>(() => parseItems().map((it: any, i: number) => ({ ...it, _key: i })))

  const update = (idx: number, field: string, val: string) =>
    setItems(p => p.map((it, i) => i === idx ? { ...it, [field]: field === 'qty' || field === 'unit_price' || field === 'total' ? (val === '' ? '' : parseFloat(val)) : val } : it))

  const remove = (idx: number) => setItems(p => p.filter((_, i) => i !== idx))

  const addRow = () => setItems(p => [...p, { name: '', qty: 1, unit: 'ks', unit_price: 0, total: 0, _key: Date.now() }])

  const autoTotal = (idx: number) => {
    const it = items[idx]
    const t = (parseFloat(it.qty) || 0) * (parseFloat(it.unit_price) || 0)
    update(idx, 'total', t.toFixed(2))
  }

  const th = 'text-left pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide'
  const inp = 'w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sycom-300'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Upraviť položky pred importom do skladu</h2>
            <p className="text-xs text-gray-400 mt-0.5">{inv.supplierName} · {inv.invoiceNumber}</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-auto flex-1 px-6 py-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className={`${th} w-[40%]`}>Názov tovaru</th>
                <th className={`${th} w-16 text-right`}>Množstvo</th>
                <th className={`${th} w-16`}>Jednotka</th>
                <th className={`${th} w-24 text-right`}>Cena/ks €</th>
                <th className={`${th} w-24 text-right`}>Celkom €</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((it, idx) => (
                <tr key={it._key ?? idx} className="group">
                  <td className="py-1.5 pr-2">
                    <input value={it.name || ''} onChange={e => update(idx, 'name', e.target.value)} className={inp} placeholder="Názov" />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input type="number" min="0" step="0.01" value={it.qty ?? ''} onChange={e => { update(idx, 'qty', e.target.value) }} onBlur={() => autoTotal(idx)} className={`${inp} text-right`} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input value={it.unit || 'ks'} onChange={e => update(idx, 'unit', e.target.value)} className={`${inp} w-14`} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input type="number" min="0" step="0.01" value={it.unit_price ?? ''} onChange={e => update(idx, 'unit_price', e.target.value)} onBlur={() => autoTotal(idx)} className={`${inp} text-right`} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input type="number" min="0" step="0.01" value={it.total ?? ''} onChange={e => update(idx, 'total', e.target.value)} className={`${inp} text-right`} />
                  </td>
                  <td className="py-1.5">
                    <button onClick={() => remove(idx)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1">
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addRow} className="mt-3 flex items-center gap-1.5 text-xs text-sycom-600 hover:text-sycom-700 font-medium">
            <Plus className="w-3.5 h-3.5" /> Pridať položku
          </button>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {items.filter(i => i.name?.trim()).length} položiek · Celkom:{' '}
            <span className="font-semibold text-gray-900">
              {items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0).toLocaleString('sk-SK', { minimumFractionDigits: 2 })} €
            </span>
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              Zrušiť
            </button>
            <button onClick={() => onConfirm(items.filter(i => i.name?.trim()))} disabled={loading}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              Importovať do skladu
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── New invoice modal ──────────────────────────────────────────────────────────
function NewInvoiceModal({ onSave, onCancel }: { onSave: (inv: Invoice) => void; onCancel: () => void }) {
  const EMPTY_FORM = {
    direction: 'dodavatel', supplierName: '', supplierIco: '',
    customerName: '', customerIco: '', invoiceNumber: '', variableSymbol: '',
    totalAmount: '', issueDate: '', dueDate: '', stockStatus: 'pending',
  }
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSave = async () => {
    setSaving(true); setErr(null)
    try {
      const res = await fetch('/api/faktury', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, totalAmount: form.totalAmount ? Number(form.totalAmount) : null }),
      })
      const r = await res.json()
      if (!res.ok || r.error) { setErr(r.error || 'Chyba'); return }
      onSave(r)
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sycom-300'
  const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Pridať faktúru manuálne</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={lbl}>Smer</label>
            <select value={form.direction} onChange={set('direction')} className={inp}>
              <option value="dodavatel">Dodávateľská (niekto fakturuje nám)</option>
              <option value="odberatel">Odberateľská (my fakturujeme)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Číslo faktúry</label><input className={inp} value={form.invoiceNumber} onChange={set('invoiceNumber')} /></div>
            <div><label className={lbl}>Variabilný symbol</label><input className={inp} value={form.variableSymbol} onChange={set('variableSymbol')} placeholder="(ak prázdne = číslo faktúry)" /></div>
            <div><label className={lbl}>Celková suma (€)</label><input type="number" step="0.01" className={inp} value={form.totalAmount} onChange={set('totalAmount')} /></div>
            <div><label className={lbl}>Dátum vydania</label><input className={inp} value={form.issueDate} onChange={set('issueDate')} placeholder="DD.MM.YYYY" /></div>
            <div><label className={lbl}>Dátum splatnosti</label><input className={inp} value={form.dueDate} onChange={set('dueDate')} placeholder="DD.MM.YYYY" /></div>
            <div><label className={lbl}>Stav skladu</label>
              <select value={form.stockStatus} onChange={set('stockStatus')} className={inp}>
                <option value="pending">Čaká na rozhodnutie</option>
                <option value="na">N/A</option>
                <option value="accepted">Zaevidované</option>
                <option value="rejected">Preskočené</option>
              </select>
            </div>
            <div><label className={lbl}>Dodávateľ — názov</label><input className={inp} value={form.supplierName} onChange={set('supplierName')} /></div>
            <div><label className={lbl}>Dodávateľ — IČO</label><input className={inp} value={form.supplierIco} onChange={set('supplierIco')} /></div>
            <div><label className={lbl}>Odberateľ — názov</label><input className={inp} value={form.customerName} onChange={set('customerName')} /></div>
            <div><label className={lbl}>Odberateľ — IČO</label><input className={inp} value={form.customerIco} onChange={set('customerIco')} /></div>
          </div>
          {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onCancel} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Zrušiť</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-sycom-500 hover:bg-sycom-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Uložiť faktúru
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Faktury() {
  const [allInvoices, setAllInvoices]   = useState<Invoice[]>([])
  const [loading, setLoading]           = useState(true)
  const [tabFilter, setTabFilter]       = useState('all')
  const [search, setSearch]             = useState('')
  const [entityFilter, setEntityFilter] = useState<{ type: 'supplier' | 'customer'; name: string } | null>(null)
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [pageSize, setPageSize]         = useState<number>(40)
  const [page, setPage]                 = useState(1)
  const [selected, setSelected]         = useState<Invoice | null>(null)
  const [showNewModal, setShowNewModal]   = useState(false)
  const [itemsEditInv, setItemsEditInv]   = useState<Invoice | null>(null)
  const [itemsLoading, setItemsLoading]   = useState(false)
  const [actionLoading, setActionLoad]  = useState<string | null>(null)
  const [bulkLoading, setBulkLoading]   = useState(false)

  const router = useRouter()

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    fetch('/api/faktury?limit=all', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setAllInvoices(d); if (!silent) setLoading(false) })
      .catch(() => { if (!silent) setLoading(false) })
  }, [])

  // Invalidate Next.js router cache after any data change so other pages see fresh data
  const invalidateCache = useCallback(() => { router.refresh() }, [router])

  useEffect(() => { load() }, [])
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  // ── Filtered list (client-side) ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = allInvoices
    if (tabFilter === 'pending')   list = list.filter(i => i.stockStatus === 'pending')
    if (tabFilter === 'dodavatel') list = list.filter(i => i.direction === 'dodavatel')
    if (tabFilter === 'odberatel') list = list.filter(i => i.direction === 'odberatel')

    if (entityFilter) {
      if (entityFilter.type === 'supplier')
        list = list.filter(i => i.supplierName === entityFilter.name)
      else
        list = list.filter(i => i.customerName === entityFilter.name)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(i =>
        [i.supplierName, i.customerName, i.invoiceNumber, i.variableSymbol, i.supplierIco, i.customerIco, i.sourceEmail]
          .some(v => v?.toLowerCase().includes(q))
      )
    }
    return list
  }, [allInvoices, tabFilter, entityFilter, search])

  // reset page when filters change
  useEffect(() => { setPage(1); setSelectedIds(new Set()) }, [tabFilter, search, entityFilter, pageSize])

  const totalPages = pageSize === -1 ? 1 : Math.ceil(filtered.length / pageSize)
  const paged = pageSize === -1 ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

  const pendingCount = allInvoices.filter(i => i.stockStatus === 'pending').length

  // ── Checkbox helpers ─────────────────────────────────────────────────────────
  const allPageSelected = paged.length > 0 && paged.every(i => selectedIds.has(i.id))
  const someSelected    = selectedIds.size > 0

  const toggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  const toggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(prev => { const n = new Set(prev); paged.forEach(i => n.add(i.id)); return n })
    else                  setSelectedIds(prev => { const n = new Set(prev); paged.forEach(i => n.delete(i.id)); return n })
  }

  // ── Bulk operations ──────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (!confirm(`Naozaj vymazať ${selectedIds.size} faktúr?`)) return
    setBulkLoading(true)
    await Promise.all(Array.from(selectedIds).map(id => fetch(`/api/faktury/${id}`, { method: 'DELETE' })))
    setAllInvoices(p => p.filter(i => !selectedIds.has(i.id)))
    setSelectedIds(new Set())
    setBulkLoading(false)
  }

  const handleBulkStatus = async (status: string) => {
    setBulkLoading(true)
    await Promise.all(Array.from(selectedIds).map(id =>
      fetch(`/api/faktury/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockStatus: status }),
      })
    ))
    setAllInvoices(p => p.map(i => selectedIds.has(i.id) ? { ...i, stockStatus: status } : i))
    setSelectedIds(new Set())
    setBulkLoading(false)
  }

  // ── Single record operations ─────────────────────────────────────────────────
  const handleUpdate = (updated: Invoice) => {
    setAllInvoices(p => p.map(i => i.id === updated.id ? updated : i))
    load(true) // silent refresh to ensure DB-accurate data
    invalidateCache()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/faktury/${id}`, { method: 'DELETE' })
    setAllInvoices(p => p.filter(i => i.id !== id))
    setSelected(null)
  }

  const handleAccept = async (id: string) => {
    // Find the invoice and open items edit modal first
    const inv = allInvoices.find(i => i.id === id)
    if (inv) { setItemsEditInv(inv); return }
    // Fallback: direct accept if not found
    await doAccept(id, undefined)
  }

  const doAccept = async (id: string, items: any[] | undefined) => {
    setActionLoad(id + '-accept')
    try {
      const body = items !== undefined ? { items } : {}
      const r = await fetch(`/api/faktury/${id}/accept`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json())
      if (r.ok) {
        const upd = (p: Invoice) => p.id === id ? { ...p, stockStatus: 'accepted', items: items ? JSON.stringify(items) : p.items } : p
        setAllInvoices(p => p.map(upd))
        setSelected(p => p ? upd(p) : p)
        load(true)
      }
    } finally { setActionLoad(null); setItemsEditInv(null) }
  }

  const handleItemsConfirm = async (items: any[]) => {
    if (!itemsEditInv) return
    setItemsLoading(true)
    await doAccept(itemsEditInv.id, items)
    setItemsLoading(false)
  }

  const handleReject = async (id: string) => {
    setActionLoad(id + '-reject')
    try {
      const r = await fetch(`/api/faktury/${id}/reject`, { method: 'POST' }).then(r => r.json())
      if (r.ok) {
        const upd = (p: Invoice) => p.id === id ? { ...p, stockStatus: 'rejected' } : p
        setAllInvoices(p => p.map(upd))
        setSelected(p => p ? upd(p) : p)
        load(true)
      }
    } finally { setActionLoad(null) }
  }

  const handlePay = async (id: string, isPaid: boolean) => {
    setActionLoad(id + '-pay')
    try {
      const r = await fetch(`/api/faktury/${id}/pay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaid }),
      }).then(r => r.json())
      if (r.ok) {
        const upd = (p: Invoice) => p.id === id ? { ...p, isPaid: r.isPaid, paidAt: r.paidAt } : p
        setAllInvoices(p => p.map(upd))
        setSelected(p => p ? upd(p) : p)
        load(true)
      }
    } finally { setActionLoad(null) }
  }

  const setEntityFilterAndReset = (type: 'supplier' | 'customer', name: string | null) => {
    if (!name) return
    setEntityFilter(prev =>
      prev?.type === type && prev.name === name ? null : { type, name }
    )
  }

  return (
    <PortalLayout>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Faktúry</h1>
            {pendingCount > 0 && (
              <span className="bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                {pendingCount} čaká
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNewModal(true)} className="flex items-center gap-1.5 text-sm text-white bg-sycom-500 hover:bg-sycom-600 px-3 py-1.5 rounded-lg">
              <Plus className="w-3.5 h-3.5" /> Pridať faktúru
            </button>
            <button onClick={() => load()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 border rounded-lg">
              <RefreshCw className="w-3.5 h-3.5" /> Obnoviť
            </button>
          </div>
        </div>

        {/* Tab filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { key: 'all',       label: 'Všetky' },
            { key: 'pending',   label: 'Čakajúce' },
            { key: 'dodavatel', label: 'Dodávateľské' },
            { key: 'odberatel', label: 'Odberateľské' },
          ].map(f => (
            <button key={f.key} onClick={() => setTabFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tabFilter === f.key ? 'bg-sycom-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Search + active entity filter */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Hľadať dodávateľa, odberateľa, číslo faktúry…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sycom-300"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {entityFilter && (
            <div className="flex items-center gap-1.5 bg-sycom-50 border border-sycom-200 text-sycom-700 text-sm px-3 py-1.5 rounded-lg">
              <Filter className="w-3.5 h-3.5" />
              <span>{entityFilter.type === 'supplier' ? 'Dodávateľ' : 'Odberateľ'}: <strong>{entityFilter.name}</strong></span>
              <button onClick={() => setEntityFilter(null)} className="ml-1 text-sycom-500 hover:text-sycom-700"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
          <span className="text-sm text-gray-400 ml-auto">
            {filtered.length} {filtered.length === allInvoices.length ? '' : `z ${allInvoices.length} `}záznamov
          </span>
        </div>

        {/* Bulk action bar */}
        {someSelected && (
          <div className="flex items-center gap-3 mb-3 bg-sycom-50 border border-sycom-200 rounded-lg px-4 py-2.5">
            <span className="text-sm font-medium text-sycom-700">{selectedIds.size} vybraných</span>
            <div className="flex items-center gap-2 ml-2">
              <button onClick={() => handleBulkStatus('accepted')} disabled={bulkLoading}
                className="text-xs px-2.5 py-1 rounded-md bg-green-100 text-green-700 hover:bg-green-200 font-medium disabled:opacity-60">
                Zaevidovať
              </button>
              <button onClick={() => handleBulkStatus('rejected')} disabled={bulkLoading}
                className="text-xs px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium disabled:opacity-60">
                Preskočiť
              </button>
              <button onClick={() => handleBulkStatus('pending')} disabled={bulkLoading}
                className="text-xs px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 font-medium disabled:opacity-60">
                Čaká
              </button>
              <button onClick={handleBulkDelete} disabled={bulkLoading}
                className="text-xs px-2.5 py-1 rounded-md bg-red-100 text-red-600 hover:bg-red-200 font-medium disabled:opacity-60">
                {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Vymazať'}
              </button>
            </div>
            <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-gray-400 hover:text-gray-600 text-xs">
              Zrušiť výber
            </button>
          </div>
        )}

        {/* Table */}
        {loading
          ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          : filtered.length === 0
            ? <div className="text-center py-16 text-gray-400"><FileText className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>Žiadne faktúry</p></div>
            : (
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-3 w-10">
                        <input type="checkbox" checked={allPageSelected} onChange={toggleAll}
                          className="rounded border-gray-300 text-sycom-500 focus:ring-sycom-300" />
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Dátum vydania</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Smer</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Dodávateľ</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Odberateľ</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Číslo</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Suma</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Uhradené</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Stav</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paged.map(inv => {
                      const isDodavatel = inv.direction === 'dodavatel'
                      const isPending   = inv.stockStatus === 'pending'
                      const isSelected  = selectedIds.has(inv.id)
                      return (
                        <tr key={inv.id} onClick={() => setSelected(inv)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-sycom-50' : isDodavatel && isPending ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-gray-50/80'}`}>
                          <td className="px-3 py-3" onClick={e => toggleRow(inv.id, e)}>
                            <input type="checkbox" checked={isSelected} onChange={() => {}}
                              className="rounded border-gray-300 text-sycom-500 focus:ring-sycom-300 pointer-events-none" />
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{inv.issueDate || fmtDt(inv.createdAt)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDodavatel ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                              {isDodavatel ? 'Dodáv.' : 'Odb.'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {inv.supplierName ? (
                              <button
                                onClick={e => { e.stopPropagation(); setEntityFilterAndReset('supplier', inv.supplierName) }}
                                className={`text-left font-medium truncate max-w-[180px] block hover:text-sycom-600 hover:underline transition-colors ${entityFilter?.type === 'supplier' && entityFilter.name === inv.supplierName ? 'text-sycom-600' : 'text-gray-900'}`}
                                title={`Filtrovať: ${inv.supplierName}`}>
                                {inv.supplierName}
                              </button>
                            ) : <span className="text-gray-400">—</span>}
                            {inv.supplierIco && <div className="text-xs text-gray-400">IČO: {inv.supplierIco}</div>}
                          </td>
                          <td className="px-4 py-3">
                            {inv.customerName ? (
                              <button
                                onClick={e => { e.stopPropagation(); setEntityFilterAndReset('customer', inv.customerName) }}
                                className={`text-left font-medium truncate max-w-[180px] block hover:text-sycom-600 hover:underline transition-colors ${entityFilter?.type === 'customer' && entityFilter.name === inv.customerName ? 'text-sycom-600' : 'text-gray-900'}`}
                                title={`Filtrovať: ${inv.customerName}`}>
                                {inv.customerName}
                              </button>
                            ) : <span className="text-gray-400">—</span>}
                            {inv.customerIco && <div className="text-xs text-gray-400">IČO: {inv.customerIco}</div>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{inv.invoiceNumber || '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtEur(inv.totalAmount)}</td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            {inv.direction === 'odberatel' && (
                              <button
                                onClick={() => handlePay(inv.id, !inv.isPaid)}
                                disabled={actionLoading === inv.id + '-pay'}
                                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${inv.isPaid ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                {actionLoading === inv.id + '-pay' ? '…' : inv.isPaid ? 'Uhradené' : 'Neuhradené'}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {inv.isDuplicate && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">dup</span>}
                              {inv.error && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                              <StockBadge status={inv.stockStatus} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
        }

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Zobraziť:</span>
              {PAGE_SIZE_OPTIONS.map(size => (
                <button key={size} onClick={() => setPageSize(size)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${pageSize === size ? 'bg-sycom-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {size === -1 ? 'Všetky' : size}
                </button>
              ))}
            </div>
            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = totalPages <= 7 ? i + 1
                    : page <= 4 ? i + 1
                    : page >= totalPages - 3 ? totalPages - 6 + i
                    : page - 3 + i
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === p ? 'bg-sycom-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                      {p}
                    </button>
                  )
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            {pageSize !== -1 && (
              <span className="text-xs text-gray-400">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} z {filtered.length}
              </span>
            )}
          </div>
        )}
      </div>

      {showNewModal && (
        <NewInvoiceModal
          onSave={(inv) => { setAllInvoices(p => [inv, ...p]); setShowNewModal(false); load(true) }}
          onCancel={() => setShowNewModal(false)}
        />
      )}

      {itemsEditInv && (
        <ItemsEditModal
          inv={itemsEditInv}
          onConfirm={handleItemsConfirm}
          onCancel={() => setItemsEditInv(null)}
          loading={itemsLoading}
        />
      )}

      {selected && (
        <InvoiceDetail
          inv={selected}
          onClose={() => setSelected(null)}
          onAccept={handleAccept}
          onReject={handleReject}
          onPay={handlePay}
          actionLoading={actionLoading}
          onUpdate={(u) => { handleUpdate(u); setSelected(u) }}
          onDelete={handleDelete}
        />
      )}
    </PortalLayout>
  )
}
