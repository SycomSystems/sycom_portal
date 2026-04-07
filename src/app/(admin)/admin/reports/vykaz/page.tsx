'use client'
import { useState, useMemo, useRef } from 'react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { useQuery } from '@tanstack/react-query'
import { Clock, Package, Euro, FileText, ExternalLink, ChevronDown, ChevronUp, Printer, Download } from 'lucide-react'

function fmt(n: number) { return n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('sk-SK') }

const HOURS_COLORS: Record<string, string> = {
  Standard: 'bg-blue-100 text-blue-700',
  'Standard mimo prac. casu': 'bg-indigo-100 text-indigo-700',
  Server: 'bg-purple-100 text-purple-700',
  'Server mimo prac. casu': 'bg-orange-100 text-orange-700',
}

export default function VykazPage() {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)

  const [from, setFrom] = useState(firstDay)
  const [to, setTo] = useState(today)
  const [clientId, setClientId] = useState('')
  const [sortCol, setSortCol] = useState('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [pdfLoading, setPdfLoading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => fetch('/api/clients').then(r => r.json()),
  })

  const params = new URLSearchParams({ from, to })
  if (clientId) params.set('clientId', clientId)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vykaz', from, to, clientId],
    queryFn: () => fetch('/api/vykaz?' + params).then(r => r.json()),
    enabled: false,
  })

  const selectedClient = (clients ?? []).find((c: any) => c.id === clientId)

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ChevronUp size={12} className="text-gray-300" />
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-sycom-500" /> : <ChevronDown size={12} className="text-sycom-500" />
  }

  const allRows = useMemo(() => {
    if (!data) return []
    const hours = (data.hourRows ?? []).map((r: any) => ({ ...r, _type: 'hours' }))
    const goods = (data.goodsRows ?? []).map((r: any) => ({ ...r, _type: 'goods' }))
    const combined = [...hours, ...goods]
    combined.sort((a, b) => {
      let av: any, bv: any
      if (sortCol === 'date') { av = new Date(a.date).getTime(); bv = new Date(b.date).getTime() }
      else if (sortCol === 'name') { av = a.ticketSubject ?? a.itemName ?? ''; bv = b.ticketSubject ?? b.itemName ?? '' }
      else if (sortCol === 'type') { av = a.hoursTypeLabel ?? 'Tovar'; bv = b.hoursTypeLabel ?? 'Tovar' }
      else if (sortCol === 'qty') { av = a.hours ?? a.quantity ?? 0; bv = b.hours ?? b.quantity ?? 0 }
      else if (sortCol === 'price') { av = a.pricePerHour ?? a.pricePerUnit ?? 0; bv = b.pricePerHour ?? b.pricePerUnit ?? 0 }
      else if (sortCol === 'total') { av = a.totalPrice ?? 0; bv = b.totalPrice ?? 0 }
      else if (sortCol === 'who') { av = a.addedBy ?? ''; bv = b.addedBy ?? '' }
      else return 0
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return combined
  }, [data, sortCol, sortDir])

  const summary = data?.summary

  // --- PRINT ---
  function handlePrint() {
    window.print()
  }

  // --- PDF DOWNLOAD via jsPDF + html2canvas ---
  async function handleDownloadPdf() {
    if (!printRef.current || !summary) return
    setPdfLoading(true)
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf' as any),
        import('html2canvas' as any),
      ])
      const el = printRef.current
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgW = pageW - 16
      const imgH = (canvas.height * imgW) / canvas.width
      let y = 8
      let remaining = imgH
      while (remaining > 0) {
        const sliceH = Math.min(remaining, pageH - 16)
        const srcY = (imgH - remaining) * (canvas.height / imgH)
        const srcH = sliceH * (canvas.height / imgH)
        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = canvas.width
        sliceCanvas.height = srcH
        const ctx = sliceCanvas.getContext('2d')!
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)
        if (y > 8) pdf.addPage()
        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 8, 8, imgW, sliceH)
        remaining -= sliceH
      }
      const clientName = selectedClient?.name ?? 'vsetci'
      pdf.save('vykaz_' + clientName + '_' + from + '_' + to + '.pdf')
    } catch (e) {
      console.error('PDF error', e)
      alert('PDF sa nepodarilo vygenerovat. Skuste tlac.')
    } finally {
      setPdfLoading(false)
    }
  }

  const periodLabel = fmtDate(from) + ' - ' + fmtDate(to)
  const clientLabel = selectedClient?.name ?? 'Vsetci klienti'

  return (
    <PortalLayout>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden !important; }
          #vykaz-print, #vykaz-print * { visibility: visible !important; }
          #vykaz-print { position: fixed; top: 0; left: 0; width: 100%; font-size: 9px !important; }
          .no-print { display: none !important; }
          table { font-size: 9px !important; border-collapse: collapse; width: 100%; }
          th, td { padding: 3px 5px !important; border-bottom: 1px solid #e5e7eb; }
          th { font-size: 8px !important; }
          .print-badge { font-size: 8px !important; padding: 1px 4px !important; }
          .summary-card { padding: 8px !important; }
          .summary-title { font-size: 9px !important; }
          .summary-amount { font-size: 16px !important; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto py-8 px-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText size={22} className="text-sycom-500" /> Vykaz
            </h1>
            <p className="text-sm text-gray-500 mt-1">Prehled odpracovanych hodin a predaneho tovaru.</p>
          </div>
          {summary && (
            <div className="no-print flex items-center gap-2">
              <button onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                <Printer size={15} /> Tlacit
              </button>
              <button onClick={handleDownloadPdf} disabled={pdfLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 text-white text-sm font-semibold rounded-xl hover:bg-gray-900 disabled:opacity-50 transition-colors">
                <Download size={15} /> {pdfLoading ? 'Generujem...' : 'Stiahnut PDF'}
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="no-print bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Datum od</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Datum do</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Klient</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">
                <option value="">Vsetci klienti</option>
                {(clients ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button onClick={() => refetch()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 transition-colors">
              <FileText size={15} /> Generovat vykaz
            </button>
          </div>
        </div>

        {isLoading && <div className="text-center py-12 text-gray-400 text-sm">Nacitavam...</div>}

        {summary && (
          <div ref={printRef} id="vykaz-print">
            {/* Print header */}
            <div className="hidden print:block mb-4 pb-3 border-b-2 border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-base font-bold">Vykaz prac a tovaru</h1>
                  <p className="text-xs text-gray-600">Obdobie: {periodLabel} &nbsp;|&nbsp; Klient: {clientLabel}</p>
                </div>
                <p className="text-xs text-gray-400">Sycom IT Portal</p>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="summary-card bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-sycom-50 flex items-center justify-center"><Clock size={15} className="text-sycom-500" /></div>
                  <p className="summary-title text-sm font-semibold text-gray-700">Hodiny podla typu</p>
                </div>
                <div className="space-y-1.5">
                  {Object.entries(summary.hoursByType).map(([type, hours]: [string, any]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className={'print-badge text-[11px] font-bold px-2 py-0.5 rounded-full ' + (HOURS_COLORS[type] ?? 'bg-gray-100 text-gray-600')}>{type}</span>
                      <span className="text-sm font-bold text-gray-800">{hours} hod</span>
                    </div>
                  ))}
                  {Object.keys(summary.hoursByType).length === 0 && <p className="text-xs text-gray-400">Ziadne hodiny</p>}
                </div>
              </div>
              <div className="summary-card bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center"><Euro size={15} className="text-green-600" /></div>
                  <p className="summary-title text-sm font-semibold text-gray-700">Cena za prace</p>
                </div>
                <p className="summary-amount text-3xl font-bold text-gray-900">{fmt(summary.totalHoursPrice)} <span className="text-base font-medium text-gray-400">EUR</span></p>
                <p className="text-xs text-gray-400 mt-1">bez DPH</p>
              </div>
              <div className="summary-card bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center"><Package size={15} className="text-blue-600" /></div>
                  <p className="summary-title text-sm font-semibold text-gray-700">Cena za tovar</p>
                </div>
                <p className="summary-amount text-3xl font-bold text-gray-900">{fmt(summary.totalGoodsPrice)} <span className="text-base font-medium text-gray-400">EUR</span></p>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Spolu bez DPH</p>
                  <p className="text-lg font-bold text-sycom-600">{fmt(summary.totalPrice)} EUR</p>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Detail</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{allRows.length} zaznamov</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {[['date','Datum'],['name','Nazov'],['type','Typ'],['qty','Pocet'],['price','Cena/j'],['total','Spolu'],['who','Zapisal']].map(([col,label]) => (
                        <th key={col} onClick={() => toggleSort(col)}
                          className="no-print px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none whitespace-nowrap">
                          <span className="flex items-center gap-1">{label} <SortIcon col={col} /></span>
                        </th>
                      ))}
                      {['Datum','Nazov','Typ','Pocet','Cena/j','Spolu','Zapisal'].map(label => (
                        <th key={label} className="hidden print:table-cell px-3 py-2 text-left text-xs font-bold text-gray-700 border-b border-gray-300">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allRows.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">Ziadne zaznamy.</td></tr>
                    ) : allRows.map((row: any, i: number) => (
                      <tr key={i} className={'hover:bg-gray-50 ' + (row._type === 'goods' ? 'bg-blue-50/30' : '')}>
                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-500 text-xs">{fmtDate(row.date)}</td>
                        <td className="px-4 py-2.5 text-gray-900 font-medium text-xs max-w-[200px] truncate">
                          {row._type === 'hours' ? row.ticketSubject : <span className="flex items-center gap-1"><Package size={11} className="text-blue-400 shrink-0"/>{row.itemName}</span>}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {row._type === 'hours'
                            ? <span className={'print-badge text-[10px] font-bold px-2 py-0.5 rounded-full ' + (HOURS_COLORS[row.hoursTypeLabel] ?? 'bg-gray-100 text-gray-600')}>{row.hoursTypeLabel}</span>
                            : <span className="print-badge text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Tovar</span>}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs font-medium">
                          {row._type === 'hours' ? row.hours + ' hod' : row.quantity + ' ks'}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                          {row._type === 'hours' ? (row.pricePerHour > 0 ? fmt(row.pricePerHour) + ' EUR' : '-') : fmt(row.pricePerUnit) + ' EUR'}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-800">
                          {row.totalPrice > 0 ? fmt(row.totalPrice) + ' EUR' : '-'}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500">{row.addedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {allRows.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-6 text-xs">
                  <span className="text-gray-400">Prace: <strong className="text-gray-700">{fmt(summary.totalHoursPrice)} EUR</strong></span>
                  <span className="text-gray-400">Tovar: <strong className="text-gray-700">{fmt(summary.totalGoodsPrice)} EUR</strong></span>
                  <span className="font-bold text-sycom-600">Celkom: {fmt(summary.totalPrice)} EUR bez DPH</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  )
}
