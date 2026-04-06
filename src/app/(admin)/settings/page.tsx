'use client'
// src/app/(admin)/settings/page.tsx
import { useState, useRef, useEffect } from 'react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { Upload, CheckCircle, AlertCircle, ImageIcon, Trash2, Phone, Save } from 'lucide-react'

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

  useEffect(() => {
    fetch('/api/settings/logo')
      .then(r => r.json())
      .then(data => { if (data.filename) setLogoUrl(`/uploads/${data.filename}?t=${Date.now()}`) })
      .catch(() => {})

    fetch('/api/settings/phone')
      .then(r => r.json())
      .then(data => { if (data.phone) setPhone(data.phone) })
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
    reader.onload = e => setPreview(e.target?.result as string)
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
    if (file) handleFile(file)
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
                      <ImageIcon size={24} />
                      <span className="text-[10px]">Žiadne logo</span>
                    </div>
                  )}
                </div>
                {logoUrl && (
                  <button onClick={handleRemoveLogo} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors">
                    <Trash2 size={14} /> Odstrániť
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Nahrať nové logo</p>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${dragOver ? 'border-sycom-400 bg-sycom-50' : 'border-gray-200 hover:border-sycom-300 hover:bg-gray-50'}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
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
                {logoStatus.type === 'success' ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
                {logoStatus.message}
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 px-5 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-60 transition-colors">
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
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Telefónne číslo</label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSavePhone()}
                    placeholder="napr. 0948 938 217"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100 transition-all"
                  />
                </div>
                <button
                  onClick={handleSavePhone}
                  disabled={phoneLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-60 transition-colors"
                >
                  <Save size={15} />
                  {phoneLoading ? 'Ukladám...' : 'Uložiť'}
                </button>
              </div>
            </div>

            {phoneStatus && (
              <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm ${phoneStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                {phoneStatus.type === 'success' ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
                {phoneStatus.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  )
}
