'use client'
import { useState, useEffect } from 'react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { Save, Eye, EyeOff, Loader2, RefreshCw, ScanText, Bot, Mail, ChevronDown, ChevronRight, DollarSign, Trash2 } from 'lucide-react'

interface OcrSettings {
  invoice_ocr_enabled: string
  openai_api_key: string
  openai_credit_threshold: string
  openai_credit_notify_users: string
}
interface OcrResult {
  id: string; createdAt: string; direction: string | null
  supplierName: string | null; supplierIco: string | null
  customerName: string | null; customerIco: string | null
  invoiceNumber: string | null; variableSymbol: string | null
  totalAmount: number | null; dueDate: string | null
  items: string | null; sourceEmail: string | null; filename: string | null
  recognitionMethod: string | null; error: string | null
  isDuplicate: boolean; duplicateOfId: string | null; stockStatus: string
}
interface AiLog {
  id: string; createdAt: string; model: string
  promptTokens: number | null; completionTokens: number | null
  costUsd: number | null; requestPreview: string | null
  responsePreview: string | null; error: string | null
}
interface ReceivedLog {
  id: string; createdAt: string; fromEmail: string; subject: string
  filename: string | null; status: string; error: string | null
}

const MASKED = '••••••••'
function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function SettingsTab() {
  const [form, setForm] = useState<OcrSettings>({ invoice_ocr_enabled: 'false', openai_api_key: '', openai_credit_threshold: '', openai_credit_notify_users: '' })
  const [showKey, setShowKey]  = useState(false)
  const [saving, setSaving]    = useState(false)
  const [saved, setSaved]      = useState(false)
  const [credit, setCredit]    = useState<string | null>(null)
  const [creditLoading, setCL] = useState(false)
  const [loading, setLoading]  = useState(true)

  useEffect(() => {
    fetch('/api/admin/invoice-settings').then(r => r.json()).then(d => {
      setForm({ ...d, openai_api_key: '' }); setLoading(false)
    })
  }, [])

  const set = (k: keyof OcrSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/admin/invoice-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  const checkCredit = async () => {
    setCL(true); setCredit(null)
    try {
      const r = await fetch('/api/admin/openai-credit').then(r => r.json())
      if (r.error) { setCredit(`Chyba: ${r.error}`); return }
      setCredit(r.total_available != null
        ? `✓ Kľúč platný · $${Number(r.total_available).toFixed(2)} USD`
        : `✓ Kľúč platný · ${r.credit_note || 'platform.openai.com/settings/billing'}`)
    } catch (e: any) { setCredit(`Chyba: ${e.message}`) }
    finally { setCL(false) }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-gray-400"/></div>

  return (
    <div className="space-y-6 max-w-lg">
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
        Invoice OCR poller používa <strong>rovnaké IMAP nastavenia</strong> ako email poller.
        Skenuje všetky emaily s PDF prílohami v INBOX-e a rozpoznáva faktúry.
        Sklad sa neplní automaticky — schvaliť treba v sekcii <strong>Faktúry</strong>.
      </div>

      <div>
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <input type="checkbox" checked={form.invoice_ocr_enabled === 'true'}
            onChange={e => setForm(p => ({ ...p, invoice_ocr_enabled: e.target.checked ? 'true' : 'false' }))}
            className="rounded w-4 h-4"/>
          <span className="font-medium text-gray-800">Aktivovať OCR faktúr (každých 5 minút)</span>
        </label>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">OpenAI (GPT-4o-mini)</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API kľúč</label>
            <div className="relative">
              <input type={showKey ? 'text' : 'password'} className="w-full border rounded px-3 py-2 text-sm pr-9"
                placeholder="(nezmenené)" value={form.openai_api_key} onChange={set('openai_api_key')}/>
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                onClick={() => setShowKey(v => !v)}>
                {showKey ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={checkCredit} disabled={creditLoading}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm disabled:opacity-60">
              {creditLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <DollarSign className="w-4 h-4"/>}
              Skontrolovať kľúč
            </button>
            {credit && <span className="text-sm text-gray-700">{credit}</span>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prah upozornenia na nízky kredit (EUR)</label>
            <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="5.00"
              value={form.openai_credit_threshold} onChange={set('openai_credit_threshold')}/>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Uložiť
        </button>
        {saved && <span className="text-green-600 text-sm">✓ Uložené</span>}
      </div>
    </div>
  )
}

function OcrTab() {
  const [results, setResults]   = useState<OcrResult[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = () => { setLoading(true); fetch('/api/admin/ocr-results?limit=200').then(r => r.json()).then(d => { setResults(d); setLoading(false) }) }
  useEffect(load, [])

  const toggle = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-600 px-2 py-1.5 border rounded"><RefreshCw className="w-3.5 h-3.5"/> Obnoviť</button>
        <span className="text-xs text-gray-400 ml-auto">{results.length} záznamov</span>
      </div>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400"/></div>
      : results.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">Žiadne OCR záznamy</div>
      : (
        <div className="space-y-2">
          {results.map(r => {
            const isExp = expanded.has(r.id)
            let items: any[] = []
            try { items = r.items ? JSON.parse(r.items) : [] } catch {}
            return (
              <div key={r.id} className={`rounded-lg border overflow-hidden ${r.isDuplicate ? 'border-amber-300 bg-amber-50/30' : r.error ? 'border-red-200' : 'border-gray-200'}`}>
                <button onClick={() => toggle(r.id)} className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50/50 text-left">
                  {isExp ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0"/> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0"/>}
                  <span className="text-gray-400 text-xs w-36 shrink-0">{fmtDt(r.createdAt)}</span>
                  {r.direction && <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${r.direction === 'dodavatel' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>{r.direction}</span>}
                  {r.isDuplicate && <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-amber-100 text-amber-700 font-semibold border border-amber-300">DUP</span>}
                  <span className="font-medium text-gray-800 truncate flex-1">{r.supplierName || '—'}</span>
                  {r.totalAmount != null && <span className="text-gray-700 shrink-0">{Number(r.totalAmount).toLocaleString('sk-SK', {minimumFractionDigits:2})} €</span>}
                  {r.error ? <span className="text-red-400 text-xs shrink-0">✗</span> : <span className="text-green-400 text-xs shrink-0">✓</span>}
                </button>
                {isExp && (
                  <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50 text-xs space-y-2 pt-3">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                      <div><span className="text-gray-500">Číslo:</span> <span className="font-medium">{r.invoiceNumber||'—'}</span></div>
                      <div><span className="text-gray-500">VS:</span> <span className="font-medium">{r.variableSymbol||'—'}</span></div>
                      <div><span className="text-gray-500">Dodávateľ:</span> <span className="font-medium">{r.supplierName||'—'}{r.supplierIco?` (${r.supplierIco})`:''}</span></div>
                      <div><span className="text-gray-500">Odberateľ:</span> <span className="font-medium">{r.customerName||'—'}</span></div>
                      <div><span className="text-gray-500">Splatnosť:</span> <span className="font-medium">{r.dueDate||'—'}</span></div>
                      <div><span className="text-gray-500">Sklad:</span> <span className="font-medium">{r.stockStatus}</span></div>
                    </div>
                    {r.error && <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700">{r.error}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AiLogsTab() {
  const [logs, setLogs]         = useState<AiLog[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = () => { setLoading(true); fetch('/api/admin/ai-logs?limit=200').then(r => r.json()).then(d => { setLogs(d); setLoading(false) }) }
  useEffect(load, [])

  const toggle = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const clearAll = async () => { if (!confirm('Vymazať AI logy?')) return; await fetch('/api/admin/ai-logs', { method: 'DELETE' }); load() }
  const total = logs.reduce((s, l) => s + (l.costUsd || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-purple-50 border border-purple-100 rounded px-4 py-2 text-sm">
          <span className="text-purple-700 font-medium">${total.toFixed(4)}</span><span className="text-purple-600 ml-1">USD</span>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-600 px-2 py-1.5 border rounded"><RefreshCw className="w-3.5 h-3.5"/> Obnoviť</button>
        <button onClick={clearAll} className="flex items-center gap-1.5 text-sm text-red-600 px-2 py-1.5 border border-red-200 rounded ml-auto"><Trash2 className="w-3.5 h-3.5"/> Vymazať</button>
      </div>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400"/></div>
      : logs.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">Žiadne AI logy</div>
      : (
        <div className="space-y-2">
          {logs.map(l => {
            const isExp = expanded.has(l.id)
            return (
              <div key={l.id} className={`rounded-lg border overflow-hidden ${l.error ? 'border-red-200' : 'border-gray-200'}`}>
                <button onClick={() => toggle(l.id)} className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 text-left">
                  {isExp ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0"/> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0"/>}
                  <span className="text-gray-400 text-xs w-36 shrink-0">{fmtDt(l.createdAt)}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 shrink-0">{l.model}</span>
                  <span className="text-gray-600 shrink-0">{((l.promptTokens||0)+(l.completionTokens||0)).toLocaleString()} tok</span>
                  <span className="text-gray-600 shrink-0">${(l.costUsd||0).toFixed(5)}</span>
                  <span className="flex-1"/>
                  {l.error ? <span className="text-red-400 text-xs">✗</span> : <span className="text-green-400 text-xs">✓</span>}
                </button>
                {isExp && (
                  <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50 text-xs space-y-2 pt-3">
                    {l.requestPreview && <div><div className="font-medium text-gray-500 mb-1">Request:</div><pre className="bg-white border rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-32">{l.requestPreview}</pre></div>}
                    {l.responsePreview && <div><div className="font-medium text-gray-500 mb-1">Response:</div><pre className="bg-white border rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-32">{l.responsePreview}</pre></div>}
                    {l.error && <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700">{l.error}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ReceivedTab() {
  const [logs, setLogs]       = useState<ReceivedLog[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus]   = useState('')

  const load = () => { setLoading(true); fetch(`/api/admin/received-invoice-logs?limit=200${status ? `&status=${status}` : ''}`).then(r => r.json()).then(d => { setLogs(d); setLoading(false) }) }
  useEffect(load, [status])
  const clearAll = async () => { if (!confirm('Vymazať?')) return; await fetch('/api/admin/received-invoice-logs', { method: 'DELETE' }); load() }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">Všetky</option>
          <option value="processed">Spracované</option>
          <option value="error">Chyby</option>
        </select>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-600 px-2 py-1.5 border rounded"><RefreshCw className="w-3.5 h-3.5"/> Obnoviť</button>
        <button onClick={clearAll} className="flex items-center gap-1.5 text-sm text-red-600 px-2 py-1.5 border border-red-200 rounded ml-auto"><Trash2 className="w-3.5 h-3.5"/> Vymazať</button>
      </div>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400"/></div>
      : logs.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">Žiadne záznamy</div>
      : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Čas','Od','Predmet','Súbor','Stav'].map(h => <th key={h} className="text-left px-3 py-2.5 font-medium text-gray-600 border-b text-xs">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(l => (
                <tr key={l.id} className={l.status === 'error' ? 'bg-red-50/40' : ''}>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">{fmtDt(l.createdAt)}</td>
                  <td className="px-3 py-2 text-gray-800 text-xs">{l.fromEmail}</td>
                  <td className="px-3 py-2 text-gray-700 max-w-xs truncate text-xs">{l.subject}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{l.filename||'—'}</td>
                  <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${l.status==='processed'?'bg-green-50 text-green-700':l.status==='error'?'bg-red-50 text-red-700':'bg-gray-100 text-gray-600'}`}>{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type Tab = 'settings' | 'ocr' | 'ai' | 'received'

export default function InvoiceOcrPage() {
  const [tab, setTab] = useState<Tab>('settings')
  const tabs = [
    { key: 'settings', label: 'Nastavenia', icon: Save },
    { key: 'ocr',      label: 'OCR výsledky', icon: ScanText },
    { key: 'ai',       label: 'AI logy', icon: Bot },
    { key: 'received', label: 'Prijaté emaily', icon: Mail },
  ] as const

  return (
    <PortalLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <ScanText className="w-6 h-6 text-blue-600"/>
          <h1 className="text-2xl font-bold text-gray-900">Invoice OCR — nastavenia</h1>
        </div>
        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon className="w-4 h-4"/> {label}
            </button>
          ))}
        </div>
        {tab === 'settings' && <SettingsTab/>}
        {tab === 'ocr'      && <OcrTab/>}
        {tab === 'ai'       && <AiLogsTab/>}
        {tab === 'received' && <ReceivedTab/>}
      </div>
    </PortalLayout>
  )
}
