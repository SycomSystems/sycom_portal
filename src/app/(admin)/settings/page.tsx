'use client'
// src/app/(admin)/settings/page.tsx
import { useState, useRef, useEffect } from 'react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import {
  Upload, CheckCircle, AlertCircle, ImageIcon, Trash2,
  Phone, Save, Mail, Server, Lock, Eye, EyeOff, ToggleLeft, ToggleRight,
  Shield, Plus, X, Send, Zap,
} from 'lucide-react'

type AllowedDomain = { id: string; domain: string; note: string | null; createdAt: string }

export default function SettingsPage() {
  // --- Logo state ---
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [logoStatus, setLogoStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // --- Phone state ---
  const [phone, setPhone] = useState('')
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [phoneStatus, setPhoneStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // --- AllowedDomain state ---
  const [domains, setDomains] = useState<AllowedDomain[]>([])
  const [newDomain, setNewDomain] = useState('')
  const [newDomainNote, setNewDomainNote] = useState('')
  const [domainLoading, setDomainLoading] = useState(false)
  const [domainStatus, setDomainStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // --- Email IMAP state ---
  const [imapHost, setImapHost] = useState('')
  const [imapPort, setImapPort] = useState('993')
  const [imapSecure, setImapSecure] = useState(true)
  const [imapUser, setImapUser] = useState('')
  const [imapPass, setImapPass] = useState('')
  const [imapEnabled, setImapEnabled] = useState(false)
  const [showImapPass, setShowImapPass] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [testingConn, setTestingConn] = useState(false)

  // --- SMTP state ---
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpSecure, setSmtpSecure] = useState(false)
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPass, setSmtpPass] = useState('')
  const [smtpFrom, setSmtpFrom] = useState('')
  const [showSmtpPass, setShowSmtpPass] = useState(false)
  const [smtpLoading, setSmtpLoading] = useState(false)
  const [smtpStatus, setSmtpStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [testingSmtp, setTestingSmtp] = useState(false)

  useEffect(() => {
    fetch('/api/settings/logo')
      .then((r) => r.json())
      .then((data) => {
        if (data.filename) setLogoUrl(`/uploads/${data.filename}?t=${Date.now()}`)
      })
      .catch(() => {})

    fetch('/api/settings/phone')
      .then((r) => r.json())
      .then((data) => { if (data.phone) setPhone(data.phone) })
      .catch(() => {})

    fetch('/api/settings/email')
      .then((r) => r.json())
      .then((data) => {
        if (data.email_imap_host)    setImapHost(data.email_imap_host)
        if (data.email_imap_port)    setImapPort(data.email_imap_port)
        if (data.email_imap_secure !== undefined) setImapSecure(data.email_imap_secure === 'true')
        if (data.email_imap_user)    setImapUser(data.email_imap_user)
        if (data.email_imap_pass)    setImapPass(data.email_imap_pass)
        if (data.email_imap_enabled !== undefined) setImapEnabled(data.email_imap_enabled === 'true')
      })
      .catch(() => {})

    fetch('/api/admin/allowed-domains')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setDomains(data) })
      .catch(() => {})

    fetch('/api/admin/smtp-settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.host) setSmtpHost(data.host)
        if (data.port) setSmtpPort(String(data.port))
        if (data.secure !== undefined) setSmtpSecure(data.secure)
        if (data.user) setSmtpUser(data.user)
        if (data.pass) setSmtpPass(data.pass)
        if (data.from) setSmtpFrom(data.from)
      })
      .catch(() => {})
  }, [])

  const handleFile = async (file: File) => {
    if (!file) return
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
    if (!allowed.includes(file.type)) {
      setLogoStatus({ type: 'error', message: 'Povolené formáty: PNG, JPG, SVG, WebP' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoStatus({ type: 'error', message: 'Maximálna veľkosť súboru je 2 MB' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
    setUploading(true)
    setLogoStatus(null)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const res = await fetch('/api/settings/logo', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload zlyhal')
      setLogoUrl(`${data.url}?t=${Date.now()}`)
      setLogoStatus({ type: 'success', message: 'Logo bolo úspešne nahrané a bude použité v celom portáli.' })
    } catch (e: any) {
      setLogoStatus({ type: 'error', message: e.message })
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  const handleRemoveLogo = () => {
    setPreview(null)
    setLogoUrl(null)
    setLogoStatus({ type: 'success', message: 'Logo bolo odstránené.' })
  }

  const handleSavePhone = async () => {
    if (!phone.trim()) {
      setPhoneStatus({ type: 'error', message: 'Zadajte telefónne číslo' })
      return
    }
    setPhoneLoading(true)
    setPhoneStatus(null)
    try {
      const res = await fetch('/api/settings/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Uloženie zlyhalo')
      setPhoneStatus({ type: 'success', message: 'Telefónne číslo bolo uložené a zobrazí sa v bočnom paneli.' })
    } catch (e: any) {
      setPhoneStatus({ type: 'error', message: e.message })
    } finally {
      setPhoneLoading(false)
    }
  }

  const handleSaveEmail = async () => {
    if (!imapHost.trim() || !imapUser.trim() || !imapPass.trim()) {
      setEmailStatus({ type: 'error', message: 'Vyplňte IMAP host, používateľa a heslo.' })
      return
    }
    setEmailLoading(true)
    setEmailStatus(null)
    try {
      const res = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_imap_host: imapHost,
          email_imap_port: imapPort,
          email_imap_secure: String(imapSecure),
          email_imap_user: imapUser,
          email_imap_pass: imapPass,
          email_imap_enabled: String(imapEnabled),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Uloženie zlyhalo')
      setEmailStatus({ type: 'success', message: 'IMAP nastavenia boli uložené. Poller ich použije pri ďalšom spustení.' })
    } catch (e: any) {
      setEmailStatus({ type: 'error', message: e.message })
    } finally {
      setEmailLoading(false)
    }
  }

  const handleTestConnection = async () => {
    if (!imapHost.trim() || !imapUser.trim() || !imapPass.trim()) {
      setEmailStatus({ type: 'error', message: 'Vyplňte IMAP host, používateľa a heslo pred testom.' })
      return
    }
    setTestingConn(true)
    setEmailStatus(null)
    try {
      const res = await fetch('/api/settings/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: imapHost,
          port: parseInt(imapPort),
          secure: imapSecure,
          user: imapUser,
          pass: imapPass,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Pripojenie zlyhalo')
      setEmailStatus({ type: 'success', message: `Pripojenie úspešné! Nájdených ${data.messageCount} správ v INBOX.` })
    } catch (e: any) {
      setEmailStatus({ type: 'error', message: e.message })
    } finally {
      setTestingConn(false)
    }
  }

  const handleSaveSmtp = async () => {
    if (!smtpHost.trim() || !smtpUser.trim()) {
      setSmtpStatus({ type: 'error', message: 'Vyplňte aspoň SMTP host a používateľa.' })
      return
    }
    setSmtpLoading(true)
    setSmtpStatus(null)
    try {
      const res = await fetch('/api/admin/smtp-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: parseInt(smtpPort) || 587,
          secure: smtpSecure,
          user: smtpUser,
          pass: smtpPass,
          from: smtpFrom || smtpUser,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Uloženie zlyhalo')
      setSmtpStatus({ type: 'success', message: 'SMTP nastavenia boli uložené. Portál ich použije pri odosielaní e-mailov.' })
    } catch (e: any) {
      setSmtpStatus({ type: 'error', message: e.message })
    } finally {
      setSmtpLoading(false)
    }
  }

  const handleTestSmtp = async () => {
    if (!smtpHost.trim() || !smtpUser.trim()) {
      setSmtpStatus({ type: 'error', message: 'Vyplňte SMTP host a používateľa pred testom.' })
      return
    }
    setTestingSmtp(true)
    setSmtpStatus(null)
    try {
      const res = await fetch('/api/admin/smtp-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: parseInt(smtpPort) || 587,
          secure: smtpSecure,
          user: smtpUser,
          pass: smtpPass,
          from: smtpFrom || smtpUser,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Test zlyhал')
      setSmtpStatus({ type: 'success', message: data.message || 'Test e-mail bol odoslaný úspešne.' })
    } catch (e: any) {
      setSmtpStatus({ type: 'error', message: e.message })
    } finally {
      setTestingSmtp(false)
    }
  }

  const handleAddDomain = async () => {
    const d = newDomain.trim().toLowerCase().replace(/^@/, '')
    if (!d) {
      setDomainStatus({ type: 'error', message: 'Zadajte doménu (napr. firma.sk)' })
      return
    }
    setDomainLoading(true)
    setDomainStatus(null)
    try {
      const res = await fetch('/api/admin/allowed-domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: d, note: newDomainNote.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chyba pri ukladaní')
      setDomains((prev) => [...prev, data].sort((a, b) => a.domain.localeCompare(b.domain)))
      setNewDomain('')
      setNewDomainNote('')
      setDomainStatus({ type: 'success', message: `Doména "${d}" bola pridaná.` })
    } catch (e: any) {
      setDomainStatus({ type: 'error', message: e.message })
    } finally {
      setDomainLoading(false)
    }
  }

  const handleDeleteDomain = async (id: string, domain: string) => {
    if (!confirm(`Odstrániť doménu "${domain}"?`)) return
    try {
      await fetch(`/api/admin/allowed-domains/${id}`, { method: 'DELETE' })
      setDomains((prev) => prev.filter((d) => d.id !== id))
    } catch {
      alert('Chyba pri odstraňovaní domény')
    }
  }

  const inputClass = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sycom-300 focus:border-sycom-400 transition-colors'
  const labelClass = 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block'

  return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto py-8 px-6 space-y-6">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Nastavenia</h1>
          <p className="text-sm text-gray-500 mt-1">Prispôsobte vzhľad a správanie portálu</p>
        </div>

        {/* ── Logo Upload Section ── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Logo portálu</h2>
            <p className="text-xs text-gray-500 mt-0.5">Logo sa zobrazí v hlavičke portálu. Odporúčaná veľkosť: 200×60 px.</p>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Aktuálne logo</p>
              <div className="flex items-center gap-4">
                <div className="w-40 h-16 border border-gray-200 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="object-contain max-h-14 max-w-[150px]" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-300">
                      <ImageIcon size={20} />
                      <span className="text-[10px]">Žiadne logo</span>
                    </div>
                  )}
                </div>
                {logoUrl && (
                  <button onClick={handleRemoveLogo} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors">
                    <Trash2 size={13} /> Odstrániť
                  </button>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Nahrať nové logo</p>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${dragOver ? 'border-sycom-400 bg-sycom-50' : 'border-gray-200 hover:border-sycom-300 hover:bg-gray-50'}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                {preview ? (
                  <div className="flex flex-col items-center gap-3">
                    <img src={preview} alt="Preview" className="max-h-20 max-w-[200px] object-contain rounded-lg border border-gray-200" />
                    <p className="text-xs text-gray-500">Kliknite pre zmenu</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-sycom-50 border border-sycom-100 flex items-center justify-center">
                      <Upload size={20} className="text-sycom-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Pretiahnite súbor sem alebo kliknite</p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG, WebP · max 2 MB</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {logoStatus && (
              <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm ${logoStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                {logoStatus.type === 'success' ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
                {logoStatus.message}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 px-5 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
                <Upload size={15} />
                {uploading ? 'Nahrávam...' : 'Nahrať logo'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Helpdesk Phone Section ── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Helpdesk telefónne číslo</h2>
            <p className="text-xs text-gray-500 mt-0.5">Toto číslo sa zobrazí v dolnej časti ľavého bočného panela pre všetkých používateľov.</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className={labelClass}>Telefónne číslo</label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSavePhone()}
                    placeholder="napr. 0948 938 217"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sycom-300" />
                </div>
                <button onClick={handleSavePhone} disabled={phoneLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
                  <Save size={15} />
                  {phoneLoading ? 'Ukladám...' : 'Uložiť'}
                </button>
              </div>
            </div>
            {phoneStatus && (
              <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm ${phoneStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                {phoneStatus.type === 'success' ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
                {phoneStatus.message}
              </div>
            )}
          </div>
        </div>

        {/* ── Email → Tiket (IMAP) Section ── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Mail size={16} className="text-sycom-500" />
                  Email → Tiket (IMAP)
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Portál bude automaticky kontrolovať schránku a vytvárať tikety z prichádzajúcich e-mailov podľa aliasov klientov.
                </p>
              </div>
              <button
                onClick={() => setImapEnabled(!imapEnabled)}
                className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${imapEnabled ? 'text-green-700 bg-green-50 hover:bg-green-100' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}
              >
                {imapEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                {imapEnabled ? 'Zapnuté' : 'Vypnuté'}
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* IMAP Host */}
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>
                  <Server size={11} className="inline mr-1" />
                  IMAP Server (host)
                </label>
                <input
                  type="text"
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  placeholder="napr. mail.sycom.sk"
                  className={inputClass}
                />
              </div>

              {/* Port + SSL */}
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>Port</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={imapPort}
                    onChange={(e) => setImapPort(e.target.value)}
                    placeholder="993"
                    className="w-28 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sycom-300"
                  />
                  <button
                    onClick={() => {
                      setImapSecure(!imapSecure)
                      setImapPort(!imapSecure ? '993' : '143')
                    }}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${imapSecure ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
                  >
                    <Lock size={12} />
                    {imapSecure ? 'SSL/TLS' : 'Bez SSL'}
                  </button>
                </div>
              </div>

              {/* Username */}
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>Používateľ (e-mail)</label>
                <input
                  type="email"
                  value={imapUser}
                  onChange={(e) => setImapUser(e.target.value)}
                  placeholder="portal@sycom.sk"
                  className={inputClass}
                />
              </div>

              {/* Password */}
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>Heslo</label>
                <div className="relative">
                  <input
                    type={showImapPass ? 'text' : 'password'}
                    value={imapPass}
                    onChange={(e) => setImapPass(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowImapPass(!showImapPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showImapPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
              <strong>Ako to funguje:</strong> Poller beží na serveri každé 2 minúty. Číta neprecítané správy z INBOX,
              porovnáva adresu príjemcu s aliasmi klientov (nastavte ich pri klientovi) a automaticky
              vytvára tiket. Prílohy sa ukladajú k tiket. E-maily bez zhody sú ignorované.
            </div>

            {emailStatus && (
              <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm ${emailStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                {emailStatus.type === 'success' ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
                {emailStatus.message}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleTestConnection}
                disabled={testingConn}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <Mail size={14} />
                {testingConn ? 'Testujem...' : 'Otestovať pripojenie'}
              </button>

              <button
                onClick={handleSaveEmail}
                disabled={emailLoading}
                className="flex items-center gap-2 px-5 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors"
              >
                <Save size={15} />
                {emailLoading ? 'Ukladám...' : 'Uložiť nastavenia'}
              </button>
            </div>
          </div>
        </div>

        {/* ── SMTP Server Section ── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Send size={16} className="text-sycom-500" />
              SMTP Server (odosielanie e-mailov)
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Nastavenia pre odosielanie e-mailov (notifikácie, tikety, uvítacie správy).
              Ak je vyplnené, má prednosť pred nastaveniami v .env súbore.
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* SMTP Host */}
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>
                  <Server size={11} className="inline mr-1" />
                  SMTP Server (host)
                </label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="napr. smtp.office365.com"
                  className={inputClass}
                />
              </div>

              {/* SMTP Port + SSL */}
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>Port</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                    className="w-28 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sycom-300"
                  />
                  <button
                    onClick={() => {
                      setSmtpSecure(!smtpSecure)
                      setSmtpPort(!smtpSecure ? '465' : '587')
                    }}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${smtpSecure ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
                  >
                    <Lock size={12} />
                    {smtpSecure ? 'SSL/TLS' : 'STARTTLS'}
                  </button>
                </div>
              </div>

              {/* SMTP Username */}
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>Používateľ (e-mail)</label>
                <input
                  type="email"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="portal@sycom.sk"
                  className={inputClass}
                />
              </div>

              {/* SMTP Password */}
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>Heslo</label>
                <div className="relative">
                  <input
                    type={showSmtpPass ? 'text' : 'password'}
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPass(!showSmtpPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showSmtpPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* From address */}
              <div className="col-span-2">
                <label className={labelClass}>Odosielateľ (From)</label>
                <input
                  type="email"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  placeholder="Sycom Portal <portal@sycom.sk>"
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Ak nevyplníte, použije sa hodnota z poľa Používateľ.
                </p>
              </div>
            </div>

            {smtpStatus && (
              <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm ${smtpStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                {smtpStatus.type === 'success' ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
                {smtpStatus.message}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleTestSmtp}
                disabled={testingSmtp}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <Zap size={14} />
                {testingSmtp ? 'Testujem...' : 'Otestovať SMTP'}
              </button>

              <button
                onClick={handleSaveSmtp}
                disabled={smtpLoading}
                className="flex items-center gap-2 px-5 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors"
              >
                <Save size={15} />
                {smtpLoading ? 'Ukladám...' : 'Uložiť nastavenia'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Povolené domény Section ── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Shield size={16} className="text-sycom-500" />
              Povolené domény (email-ingest)
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Emaily od odosielateľov z týchto domén budú akceptované. Neznáme domény budú ignorované.
              Pre každú doménu bude automaticky vytvorený používateľský účet a klient.
            </p>
          </div>

          <div className="p-6 space-y-4">
            {/* Existing domains table */}
            {domains.length > 0 ? (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Doména</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Poznámka</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pridaná</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {domains.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-sm text-gray-900">@{d.domain}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{d.note || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {new Date(d.createdAt).toLocaleDateString('sk-SK')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteDomain(d.id, d.domain)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="Odstrániť"
                          >
                            <X size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                Žiadne povolené domény. Pridajte prvú doménu nižšie.
              </div>
            )}

            {/* Add new domain */}
            <div className="flex items-end gap-3 pt-1">
              <div className="flex-1">
                <label className={labelClass}>Nová doména</label>
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                  placeholder="firma.sk"
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label className={labelClass}>Poznámka (voliteľné)</label>
                <input
                  type="text"
                  value={newDomainNote}
                  onChange={(e) => setNewDomainNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                  placeholder="napr. Leitner & Leitner"
                  className={inputClass}
                />
              </div>
              <button
                onClick={handleAddDomain}
                disabled={domainLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors shrink-0"
              >
                <Plus size={15} />
                {domainLoading ? 'Pridávam...' : 'Pridať'}
              </button>
            </div>

            {domainStatus && (
              <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm ${domainStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                {domainStatus.type === 'success' ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
                {domainStatus.message}
              </div>
            )}
          </div>
        </div>

      </div>
    </PortalLayout>
  )
}
