'use client'
import { useState, useEffect, useCallback } from 'react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { FileText, RefreshCw, Loader2, ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, Package, X } from 'lucide-react'

interface Invoice {
  id: string; createdAt: string; direction: string | null
  supplierName: string | null; supplierIco: string | null
  customerName: string | null; customerIco: string | null
  invoiceNumber: string | null; variableSymbol: string | null
  totalAmount: number | null; dueDate: string | null
  items: string | null; sourceEmail: string | null; filename: string | null
  recognitionMethod: string | null; error: string | null
  isDuplicate: boolean; duplicateOfId: string | null
  stockStatus: string
}

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtEur(n: number | null) {
  if (n == null) return '—'
  return Number(n).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function StockBadge({ status }: { status: string }) {
  if (status === 'accepted') return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200"><CheckCircle className="w-3 h-3"/>Zaevidované</span>
  if (status === 'rejected') return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200"><XCircle className="w-3 h-3"/>Preskočené</span>
  if (status === 'pending')  return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3 h-3"/>Čaká</span>
  return null
}

function InvoiceDetail({ inv, onClose, onAccept, onReject, actionLoading }: {
  inv: Invoice; onClose: () => void
  onAccept: (id: string) => void; onReject: (id: string) => void
  actionLoading: string | null
}) {
  let items: any[] = []
  try { items = inv.items ? JSON.parse(inv.items) : [] } catch {}
  const isDodavatel = inv.direction === 'dodavatel'
  const isPending   = inv.stockStatus === 'pending'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-12 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`px-6 py-4 rounded-t-2xl flex items-start justify-between ${isDodavatel ? 'bg-red-50 border-b border-red-200' : 'bg-blue-50 border-b border-blue-200'}`}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isDodavatel ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                {isDodavatel ? 'Dodávateľská' : 'Odberateľská'}
              </span>
              {inv.isDuplicate && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 font-semibold">DUPLICITNÁ</span>}
              {inv.recognitionMethod && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">{inv.recognitionMethod}</span>}
              <StockBadge status={inv.stockStatus} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">{inv.supplierName || inv.customerName || '—'}</h2>
            <p className="text-sm text-gray-500">{fmtDt(inv.createdAt)} · {inv.sourceEmail}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5"/></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Základné údaje */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div><span className="text-gray-500">Číslo faktúry:</span> <span className="font-medium ml-1">{inv.invoiceNumber || '—'}</span></div>
            <div><span className="text-gray-500">Variabilný symbol:</span> <span className="font-medium ml-1">{inv.variableSymbol || '—'}</span></div>
            <div><span className="text-gray-500">Celková suma:</span> <span className="font-semibold ml-1 text-gray-900">{fmtEur(inv.totalAmount)}</span></div>
            <div><span className="text-gray-500">Splatnosť:</span> <span className="font-medium ml-1">{inv.dueDate || '—'}</span></div>
            <div><span className="text-gray-500">Dodávateľ:</span> <span className="font-medium ml-1">{inv.supplierName || '—'}{inv.supplierIco ? ` (IČO: ${inv.supplierIco})` : ''}</span></div>
            <div><span className="text-gray-500">Odberateľ:</span> <span className="font-medium ml-1">{inv.customerName || '—'}{inv.customerIco ? ` (IČO: ${inv.customerIco})` : ''}</span></div>
            <div><span className="text-gray-500">Súbor:</span> <span className="font-medium ml-1 text-xs text-gray-600">{inv.filename || '—'}</span></div>
          </div>

          {/* Položky */}
          {items.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Položky faktúry ({items.length})</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>{['Názov','Množstvo','Jednotka','Cena/j','Celkom'].map(h => <th key={h} className="text-left px-3 py-2 font-medium text-gray-600 border-b text-xs">{h}</th>)}</tr>
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

          {/* Chyba */}
          {inv.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{inv.error}</div>
          )}

          {/* Duplicita */}
          {inv.isDuplicate && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Táto faktúra je duplikátom — nebola automaticky evidovaná.
              {inv.duplicateOfId && ` Originál ID: ${inv.duplicateOfId}`}
            </div>
          )}

          {/* Akcie pre dodávateľskú */}
          {isDodavatel && isPending && items.length > 0 && (
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <button
                onClick={() => onAccept(inv.id)}
                disabled={!!actionLoading}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
              >
                {actionLoading === inv.id + '-accept' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Package className="w-4 h-4"/>}
                Zaevidovať tovar do skladu
              </button>
              <button
                onClick={() => onReject(inv.id)}
                disabled={!!actionLoading}
                className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
              >
                {actionLoading === inv.id + '-reject' ? <Loader2 className="w-4 h-4 animate-spin"/> : <XCircle className="w-4 h-4"/>}
                Nezaevidovať
              </button>
            </div>
          )}
          {isDodavatel && isPending && items.length === 0 && (
            <div className="text-sm text-gray-500 italic pt-2 border-t border-gray-100">
              Žiadne položky neboli rozpoznané — nie je čo evidovať do skladu.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Faktury() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/faktury?limit=200${filter !== 'all' ? `&filter=${filter}` : ''}`)
      .then(r => r.json()).then(d => { setInvoices(d); setLoading(false) })
  }, [filter])

  useEffect(() => { load() }, [load])

  const handleAccept = async (id: string) => {
    setActionLoading(id + '-accept')
    try {
      const r = await fetch(`/api/faktury/${id}/accept`, { method: 'POST' }).then(r => r.json())
      if (r.ok) {
        setInvoices(p => p.map(i => i.id === id ? { ...i, stockStatus: 'accepted' } : i))
        if (selected?.id === id) setSelected(p => p ? { ...p, stockStatus: 'accepted' } : p)
      }
    } finally { setActionLoading(null) }
  }

  const handleReject = async (id: string) => {
    setActionLoading(id + '-reject')
    try {
      const r = await fetch(`/api/faktury/${id}/reject`, { method: 'POST' }).then(r => r.json())
      if (r.ok) {
        setInvoices(p => p.map(i => i.id === id ? { ...i, stockStatus: 'rejected' } : i))
        if (selected?.id === id) setSelected(p => p ? { ...p, stockStatus: 'rejected' } : p)
      }
    } finally { setActionLoading(null) }
  }

  const pendingCount = invoices.filter(i => i.stockStatus === 'pending').length

  return (
    <PortalLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Faktúry</h1>
            {pendingCount > 0 && (
              <span className="bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                {pendingCount} čaká na evidenciu
              </span>
            )}
          </div>
          <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 border rounded-lg">
            <RefreshCw className="w-3.5 h-3.5"/> Obnoviť
          </button>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {[
            { key: 'all',       label: 'Všetky' },
            { key: 'pending',   label: 'Čakajúce' },
            { key: 'dodavatel', label: 'Dodávateľské' },
            { key: 'odberatel', label: 'Odberateľské' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {loading
          ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400"/></div>
          : invoices.length === 0
            ? <div className="text-center py-16 text-gray-400"><FileText className="w-10 h-10 mx-auto mb-3 opacity-30"/><p>Žiadne faktúry</p></div>
            : (
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Dátum</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Smer</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Dodávateľ / Odberateľ</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Číslo</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Suma</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Stav</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoices.map(inv => {
                      const isDodavatel = inv.direction === 'dodavatel'
                      const isPending   = inv.stockStatus === 'pending'
                      return (
                        <tr
                          key={inv.id}
                          onClick={() => setSelected(inv)}
                          className={`cursor-pointer transition-colors ${
                            isDodavatel && isPending
                              ? 'bg-red-50/60 hover:bg-red-50'
                              : 'hover:bg-gray-50/80'
                          }`}
                        >
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDt(inv.createdAt)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDodavatel ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                              {isDodavatel ? 'Dodáv.' : 'Odb.'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 truncate max-w-[220px]">{inv.supplierName || inv.customerName || '—'}</div>
                            {(inv.supplierIco || inv.customerIco) && (
                              <div className="text-xs text-gray-400">IČO: {inv.supplierIco || inv.customerIco}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{inv.invoiceNumber || '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtEur(inv.totalAmount)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {inv.isDuplicate && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">dup</span>}
                              {inv.error && <XCircle className="w-3.5 h-3.5 text-red-400"/>}
                              <StockBadge status={inv.stockStatus}/>
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
      </div>

      {/* Detail modal */}
      {selected && (
        <InvoiceDetail
          inv={selected}
          onClose={() => setSelected(null)}
          onAccept={handleAccept}
          onReject={handleReject}
          actionLoading={actionLoading}
        />
      )}
    </PortalLayout>
  )
}
