

export default function VykazPageWrapper() {
  return (
    <Suspense fallback={null}>
      <VykazPage />
    </Suspense>
  )
}'use client'
import { useState, useMemo, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Clock, Package, Euro, FileText, ChevronDown, ChevronUp, Printer, Download, Plus, X, Check, Ticket, Pencil, Trash2 } from 'lucide-react'

function fmt(n: number) { return n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d: string | Date) { return new Date(d).toLocaleDateString('sk-SK') }
function toInputDate(d: string | Date) { return new Date(d).toISOString().slice(0, 10) }

const HOURS_TYPES = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'STANDARD_MIMO', label: 'Standard mimo prac. casu' },
  { value: 'SERVER', label: 'Server' },
  { value: 'SERVER_MIMO', label: 'Server mimo prac. casu' },
]
const HOURS_COLORS: Record<string, string> = {
  Standard: 'bg-blue-100 text-blue-700',
  'Standard mimo prac. casu': 'bg-indigo-100 text-indigo-700',
  Server: 'bg-purple-100 text-purple-700',
  'Server mimo prac. casu': 'bg-orange-100 text-orange-700',
}

function VykazPage() {
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const sessionUserId = (session?.user as any)?.id

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)

  const [from, setFrom] = useState(firstDay)
  const [to, setTo] = useState(today)
  const [clientId, setClientId] = useState('')
  const [sortCol, setSortCol] = useState('date')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string|null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  // Add manual hours modal
  const [showModal, setShowModal] = useState(false)
  const [mDate, setMDate] = useState(today)
  const [mName, setMName] = useState('')
  const [mType, setMType] = useState('STANDARD')
  const [mHours, setMHours] = useState('')
  const [mUserId, setMUserId] = useState('')
  const [mClientId, setMClientId] = useState('')
  const [mSubmitting, setMSubmitting] = useState(false)
  const [mStatus, setMStatus] = useState<{ok:boolean;msg:string}|null>(null)

  // Edit manual hours modal
  const [editRow, setEditRow] = useState<any>(null)
  const [eDate, setEDate] = useState('')
  const [eName, setEName] = useState('')
  const [eType, setEType] = useState('STANDARD')
  const [eHours, setEHours] = useState('')
  const [eSubmitting, setESubmitting] = useState(false)
  const [eStatus, setEStatus] = useState<{ok:boolean;msg:string}|null>(null)

  // Auto-open modal if ?addHours=1
  useEffect(() => {
    if (searchParams.get('addHours') === '1') setShowModal(true)
  }, [searchParams])

  useEffect(() => {
    fetch('/api/settings/logo').then(r=>r.json()).then(d=>{if(d.filename)setLogoUrl('/uploads/'+d.filename)}).catch(()=>{})
  }, [])

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => fetch('/api/clients').then(r=>r.json()) })
  const { data: staffUsers } = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => fetch('/api/users?roles=ADMIN,AGENT').then(r=>r.json()),
    enabled: role === 'ADMIN',
  })

  const params = new URLSearchParams({ from, to })
  if (clientId) params.set('clientId', clientId)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vykaz', from, to, clientId],
    queryFn: () => fetch('/api/vykaz?' + params).then(r=>r.json()),
    enabled: false,
  })

  const selectedClient = (clients ?? []).find((c: any) => c.id === clientId)

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d==='asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ChevronUp size={12} className="text-gray-300" />
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-sycom-500" /> : <ChevronDown size={12} className="text-sycom-500" />
  }

  const sortedHours = useMemo(() => {
    const rows = [...(data?.hourRows ?? [])]
    rows.sort((a, b) => {
      let av: any, bv: any
      if (sortCol==='date') { av=new Date(a.date).getTime(); bv=new Date(b.date).getTime() }
      else if (sortCol==='name') { av=a.name??''; bv=b.name??'' }
      else if (sortCol==='type') { av=a.hoursTypeLabel??''; bv=b.hoursTypeLabel??'' }
      else if (sortCol==='qty') { av=a.hours??0; bv=b.hours??0 }
      else if (sortCol==='price') { av=a.pricePerHour??0; bv=b.pricePerHour??0 }
      else if (sortCol==='total') { av=a.totalPrice??0; bv=b.totalPrice??0 }
      else if (sortCol==='who') { av=a.addedBy??''; bv=b.addedBy??'' }
      else return 0
      if (av<bv) return sortDir==='asc'?-1:1
      if (av>bv) return sortDir==='asc'?1:-1
      return 0
    })
    return rows
  }, [data?.hourRows, sortCol, sortDir])

  const sortedGoods = useMemo(() =>
    [...(data?.goodsRows ?? [])].sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime()),
    [data?.goodsRows]
  )

  const summary = data?.summary
  const periodLabel = fmtDate(from) + ' - ' + fmtDate(to)
  const clientLabel = selectedClient?.name ?? 'Vsetci klienti'

  function handlePrint() { window.print() }

  async function handleDownloadPdf() {
    if (!printRef.current || !summary) return
    setPdfLoading(true)
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf' as any), import('html2canvas' as any),
      ])
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgW = pageW - 16
      const imgH = (canvas.height * imgW) / canvas.width
      let remaining = imgH; let first = true
      while (remaining > 0) {
        const sliceH = Math.min(remaining, pageH-16)
        const srcY = (imgH-remaining)*(canvas.height/imgH)
        const srcH = sliceH*(canvas.height/imgH)
        const sc = document.createElement('canvas')
        sc.width = canvas.width; sc.height = Math.ceil(srcH)
        sc.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)
        if (!first) pdf.addPage()
        pdf.addImage(sc.toDataURL('image/png'), 'PNG', 8, 8, imgW, sliceH)
        remaining -= sliceH; first = false
      }
      const cn = selectedClient?.name?.replace(/\s+/g,'_') ?? 'vsetci'
      pdf.save('vykaz_'+cn+'_'+from+'_'+to+'.pdf')
    } catch { alert('PDF chyba. Skuste tlac.') }
    finally { setPdfLoading(false) }
  }

  async function handleAddManual() {
    if (!mDate || !mName.trim() || !mType || !mHours) return
    setMSubmitting(true)
    try {
      const res = await fetch('/api/manual-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: mDate, name: mName.trim(), hoursType: mType,
          hours: parseFloat(mHours),
          userId: role === 'ADMIN' ? (mUserId || sessionUserId) : sessionUserId,
          clientId: mClientId || null,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Chyba')
      setMStatus({ ok: true, msg: 'Hodiny boli pridane.' })
      setMName(''); setMHours(''); setMDate(today); setMType('STANDARD'); setMUserId(''); setMClientId('')
      refetch()
      setTimeout(() => { setMStatus(null); setShowModal(false) }, 1500)
    } catch(e: any) { setMStatus({ ok: false, msg: e.message }) }
    finally { setMSubmitting(false) }
  }

  function openEdit(row: any) {
    setEditRow(row)
    setEDate(toInputDate(row.date))
    setEName(row.name)
    setEType(row.hoursType)
    setEHours(String(row.hours))
    setEStatus(null)
  }

  async function handleEditSave() {
    if (!editRow) return
    setESubmitting(true)
    try {
      const res = await fetch('/api/manual-hours?id=' + editRow.manualId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: eDate, name: eName.trim(), hoursType: eType, hours: parseFloat(eHours) }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Chyba')
      setEStatus({ ok: true, msg: 'Ulozene.' })
      refetch()
      setTimeout(() => { setEStatus(null); setEditRow(null) }, 1000)
    } catch(e: any) { setEStatus({ ok: false, msg: e.message }) }
    finally { setESubmitting(false) }
  }

  async function handleDelete(row: any) {
    if (!confirm('Naozaj vymazat tieto hodiny?')) return
    const res = await fetch('/api/manual-hours?id=' + row.manualId, { method: 'DELETE' })
    if (res.ok) refetch()
    else alert('Chyba pri mazani.')
  }

  const LogoEl = () => logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="Logo" style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain' }} />
  ) : (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ width:36, height:36, background:'#1a6fba', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="3" width="20" height="14" rx="2" stroke="white" strokeWidth="1.8"/>
          <path d="M8 21h8M12 17v4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M7 10l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize:18, fontWeight:800, color:'#1a6fba', lineHeight:1 }}>sycom</div>
        <div style={{ fontSize:9, fontWeight:700, color:'#9ca3af', letterSpacing:2, textTransform:'uppercase', lineHeight:1, marginTop:2 }}>IT Podpora</div>
      </div>
    </div>
  )

  return (
    <PortalLayout>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden !important; }
          #vykaz-print, #vykaz-print * { visibility: visible !important; }
          #vykaz-print { position: fixed; top:0; left:0; width:100%; font-size:9px !important; }
          .no-print { display: none !important; }
          table { font-size:9px !important; border-collapse:collapse; width:100%; }
          th, td { padding:3px 5px !important; border-bottom:1px solid #e5e7eb; }
          th { font-size:8px !important; }
          .print-badge { font-size:8px !important; padding:1px 4px !important; border-radius:4px; }
          .summary-card { padding:8px !important; }
          .summary-value { font-size:16px !important; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto py-8 px-6">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText size={22} className="text-sycom-500" /> Vykaz
            </h1>
            <p className="text-sm text-gray-500 mt-1">Odpracovane hodiny a predany tovar.</p>
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
              <input type="date" value={from} onChange={e=>setFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Datum do</label>
              <input type="date" value={to} onChange={e=>setTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Klient</label>
              <select value={clientId} onChange={e=>setClientId(e.target.value)}
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
            <div className="flex items-start justify-between mb-5 pb-4 border-b-2 border-gray-200">
              <LogoEl />
              <div className="text-right">
                <p className="text-base font-bold text-gray-900">Vykaz prac a tovaru</p>
                <p className="text-xs text-gray-500 mt-0.5">Obdobie: {periodLabel}</p>
                <p className="text-xs text-gray-500">Klient: {clientLabel}</p>
                <p className="text-[11px] text-gray-400 mt-1">Vygenerovane: {fmtDate(today)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="summary-card bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-sycom-50 flex items-center justify-center"><Clock size={15} className="text-sycom-500" /></div>
                  <p className="text-sm font-semibold text-gray-700">Hodiny podla typu</p>
                </div>
                <div className="space-y-1.5">
                  {Object.entries(summary.hoursByType).map(([type, hours]: [string, any]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className={'print-badge text-[11px] font-bold px-2 py-0.5 rounded-full '+(HOURS_COLORS[type]??'bg-gray-100 text-gray-600')}>{type}</span>
                      <span className="text-sm font-bold text-gray-800">{hours} hod</span>
                    </div>
                  ))}
                  {Object.keys(summary.hoursByType).length===0 && <p className="text-xs text-gray-400">Ziadne hodiny</p>}
                </div>
              </div>
              <div className="summary-card bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center"><Euro size={15} className="text-green-600" /></div>
                  <p className="text-sm font-semibold text-gray-700">Cena za prace</p>
                </div>
                <p className="summary-value text-3xl font-bold text-gray-900">{fmt(summary.totalHoursPrice)} <span className="text-base font-medium text-gray-400">EUR</span></p>
                <p className="text-xs text-gray-400 mt-1">bez DPH</p>
              </div>
              <div className="summary-card bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center"><Package size={15} className="text-blue-600" /></div>
                  <p className="text-sm font-semibold text-gray-700">Cena za tovar</p>
                </div>
                <p className="summary-value text-3xl font-bold text-gray-900">{fmt(summary.totalGoodsPrice)} <span className="text-base font-medium text-gray-400">EUR</span></p>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Spolu bez DPH</p>
                  <p className="text-lg font-bold text-sycom-600">{fmt(summary.totalPrice)} EUR</p>
                </div>
              </div>
            </div>

            {/* Hours table */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-5">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Clock size={16} className="text-sycom-400" /> Odpracovane hodiny</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{sortedHours.length} zaznamov</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {[['date','Datum'],['name','Nazov'],['type','Typ hodin'],['qty','Hodiny'],['price','Cena/hod'],['total','Spolu'],['who','Zapisal']].map(([col,label]) => (
                        <th key={col} onClick={()=>toggleSort(col)}
                          className="no-print px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none whitespace-nowrap">
                          <span className="flex items-center gap-1">{label} <SortIcon col={col} /></span>
                        </th>
                      ))}
                      {['Datum','Nazov','Typ hodin','Hodiny','Cena/hod','Spolu','Zapisal'].map(l => (
                        <th key={l} className="hidden print:table-cell px-3 py-2 text-left text-xs font-bold text-gray-700 border-b border-gray-300">{l}</th>
                      ))}
                      {role === 'ADMIN' && <th className="no-print px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedHours.length===0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">Ziadne hodiny pre dany filter.</td></tr>
                    ) : sortedHours.map((row: any, i: number) => (
                      <tr key={i} className={'hover:bg-gray-50 '+(row.source==='manual'?'bg-amber-50/40':'')}>
                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-500 text-xs">{fmtDate(row.date)}</td>
                        <td className="px-4 py-2.5 text-gray-900 font-medium text-xs max-w-[220px] truncate">
                          {row.source==='ticket'
                            ? <span className="flex items-center gap-1"><Ticket size={11} className="text-sycom-400 shrink-0"/>{row.name}</span>
                            : row.name}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className={'print-badge text-[10px] font-bold px-2 py-0.5 rounded-full '+(HOURS_COLORS[row.hoursTypeLabel]??'bg-gray-100 text-gray-600')}>{row.hoursTypeLabel}</span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs font-medium">{row.hours} hod</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs">{row.pricePerHour>0?fmt(row.pricePerHour)+' EUR':'-'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-800">{row.totalPrice>0?fmt(row.totalPrice)+' EUR':'-'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500">{row.addedBy}</td>
                        {role === 'ADMIN' && (
                          <td className="no-print px-3 py-2.5 whitespace-nowrap">
                            {row.source === 'manual' ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => openEdit(row)} className="p-1.5 text-gray-400 hover:text-sycom-500 hover:bg-sycom-50 rounded-lg transition-colors"><Pencil size={13}/></button>
                                <button onClick={() => handleDelete(row)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13}/></button>
                              </div>
                            ) : <span className="text-[10px] text-gray-300 px-1">tiket</span>}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  {sortedHours.length>0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td colSpan={3} className="px-4 py-2.5 text-xs font-bold text-gray-500">Spolu hodiny</td>
                        <td className="px-4 py-2.5 text-xs font-bold text-gray-800">{sortedHours.reduce((s:number,r:any)=>s+r.hours,0)} hod</td>
                        <td/>
                        <td className="px-4 py-2.5 text-xs font-bold text-sycom-600">{fmt(summary.totalHoursPrice)} EUR</td>
                        <td/>{role==='ADMIN'&&<td/>}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Goods table */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Package size={16} className="text-blue-400" /> Predany tovar</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{sortedGoods.length} zaznamov</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Datum','Nazov tovaru','Mnozstvo','Cena/ks','Spolu bez DPH','DPH %','Zapisal'].map(l => (
                        <th key={l} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedGoods.length===0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Ziadny predany tovar pre dany filter.</td></tr>
                    ) : sortedGoods.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-blue-50/30">
                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-500 text-xs">{fmtDate(row.date)}</td>
                        <td className="px-4 py-2.5 text-gray-900 font-medium text-xs">{row.itemName}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs">{row.quantity} ks</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs">{fmt(row.pricePerUnit)} EUR</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-800">{fmt(row.totalPrice)} EUR</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500">{row.vatRate}%</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500">{row.addedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                  {sortedGoods.length>0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-gray-500">Spolu tovar</td>
                        <td className="px-4 py-2.5 text-xs font-bold text-blue-600">{fmt(summary.totalGoodsPrice)} EUR</td>
                        <td colSpan={2}/>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-6 text-sm px-2">
              <span className="text-gray-500">Prace: <strong className="text-gray-800">{fmt(summary.totalHoursPrice)} EUR</strong></span>
              <span className="text-gray-500">Tovar: <strong className="text-gray-800">{fmt(summary.totalGoodsPrice)} EUR</strong></span>
              <span className="text-base font-bold text-sycom-600 bg-sycom-50 border border-sycom-200 px-4 py-1.5 rounded-xl">Celkom: {fmt(summary.totalPrice)} EUR bez DPH</span>
            </div>
          </div>
        )}
      </div>

      {/* ADD MANUAL HOURS MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Plus size={16} className="text-green-600"/> Zadat hodiny bez tiketu</h2>
              <button onClick={()=>setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X size={16}/></button>
            </div>
            <div className="p-6 space-y-4">
              {mStatus && (
                <div className={'flex items-center gap-2 px-3 py-2 rounded-xl text-sm '+(mStatus.ok?'bg-green-50 border border-green-200 text-green-700':'bg-red-50 border border-red-200 text-red-700')}>
                  {mStatus.ok?<Check size={14}/>:<X size={14}/>} {mStatus.msg}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Datum *</label>
                  <input type="date" value={mDate} onChange={e=>setMDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Pocet hodin *</label>
                  <input type="number" min="0.25" step="0.25" value={mHours} onChange={e=>setMHours(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Popis prace *</label>
                <input type="text" value={mName} onChange={e=>setMName(e.target.value)} placeholder="Napr. Konfiguracia servera..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Typ hodin *</label>
                <select value={mType} onChange={e=>setMType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">
                  {HOURS_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {role==='ADMIN' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Technik</label>
                  <select value={mUserId} onChange={e=>setMUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">
                    <option value="">— moje hodiny —</option>
                    {(staffUsers??[]).map((u:any)=><option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Klient</label>
                <select value={mClientId} onChange={e=>setMClientId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">
                  <option value="">— bez klienta —</option>
                  {(clients??[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={()=>setShowModal(false)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Zrusit</button>
              <button onClick={handleAddManual} disabled={mSubmitting||!mDate||!mName.trim()||!mHours}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
                <Plus size={15}/> {mSubmitting?'Ukladam...':'Pridat hodiny'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MANUAL HOURS MODAL */}
      {editRow && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Pencil size={16} className="text-sycom-500"/> Upravit hodiny</h2>
              <button onClick={()=>setEditRow(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X size={16}/></button>
            </div>
            <div className="p-6 space-y-4">
              {eStatus && (
                <div className={'flex items-center gap-2 px-3 py-2 rounded-xl text-sm '+(eStatus.ok?'bg-green-50 border border-green-200 text-green-700':'bg-red-50 border border-red-200 text-red-700')}>
                  {eStatus.ok?<Check size={14}/>:<X size={14}/>} {eStatus.msg}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Datum *</label>
                  <input type="date" value={eDate} onChange={e=>setEDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Pocet hodin *</label>
                  <input type="number" min="0.25" step="0.25" value={eHours} onChange={e=>setEHours(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Popis prace *</label>
                <input type="text" value={eName} onChange={e=>setEName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Typ hodin *</label>
                <select value={eType} onChange={e=>setEType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">
                  {HOURS_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <p className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-xl">Pozn: hodiny z tiketov sa edituju priamo v tikete.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={()=>setEditRow(null)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Zrusit</button>
              <button onClick={handleEditSave} disabled={eSubmitting||!eDate||!eName.trim()||!eHours}
                className="flex items-center gap-2 px-5 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
                <Check size={15}/> {eSubmitting?'Ukladam...':'Ulozit zmeny'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  )
                          }
