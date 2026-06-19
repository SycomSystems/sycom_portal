'use client'
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
  const isAgent = role === 'AGENT'
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
  const [showModal, setShowModal] = useState(false)
  const [mDate, setMDate] = useState(today)
  const [mName, setMName] = useState('')
  const [mType, setMType] = useState('STANDARD')
  const [mHours, setMHours] = useState('')
  const [mUserId, setMUserId] = useState('')
  const [mClientId, setMClientId] = useState('')
  const [mSubmitting, setMSubmitting] = useState(false)
  const [mStatus, setMStatus] = useState<{ok:boolean;msg:string}|null>(null)
  const [editRow, setEditRow] = useState<any>(null)
  const [eDate, setEDate] = useState('')
  const [eName, setEName] = useState('')
  const [eType, setEType] = useState('STANDARD')
  const [eHours, setEHours] = useState('')
  const [eSubmitting, setESubmitting] = useState(false)
  const [eStatus, setEStatus] = useState<{ok:boolean;msg:string}|null>(null)

  useEffect(() => {
    if (searchParams.get('addHours') === '1') setShowModal(true)
  }, [searchParams])

  useEffect(() => {
    fetch('/api/settings/logo').then(r=>r.json()).then(d=>{if(d.filename)setLogoUrl('/api/settings/logo/image')}).catch(()=>{})
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
    const pdfText = (s: string) => (s ?? '').toString()
      .replace(/č/g,'c').replace(/Č/g,'C')
      .replace(/ľ/g,'l').replace(/Ľ/g,'L')
      .replace(/ĺ/g,'l').replace(/Ĺ/g,'L')
      .replace(/ď/g,'d').replace(/Ď/g,'D')
      .replace(/ť/g,'t').replace(/Ť/g,'T')
      .replace(/ň/g,'n').replace(/Ň/g,'N')
      .replace(/ŕ/g,'r').replace(/Ŕ/g,'R')
    if (!summary) return
    setPdfLoading(true)
    try {
      const { default: jsPDF } = await import('jspdf' as any)
      const autoTable = (await import('jspdf-autotable' as any)).default
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      // ── Roboto font (Unicode support for Slovak characters) ──────────────
      try {
        const fResp = await fetch(window.location.origin + '/api/fonts/roboto')
        const fBuf = await fResp.arrayBuffer()
        const fBytes = new Uint8Array(fBuf)
        let fB64 = ''; const ch = 8192
        for (let i = 0; i < fBytes.length; i += ch)
          fB64 += String.fromCharCode(...Array.from(fBytes.subarray(i, Math.min(i+ch, fBytes.length))))
        fB64 = btoa(fB64)
        doc.addFileToVFS('Roboto-Regular.ttf', fB64)
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
        doc.setFont('Roboto', 'normal')
      } catch (e) { console.warn('Roboto font load failed:', e) }
      const M = 12; const PW = 210; const CW = PW - 2*M
      let y = 18

      // ── Logo + hlavička ──────────────────────────────────────────────────
      if (logoUrl) {
        try {
          const absUrl = logoUrl.startsWith('http') ? logoUrl : window.location.origin + logoUrl
          const resp = await fetch(absUrl)
          const blob = await resp.blob()
          const b64: string = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob) })
          const imgEl = new window.Image()
          await new Promise<void>(res => { imgEl.onload = () => res(); imgEl.src = b64 })
          const maxW = 50, maxH = 14
          const ratio = imgEl.naturalWidth / imgEl.naturalHeight
          let logoW = maxW, logoH = logoW / ratio
          if (logoH > maxH) { logoH = maxH; logoW = logoH * ratio }
          doc.addImage(b64, 'PNG', M, y - 2, logoW, logoH)
        } catch(_) {
          doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(50,50,100)
          doc.text('SYCOM', M, y+4)
        }
      } else {
        doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(50,50,100)
        doc.text('SYCOM', M, y+4)
      }
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(50,55,110)
      doc.text('Výkaz prác a tovaru', PW-M, y+1, { align:'right' })
      doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(120,120,150)
      doc.text('Obdobie: '+fmtDate(from)+' — '+fmtDate(to), PW-M, y+6, { align:'right' })
      doc.text('Klient: '+clientLabel, PW-M, y+11, { align:'right' })
      doc.setDrawColor(200,205,228); doc.setLineWidth(0.4); doc.line(M, y+16, PW-M, y+16)
      y += 22

      // ── Jeden súhrnný panel ───────────────────────────────────────────────
      const types = Object.entries(summary.hoursByType) as [string,number][]
      const totalH = sortedHours.reduce((s:number,r:any)=>s+r.hours, 0)
      const panelH = 28
      doc.setFillColor(245,246,252); doc.setDrawColor(210,213,235); doc.setLineWidth(0.4)
      doc.roundedRect(M, y, CW, panelH, 2, 2, 'FD')

      // Ľavá časť — celkové hodiny
      const leftW = 38
      doc.setFillColor(55,70,130); doc.roundedRect(M, y, leftW, panelH, 2, 2, 'F')
      doc.rect(M+leftW-3, y, 3, panelH, 'F')
      doc.setFontSize(16); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
      doc.text(String(totalH)+' hod.', M+leftW/2, y+13, { align:'center' })
      doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(190,195,230)
      doc.text('Hodiny spolu', M+leftW/2, y+20, { align:'center' })

      // Stredná časť — typy hodín
      const midStartX = M+leftW+3
      const rightReserve = 52
      const midW = CW - leftW - rightReserve - 3
      const colW = types.length > 0 ? midW / types.length : midW
      types.forEach(([type, hours]:[string,number], idx:number) => {
        const tx = midStartX + idx * colW
        if (idx > 0) { doc.setDrawColor(215,218,238); doc.setLineWidth(0.3); doc.line(tx, y+5, tx, y+panelH-5) }
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(55,70,130)
        doc.text(String(hours)+' hod.', tx+colW/2, y+12, { align:'center' })
        doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,105,150)
        const lbl = type.replace('Standard mimo prac. casu','Mimo PH: Std').replace('Server mimo prac. casu','Mimo PH: Srv')
        doc.splitTextToSize(lbl, colW-4).slice(0,2).forEach((line:string, i:number) => {
          doc.text(line, tx+colW/2, y+18+i*4, { align:'center' })
        })
      })

      // Pravá časť — ceny
      const priceX = M + CW - rightReserve + 2
      doc.setDrawColor(215,218,238); doc.setLineWidth(0.3); doc.line(priceX-2, y+4, priceX-2, y+panelH-4)
      doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(60,65,100)
      doc.text('Práce:', priceX+2, y+9)
      doc.setFont('helvetica','normal')
      doc.text(fmt(summary.totalHoursPrice)+' €', M+CW-2, y+9, { align:'right' })
      doc.setFont('helvetica','bold')
      doc.text('Tovar:', priceX+2, y+15)
      doc.setFont('helvetica','normal')
      doc.text(fmt(summary.totalGoodsPrice)+' €', M+CW-2, y+15, { align:'right' })
      doc.setDrawColor(210,213,235); doc.line(priceX+1, y+18, M+CW-2, y+18)
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(55,70,130)
      doc.text('Celkom:', priceX+2, y+24)
      doc.text(fmt(summary.totalPrice)+' €', M+CW-2, y+24, { align:'right' })
      y += panelH + 8

      // ── Tabuľka hodín ────────────────────────────────────────────────────
      autoTable(doc, {
        startY: y,
        head: [['Dátum','Popis','Typ','Hod','J. Cena','Spolu','Technik']],
        body: sortedHours.map((r:any) => [
          fmtDate(r.date), r.name??'', r.hoursTypeLabel??'',
          String(r.hours),
          r.pricePerHour>0 ? fmt(r.pricePerHour)+' €' : '-',
          r.totalPrice>0 ? fmt(r.totalPrice)+' €' : '-',
          r.addedBy??'',
        ]),
        foot: !isAgent && sortedHours.length>0 ? [[
          {content:'Spolu', colSpan:3, styles:{fontStyle:'bold'}},
          {content:String(totalH)+' h', styles:{fontStyle:'bold'}},
          '',
          {content:fmt(summary.totalHoursPrice)+' €', styles:{fontStyle:'bold'}},
          '',
        ]] : undefined,
        theme: 'striped',
        headStyles: { fillColor:[60,75,140], textColor:255, fontSize:8, fontStyle:'bold', cellPadding:3 },
        bodyStyles: { font:'Roboto', fontSize:7.5, cellPadding:{top:2.5,bottom:2.5,left:3,right:3}, overflow:'linebreak', textColor:[30,30,50] },
        footStyles: { fillColor:[235,238,252], textColor:[30,30,50], fontStyle:'bold', fontSize:7.5 },
        alternateRowStyles: { fillColor:[246,247,253] },
        columnStyles: {
          0:{cellWidth:22}, 1:{cellWidth:55,halign:'left',overflow:'linebreak'}, 2:{cellWidth:28},
          3:{cellWidth:12,halign:'right'}, 4:{cellWidth:20,halign:'right'},
          5:{cellWidth:23,halign:'right'}, 6:{cellWidth:20,halign:'left'},
        },
        margin:{left:M,right:M}, tableWidth:CW,
        didDrawPage:(data:any) => {
          if(data.pageNumber>1){
            doc.setDrawColor(200,205,230); doc.setLineWidth(0.4); doc.line(M, 8, PW-M, 8)
            doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(140,140,170)
            doc.text('Výkaz | '+periodLabel+' | '+clientLabel, M, 6)
          }
        },
      })
      y = (doc as any).lastAutoTable.finalY + 8

      // ── Tabuľka tovaru ───────────────────────────────────────────────────
      if (sortedGoods.length > 0) {
        doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30,30,40)
        doc.text('Predaný tovar', M, y); y += 5
        autoTable(doc, {
          startY: y,
          head: [['Dátum','Tovar','Množstvo','J. Cena','Spolu','DPH%','Technik']],
          body: sortedGoods.map((r:any) => [
            fmtDate(r.date), r.itemName??'', String(r.quantity)+' ks',
            fmt(r.pricePerUnit)+' €', fmt(r.totalPrice)+' €',
            String(r.vatRate)+'%', r.addedBy??'',
          ]),
          foot: !isAgent ? [[
            {content:'Spolu',colSpan:4,styles:{fontStyle:'bold'}},
            {content:fmt(summary.totalGoodsPrice)+' €',styles:{fontStyle:'bold'}},
            '','',
          ]] : undefined,
          theme: 'striped',
          headStyles: { fillColor:[37,99,235], textColor:255, fontSize:8, fontStyle:'bold', cellPadding:3 },
          bodyStyles: { font:'Roboto', fontSize:7.5, cellPadding:{top:2.5,bottom:2.5,left:3,right:3}, overflow:'linebreak', textColor:[30,30,40] },
          footStyles: { fillColor:[240,245,255], textColor:[30,30,40], fontStyle:'bold', fontSize:7.5 },
          alternateRowStyles: { fillColor:[248,251,255] },
          columnStyles: {
            0:{cellWidth:22}, 1:{cellWidth:57}, 2:{cellWidth:20,halign:'right'},
            3:{cellWidth:22,halign:'right'}, 4:{cellWidth:24,halign:'right'},
            5:{cellWidth:14,halign:'center'}, 6:{cellWidth:0},
          },
          margin:{left:M,right:M}, tableWidth:CW,
        })
        y = (doc as any).lastAutoTable.finalY + 6
      }

      // ── Grand total ──────────────────────────────────────────────────────
      if (role === 'ADMIN') {
        doc.setFillColor(79,70,229)
        doc.roundedRect(PW-M-72, y, 72, 11, 2, 2, 'F')
        doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
        doc.text('Celkom bez DPH: '+fmt(summary.totalPrice)+' €', PW-M-3, y+7, {align:'right'})
      }

      // ── Footer ───────────────────────────────────────────────────────────
      doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(160,160,180)
      doc.text('* Ceny sú uvedené bez DPH  |  Vygenerované: '+fmtDate(today), M, 291)

      const cn = selectedClient?.name?.replace(/\s+/g,'_') ?? 'vsetci'
      doc.save('vykaz_'+cn+'_'+from+'_'+to+'.pdf')
    } catch(e) { console.error(e); alert('PDF chyba. Skuste tlac.') }
    finally { setPdfLoading(false) }
  }

  async function handleAddManual() {
    if (!mDate || !mName.trim() || !mType || !mHours || !mClientId) return
    setMSubmitting(true)
    try {
      const res = await fetch('/api/manual-hours', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: mDate, name: mName.trim(), hoursType: mType, hours: parseFloat(mHours), userId: role === 'ADMIN' ? (mUserId || sessionUserId) : sessionUserId, clientId: mClientId || null }),
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
    setEditRow(row); setEDate(toInputDate(row.date)); setEName(row.name); setEType(row.hoursType); setEHours(String(row.hours)); setEStatus(null)
  }

  async function handleEditSave() {
    if (!editRow) return
    setESubmitting(true)
    try {
      const res = await fetch('/api/manual-hours?id=' + editRow.manualId, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
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
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FileText size={22} className="text-sycom-500" /> Vykaz</h1>
            <p className="text-sm text-gray-500 mt-1">Odpracovane hodiny a predany tovar.</p>
          </div>
          <div className="no-print flex items-center gap-2">
            <button onClick={() => { setMClientId(clientId); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors">
              <Plus size={15}/> + Vykaz Prace
            </button>
            {summary && role === 'ADMIN' && (
              <>
                <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"><Printer size={15}/> Tlacit</button>
                <button onClick={handleDownloadPdf} disabled={pdfLoading} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 text-white text-sm font-semibold rounded-xl hover:bg-gray-900 disabled:opacity-50 transition-colors"><Download size={15}/> {pdfLoading?'Generujem...':'Stiahnut PDF'}</button>
              </>
            )}
          </div>
        </div>

        <div className="no-print bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Datum od</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Datum do</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Klient *</label><select value={clientId} onChange={e=>setClientId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white"><option value="">Vsetci klienti</option>{(clients??[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <button onClick={()=>refetch()} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 transition-colors"><FileText size={15}/> Generovat vykaz</button>
          </div>
        </div>

        {isLoading && <div className="text-center py-12 text-gray-400 text-sm">Nacitavam...</div>}

        {summary && (
          <div ref={printRef} id="vykaz-print">
            {role === 'ADMIN' && (
              <div className="flex items-start justify-between mb-5 pb-4 border-b-2 border-gray-200">
                <LogoEl />
                <div className="text-right">
                  <p className="text-base font-bold text-gray-900">Vykaz prac a tovaru</p>
                  <p className="text-xs text-gray-500 mt-0.5">Obdobie: {periodLabel}</p>
                  <p className="text-xs text-gray-500">Klient: {clientLabel}</p>
                  <p className="text-[11px] text-gray-400 mt-1">Vygenerovane: {fmtDate(today)}</p>
                </div>
              </div>
            )}

            {role === 'ADMIN' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="summary-card bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-xl bg-sycom-50 flex items-center justify-center"><Clock size={15} className="text-sycom-500"/></div><p className="text-sm font-semibold text-gray-700">Hodiny podla typu</p></div>
                  <div className="space-y-1.5">
                    {Object.entries(summary.hoursByType).map(([type,hours]:[string,any])=>(<div key={type} className="flex items-center justify-between"><span className={'print-badge text-[11px] font-bold px-2 py-0.5 rounded-full '+(HOURS_COLORS[type]??'bg-gray-100 text-gray-600')}>{type}</span><span className="text-sm font-bold text-gray-800">{hours} hod</span></div>))}
                    {Object.keys(summary.hoursByType).length===0&&<p className="text-xs text-gray-400">Ziadne hodiny</p>}
                  </div>
                </div>
                <div className="summary-card bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center"><Euro size={15} className="text-green-600"/></div><p className="text-sm font-semibold text-gray-700">Cena za prace</p></div>
                  <p className="summary-value text-3xl font-bold text-gray-900">{fmt(summary.totalHoursPrice)} <span className="text-base font-medium text-gray-400">EUR</span></p>
                  <p className="text-xs text-gray-400 mt-1">bez DPH</p>
                </div>
                <div className="summary-card bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center"><Package size={15} className="text-blue-600"/></div><p className="text-sm font-semibold text-gray-700">Cena za tovar</p></div>
                  <p className="summary-value text-3xl font-bold text-gray-900">{fmt(summary.totalGoodsPrice)} <span className="text-base font-medium text-gray-400">EUR</span></p>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between"><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Spolu bez DPH</p><p className="text-lg font-bold text-sycom-600">{fmt(summary.totalPrice)} EUR</p></div>
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-5">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Clock size={16} className="text-sycom-400"/> Odpracovane hodiny</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{sortedHours.length} zaznamov</span>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  {[['date','Datum'],['name','Nazov'],['type','Typ hodin'],['qty','Hodiny'],['price','Cena/hod'],['total','Spolu'],['who','Zapisal']].map(([col,label])=>(<th key={col} onClick={()=>toggleSort(col)} className="no-print px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none whitespace-nowrap"><span className="flex items-center gap-1">{label} <SortIcon col={col}/></span></th>))}
                  {['Datum','Nazov','Typ hodin','Hodiny','Cena/hod','Spolu','Zapisal'].map(l=>(<th key={l} className="hidden print:table-cell px-3 py-2 text-left text-xs font-bold text-gray-700 border-b border-gray-300">{l}</th>))}
                  {(role==='ADMIN'||role==='AGENT')&&<th className="no-print px-4 py-3"></th>}
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedHours.length===0?(<tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">Ziadne hodiny.</td></tr>):sortedHours.map((row:any,i:number)=>(
                    <tr key={i} className={'hover:bg-gray-50 '+(row.source==='manual'?'bg-amber-50/40':'')}>
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-500 text-xs">{fmtDate(row.date)}</td>
                      <td className="px-4 py-2.5 text-xs max-w-[220px] truncate">
                        {row.source==='ticket'
                          ? <a href={'/tickets/'+row.ticketId} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sycom-600 hover:text-sycom-800 hover:underline font-medium"><Ticket size={11} className="text-sycom-400 shrink-0"/>{row.name}</a>
                          : <span className="text-gray-900 font-medium">{row.name}</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><span className={'print-badge text-[10px] font-bold px-2 py-0.5 rounded-full '+(HOURS_COLORS[row.hoursTypeLabel]??'bg-gray-100 text-gray-600')}>{row.hoursTypeLabel}</span></td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs font-medium">{row.hours} hod</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs">{row.pricePerHour>0?fmt(row.pricePerHour)+' EUR':'-'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-800">{row.totalPrice>0?fmt(row.totalPrice)+' EUR':'-'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500">{row.addedBy}</td>
                      {(role==='ADMIN'||role==='AGENT')&&(<td className="no-print px-3 py-2.5 whitespace-nowrap">{row.source==='manual'&&(role==='ADMIN'||row.userId===sessionUserId)?(<div className="flex items-center gap-1"><button onClick={()=>openEdit(row)} className="p-1.5 text-gray-400 hover:text-sycom-500 hover:bg-sycom-50 rounded-lg transition-colors"><Pencil size={13}/></button><button onClick={()=>handleDelete(row)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13}/></button></div>):role==='ADMIN'&&row.source!=='manual'?<span className="text-[10px] text-gray-300">tiket</span>:null}</td>)}
                    </tr>
                  ))}
                </tbody>
                {sortedHours.length>0&&!isAgent&&(<tfoot><tr className="border-t-2 border-gray-200 bg-gray-50"><td colSpan={3} className="px-4 py-2.5 text-xs font-bold text-gray-500">Spolu hodiny</td><td className="px-4 py-2.5 text-xs font-bold text-gray-800">{sortedHours.reduce((s:number,r:any)=>s+r.hours,0)} hod</td><td/><td className="px-4 py-2.5 text-xs font-bold text-sycom-600">{fmt(summary.totalHoursPrice)} EUR</td><td/>{role==='ADMIN'&&<td/>}</tr></tfoot>)}
              </table></div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Package size={16} className="text-blue-400"/> Predany tovar</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{sortedGoods.length} zaznamov</span>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">{['Datum','Nazov tovaru','Mnozstvo','Cena/ks','Spolu bez DPH','DPH %','Zapisal'].map(l=>(<th key={l} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{l}</th>))}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedGoods.length===0?(<tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Ziadny predany tovar.</td></tr>):sortedGoods.map((row:any,i:number)=>(<tr key={i} className="hover:bg-blue-50/30"><td className="px-4 py-2.5 whitespace-nowrap text-gray-500 text-xs">{fmtDate(row.date)}</td><td className="px-4 py-2.5 text-gray-900 font-medium text-xs">{row.itemName}</td><td className="px-4 py-2.5 whitespace-nowrap text-xs">{row.quantity} ks</td><td className="px-4 py-2.5 whitespace-nowrap text-xs">{fmt(row.pricePerUnit)} EUR</td><td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-800">{fmt(row.totalPrice)} EUR</td><td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500">{row.vatRate}%</td><td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500">{row.addedBy}</td></tr>))}
                </tbody>
                {sortedGoods.length>0&&!isAgent&&(<tfoot><tr className="border-t-2 border-gray-200 bg-gray-50"><td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-gray-500">Spolu tovar</td><td className="px-4 py-2.5 text-xs font-bold text-blue-600">{fmt(summary.totalGoodsPrice)} EUR</td><td colSpan={2}/></tr></tfoot>)}
              </table></div>
            </div>

            {role === 'ADMIN' && (
              <div className="mt-4 flex items-center justify-end gap-6 text-sm px-2">
                <span className="text-gray-500">Prace: <strong className="text-gray-800">{fmt(summary.totalHoursPrice)} EUR</strong></span>
                <span className="text-gray-500">Tovar: <strong className="text-gray-800">{fmt(summary.totalGoodsPrice)} EUR</strong></span>
                <span className="text-base font-bold text-sycom-600 bg-sycom-50 border border-sycom-200 px-4 py-1.5 rounded-xl">Celkom: {fmt(summary.totalPrice)} EUR bez DPH</span>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal&&(<div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-md"><div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"><h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Plus size={16} className="text-green-600"/> Zadat hodiny bez tiketu</h2><button onClick={()=>setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X size={16}/></button></div><div className="p-6 space-y-4">{mStatus&&(<div className={'flex items-center gap-2 px-3 py-2 rounded-xl text-sm '+(mStatus.ok?'bg-green-50 border border-green-200 text-green-700':'bg-red-50 border border-red-200 text-red-700')}>{mStatus.ok?<Check size={14}/>:<X size={14}/>} {mStatus.msg}</div>)}<div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-gray-500 mb-1">Datum *</label><input type="date" value={mDate} onChange={e=>setMDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div><div><label className="block text-xs font-medium text-gray-500 mb-1">Pocet hodin *</label><input type="number" min="0.25" step="0.25" value={mHours} onChange={e=>setMHours(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/><div className="flex gap-1 mt-1">{[0.5,1,1.5,2].map(v=><button key={v} type="button" onClick={()=>setMHours(String(v))} className="flex-1 py-1 text-xs border border-gray-200 rounded-lg hover:bg-sycom-50 hover:border-sycom-300 hover:text-sycom-700 transition-colors">{String(v).replace('.',',')}</button>)}</div></div></div><div><label className="block text-xs font-medium text-gray-500 mb-1">Popis prace *</label><input type="text" value={mName} onChange={e=>setMName(e.target.value)} placeholder="Napr. Konfiguracia servera..." className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div><div><label className="block text-xs font-medium text-gray-500 mb-1">Typ hodin *</label><select value={mType} onChange={e=>setMType(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">{HOURS_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></div>{role==='ADMIN'&&(<div><label className="block text-xs font-medium text-gray-500 mb-1">Technik</label><select value={mUserId} onChange={e=>setMUserId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white"><option value="">— moje hodiny —</option>{(staffUsers??[]).filter((u:any)=>u.role==='ADMIN'||u.role==='AGENT').map((u:any)=><option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}</select></div>)}<div><label className="block text-xs font-medium text-gray-500 mb-1">Klient *</label><select value={mClientId} onChange={e=>setMClientId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white"><option value="" disabled>— vyber klienta —</option>{(clients??[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div></div><div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2"><button onClick={()=>setShowModal(false)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Zrusit</button><button onClick={handleAddManual} disabled={mSubmitting||!mDate||!mName.trim()||!mHours||!mClientId} className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"><Plus size={15}/> {mSubmitting?'Ukladam...':'Pridat hodiny'}</button></div></div></div>)}
      {editRow&&(<div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-md"><div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"><h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Pencil size={16} className="text-sycom-500"/> Upravit hodiny</h2><button onClick={()=>setEditRow(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X size={16}/></button></div><div className="p-6 space-y-4">{eStatus&&(<div className={'flex items-center gap-2 px-3 py-2 rounded-xl text-sm '+(eStatus.ok?'bg-green-50 border border-green-200 text-green-700':'bg-red-50 border border-red-200 text-red-700')}>{eStatus.ok?<Check size={14}/>:<X size={14}/>} {eStatus.msg}</div>)}<div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-gray-500 mb-1">Datum *</label><input type="date" value={eDate} onChange={e=>setEDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div><div><label className="block text-xs font-medium text-gray-500 mb-1">Pocet hodin *</label><input type="number" min="0.25" step="0.25" value={eHours} onChange={e=>setEHours(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div></div><div><label className="block text-xs font-medium text-gray-500 mb-1">Popis prace *</label><input type="text" value={eName} onChange={e=>setEName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div><div><label className="block text-xs font-medium text-gray-500 mb-1">Typ hodin *</label><select value={eType} onChange={e=>setEType(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">{HOURS_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></div><p className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-xl">Hodiny z tiketov sa edituju priamo v tikete.</p></div><div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2"><button onClick={()=>setEditRow(null)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Zrusit</button><button onClick={handleEditSave} disabled={eSubmitting||!eDate||!eName.trim()||!eHours} className="flex items-center gap-2 px-5 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors"><Check size={15}/> {eSubmitting?'Ukladam...':'Ulozit zmeny'}</button></div></div></div>)}
    </PortalLayout>
  )
}

export default function VykazPageWrapper() {
  return (
    <Suspense fallback={null}>
      <VykazPage />
    </Suspense>
  )
}
