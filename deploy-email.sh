#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Email → Tiket — deploy script
#  Paste this entire script into your server terminal and run it.
#  It will: apply all code changes, push to GitHub, build & restart.
# ═══════════════════════════════════════════════════════════════
set -e
cd /opt/sycom-portal

echo ""
echo "══════════════════════════════════════════"
echo "  STEP 1 — Patch prisma/schema.prisma"
echo "══════════════════════════════════════════"
python3 - << 'PYEOF'
path = 'prisma/schema.prisma'
with open(path) as f:
    lines = f.readlines()

if any('emailAlias' in l for l in lines):
    print('  · emailAlias already present — skipping')
else:
    in_client, idx = False, -1
    for i, l in enumerate(lines):
        if 'model Client {' in l: in_client = True
        elif in_client and l.strip() == '}': idx = i; in_client = False; break
    if idx < 0: print('ERROR: Client model not found'); exit(1)
    lines.insert(idx, '  emailAlias     String?         @unique\n')
    print('  ✓ Added emailAlias to Client model')

if not any('model Setting' in l for l in lines):
    lines += ['\nmodel Setting {\n','  key   String @id\n','  value String @db.Text\n','\n','  @@map("settings")\n','}\n']
    print('  ✓ Added Setting model')
else:
    print('  · Setting model already present — skipping')

with open(path, 'w') as f: f.writelines(lines)
print('  ✓ schema.prisma saved')
PYEOF

echo ""
echo "══════════════════════════════════════════"
echo "  STEP 2 — Patch clients API (PATCH)"
echo "══════════════════════════════════════════"
python3 - << 'PYEOF'
path = "src/app/api/clients/[id]/route.ts"
with open(path) as f: c = f.read()
if 'emailAlias' in c:
    print('  · already patched'); exit()
c = c.replace(
    'name, contactPerson, phone, ico, dic, dicDph, address, www, notes, pricing',
    'name, contactPerson, phone, ico, dic, dicDph, address, www, notes, emailAlias, pricing')
c = c.replace(
    'notes: notes?.trim() || null,',
    'notes: notes?.trim() || null,\n          emailAlias: emailAlias?.trim() || null,')
with open(path, 'w') as f: f.write(c)
print('  ✓ Patched clients/[id]/route.ts')
PYEOF

echo ""
echo "══════════════════════════════════════════"
echo "  STEP 3 — Patch clients API (POST)"
echo "══════════════════════════════════════════"
python3 - << 'PYEOF'
import os
path = 'src/app/api/clients/route.ts'
if not os.path.exists(path): print('  · file not found — skipping'); exit()
with open(path) as f: c = f.read()
if 'emailAlias' in c: print('  · already patched'); exit()
c = c.replace(
    'name, contactPerson, phone, ico, dic, dicDph, address, www, notes',
    'name, contactPerson, phone, ico, dic, dicDph, address, www, notes, emailAlias')
c = c.replace(
    'notes: notes?.trim() || null,',
    'notes: notes?.trim() || null,\n          emailAlias: emailAlias?.trim() || null,')
with open(path, 'w') as f: f.write(c)
print('  ✓ Patched clients/route.ts (POST)')
PYEOF

echo ""
echo "══════════════════════════════════════════"
echo "  STEP 4 — Patch clients admin page"
echo "══════════════════════════════════════════"
python3 - << 'PYEOF'
path = "src/app/(admin)/admin/clients/page.tsx"
with open(path) as f: c = f.read()
if 'emailAlias' in c: print('  · already patched'); exit()

# Add useState
c = c.replace(
    "const [notes, setNotes] = useState('')",
    "const [notes, setNotes] = useState('')\n  const [emailAlias, setEmailAlias] = useState('')")
c = c.replace(
    "const [editNotes, setEditNotes] = useState('')",
    "const [editNotes, setEditNotes] = useState('')\n  const [editEmailAlias, setEditEmailAlias] = useState('')")

# Include in API bodies
c = c.replace("notes,\n        pricing", "notes,\n        emailAlias,\n        pricing")
c = c.replace("notes: editNotes,\n", "notes: editNotes,\n        emailAlias: editEmailAlias,\n")

# Populate when editing
c = c.replace("setEditNotes(client.notes || '')", "setEditNotes(client.notes || '')\n      setEditEmailAlias(client.emailAlias || '')")
c = c.replace("setNotes(client.notes || '')", "setNotes(client.notes || '')\n      setEmailAlias(client.emailAlias || '')")

# Reset on submit
c = c.replace("setNotes('')", "setNotes('')\n    setEmailAlias('')")

# Add field UI — insert before Cennik label in create form
FIELD_CREATE = """          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email alias</label>
            <input type="email" value={emailAlias} onChange={e => setEmailAlias(e.target.value)}
              placeholder="ll@sycom.sk"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sycom-300" />
            <p className="text-xs text-gray-400 mt-1">Alias pre auto-tikety z e-mailov</p>
          </div>"""

# Find anchor: the label text "Cennik" in the create form section
import re
# Insert before first occurrence of Cennik label
c = re.sub(
    r'(<label[^>]*>[^<]*Cennik[^<]*</label>)',
    FIELD_CREATE + '\n          \\1',
    c, count=1)

# Edit form alias field (if there's a separate edit section with editNotes)
FIELD_EDIT = """          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email alias</label>
            <input type="email" value={editEmailAlias} onChange={e => setEditEmailAlias(e.target.value)}
              placeholder="ll@sycom.sk"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sycom-300" />
            <p className="text-xs text-gray-400 mt-1">Alias pre auto-tikety z e-mailov</p>
          </div>"""

if 'editEmailAlias' in c:
    c = re.sub(
        r'({editNotes}.*?</textarea>\s*</div>)',
        r'\1\n' + FIELD_EDIT,
        c, count=1, flags=re.DOTALL)

with open(path, 'w') as f: f.write(c)
print('  ✓ Patched clients admin page')
PYEOF

echo ""
echo "══════════════════════════════════════════"
echo "  STEP 5 — Create /api/settings/email"
echo "══════════════════════════════════════════"
mkdir -p src/app/api/settings/email/test

cat > src/app/api/settings/email/route.ts << 'TSEOF'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

const KEYS = ['email_imap_host','email_imap_port','email_imap_secure','email_imap_user','email_imap_pass','email_imap_enabled']

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await prisma.setting.findMany({ where: { key: { in: KEYS } } })
  const result: Record<string, string> = {}
  for (const r of rows) result[r.key] = r.value
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  await Promise.all(KEYS.filter(k => body[k] !== undefined).map(k =>
    prisma.setting.upsert({ where: { key: k }, update: { value: String(body[k]) }, create: { key: k, value: String(body[k]) } })
  ))
  return NextResponse.json({ success: true })
}
TSEOF
echo "  ✓ Created api/settings/email/route.ts"

cat > src/app/api/settings/email/test/route.ts << 'TSEOF'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { host, port, secure, user, pass } = await req.json()
  try {
    const { ImapFlow } = await import('imapflow')
    const client = new ImapFlow({ host, port: parseInt(port)||993, secure: secure===true||secure==='true', auth: { user, pass }, logger: false })
    await client.connect()
    const status = await client.status('INBOX', { messages: true })
    await client.logout()
    return NextResponse.json({ success: true, messageCount: status.messages ?? 0 })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Connection failed' }, { status: 400 })
  }
}
TSEOF
echo "  ✓ Created api/settings/email/test/route.ts"

echo ""
echo "══════════════════════════════════════════"
echo "  STEP 6 — Update settings page"
echo "══════════════════════════════════════════"
cat > "src/app/(admin)/settings/page.tsx" << 'TSEOF'
'use client'
import { useState, useRef, useEffect } from 'react'
import PortalLayout from '@/components/layout/PortalLayout'
import { Upload, CheckCircle, AlertCircle, ImageIcon, Trash2, Phone, Save, Mail, Server, Lock, Eye, EyeOff, ToggleLeft, ToggleRight } from 'lucide-react'

export default function SettingsPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [logoStatus, setLogoStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [phone, setPhone] = useState('')
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [phoneStatus, setPhoneStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [imapHost, setImapHost] = useState('')
  const [imapPort, setImapPort] = useState('993')
  const [imapSecure, setImapSecure] = useState(true)
  const [imapUser, setImapUser] = useState('')
  const [imapPass, setImapPass] = useState('')
  const [imapEnabled, setImapEnabled] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [testingConn, setTestingConn] = useState(false)

  useEffect(() => {
    fetch('/api/settings/logo').then(r => r.json()).then(d => { if (d.filename) setLogoUrl(`/uploads/${d.filename}?t=${Date.now()}`) }).catch(() => {})
    fetch('/api/settings/phone').then(r => r.json()).then(d => { if (d.phone) setPhone(d.phone) }).catch(() => {})
    fetch('/api/settings/email').then(r => r.json()).then(d => {
      if (d.email_imap_host) setImapHost(d.email_imap_host)
      if (d.email_imap_port) setImapPort(d.email_imap_port)
      if (d.email_imap_secure !== undefined) setImapSecure(d.email_imap_secure === 'true')
      if (d.email_imap_user) setImapUser(d.email_imap_user)
      if (d.email_imap_pass) setImapPass(d.email_imap_pass)
      if (d.email_imap_enabled !== undefined) setImapEnabled(d.email_imap_enabled === 'true')
    }).catch(() => {})
  }, [])

  const handleFile = async (file: File) => {
    if (!file) return
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
    if (!allowed.includes(file.type)) { setLogoStatus({ type: 'error', message: 'Povolené formáty: PNG, JPG, SVG, WebP' }); return }
    if (file.size > 2 * 1024 * 1024) { setLogoStatus({ type: 'error', message: 'Maximálna veľkosť súboru je 2 MB' }); return }
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
    setUploading(true); setLogoStatus(null)
    try {
      const fd = new FormData(); fd.append('logo', file)
      const res = await fetch('/api/settings/logo', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload zlyhal')
      setLogoUrl(`${data.url}?t=${Date.now()}`)
      setLogoStatus({ type: 'success', message: 'Logo bolo úspešne nahrané.' })
    } catch (e: any) { setLogoStatus({ type: 'error', message: e.message }) }
    finally { setUploading(false) }
  }

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }

  const handleSavePhone = async () => {
    if (!phone.trim()) { setPhoneStatus({ type: 'error', message: 'Zadajte telefónne číslo' }); return }
    setPhoneLoading(true); setPhoneStatus(null)
    try {
      const res = await fetch('/api/settings/phone', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Uloženie zlyhalo')
      setPhoneStatus({ type: 'success', message: 'Telefónne číslo bolo uložené.' })
    } catch (e: any) { setPhoneStatus({ type: 'error', message: e.message }) }
    finally { setPhoneLoading(false) }
  }

  const handleSaveEmail = async () => {
    if (!imapHost.trim() || !imapUser.trim() || !imapPass.trim()) { setEmailStatus({ type: 'error', message: 'Vyplňte IMAP host, používateľa a heslo.' }); return }
    setEmailLoading(true); setEmailStatus(null)
    try {
      const res = await fetch('/api/settings/email', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_imap_host: imapHost, email_imap_port: imapPort, email_imap_secure: String(imapSecure), email_imap_user: imapUser, email_imap_pass: imapPass, email_imap_enabled: String(imapEnabled) }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Uloženie zlyhalo')
      setEmailStatus({ type: 'success', message: 'IMAP nastavenia boli uložené.' })
    } catch (e: any) { setEmailStatus({ type: 'error', message: e.message }) }
    finally { setEmailLoading(false) }
  }

  const handleTestConnection = async () => {
    if (!imapHost.trim() || !imapUser.trim() || !imapPass.trim()) { setEmailStatus({ type: 'error', message: 'Vyplňte host, používateľa a heslo pred testom.' }); return }
    setTestingConn(true); setEmailStatus(null)
    try {
      const res = await fetch('/api/settings/email/test', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: imapHost, port: parseInt(imapPort), secure: imapSecure, user: imapUser, pass: imapPass }) })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Pripojenie zlyhalo')
      setEmailStatus({ type: 'success', message: `Pripojenie úspešné! Správ v INBOX: ${data.messageCount}` })
    } catch (e: any) { setEmailStatus({ type: 'error', message: e.message }) }
    finally { setTestingConn(false) }
  }

  const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sycom-300 focus:border-sycom-400 transition-colors'
  const labelCls = 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block'
  const StatusBox = ({ s }: { s: typeof emailStatus }) => s ? (
    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm ${s.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
      {s.type === 'success' ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
      {s.message}
    </div>
  ) : null

  return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto py-8 px-6 space-y-6">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Nastavenia</h1>
          <p className="text-sm text-gray-500 mt-1">Prispôsobte vzhľad a správanie portálu</p>
        </div>

        {/* Logo */}
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
                  {logoUrl ? <img src={logoUrl} alt="Logo" className="object-contain max-h-14 max-w-[150px]" /> : <div className="flex flex-col items-center gap-1 text-gray-300"><ImageIcon size={20} /><span className="text-[10px]">Žiadne logo</span></div>}
                </div>
                {logoUrl && <button onClick={() => { setPreview(null); setLogoUrl(null) }} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"><Trash2 size={13} /> Odstrániť</button>}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Nahrať nové logo</p>
              <div className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-sycom-400 bg-sycom-50' : 'border-gray-200 hover:border-sycom-300 hover:bg-gray-50'}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                {preview ? <div className="flex flex-col items-center gap-3"><img src={preview} alt="Preview" className="max-h-20 max-w-[200px] object-contain rounded-lg border border-gray-200" /><p className="text-xs text-gray-500">Kliknite pre zmenu</p></div>
                  : <div className="flex flex-col items-center gap-3"><div className="w-12 h-12 rounded-full bg-sycom-50 border border-sycom-100 flex items-center justify-center"><Upload size={20} className="text-sycom-500" /></div><div><p className="text-sm font-medium text-gray-700">Pretiahnite súbor sem alebo kliknite</p><p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG, WebP · max 2 MB</p></div></div>}
              </div>
            </div>
            <StatusBox s={logoStatus} />
            <div className="flex justify-end">
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2 px-5 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50">
                <Upload size={15} />{uploading ? 'Nahrávam...' : 'Nahrať logo'}
              </button>
            </div>
          </div>
        </div>

        {/* Phone */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Helpdesk telefónne číslo</h2>
            <p className="text-xs text-gray-500 mt-0.5">Zobrazí sa v dolnej časti ľavého panela.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSavePhone()} placeholder="napr. 0948 938 217"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sycom-300" />
              </div>
              <button onClick={handleSavePhone} disabled={phoneLoading} className="flex items-center gap-2 px-5 py-2.5 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50">
                <Save size={15} />{phoneLoading ? 'Ukladám...' : 'Uložiť'}
              </button>
            </div>
            <StatusBox s={phoneStatus} />
          </div>
        </div>

        {/* Email → Tiket */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Mail size={16} className="text-sycom-500" />Email → Tiket (IMAP)</h2>
                <p className="text-xs text-gray-500 mt-0.5">Portál automaticky číta schránku a vytvára tikety podľa e-mailových aliasov klientov.</p>
              </div>
              <button onClick={() => setImapEnabled(!imapEnabled)}
                className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${imapEnabled ? 'text-green-700 bg-green-50 hover:bg-green-100' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}>
                {imapEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                {imapEnabled ? 'Zapnuté' : 'Vypnuté'}
              </button>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}><Server size={11} className="inline mr-1" />IMAP Server</label>
                <input type="text" value={imapHost} onChange={e => setImapHost(e.target.value)} placeholder="mail.sycom.sk" className={inputCls} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Port</label>
                <div className="flex items-center gap-3">
                  <input type="number" value={imapPort} onChange={e => setImapPort(e.target.value)} placeholder="993"
                    className="w-28 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sycom-300" />
                  <button onClick={() => { setImapSecure(!imapSecure); setImapPort(!imapSecure ? '993' : '143') }}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${imapSecure ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                    <Lock size={12} />{imapSecure ? 'SSL/TLS' : 'Bez SSL'}
                  </button>
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Používateľ (e-mail)</label>
                <input type="email" value={imapUser} onChange={e => setImapUser(e.target.value)} placeholder="portal@sycom.sk" className={inputCls} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Heslo</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={imapPass} onChange={e => setImapPass(e.target.value)} placeholder="••••••••" className={`${inputCls} pr-10`} />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
              <strong>Ako to funguje:</strong> Poller beží každé 2 minúty, číta neprecítané správy z INBOX a porovnáva adresu príjemcu s aliasmi klientov (nastavte alias pri každom klientovi v sekcii Klienti). Prílohy sa automaticky ukladajú k tiketu.
            </div>
            <StatusBox s={emailStatus} />
            <div className="flex items-center justify-between pt-1">
              <button onClick={handleTestConnection} disabled={testingConn}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50">
                <Mail size={14} />{testingConn ? 'Testujem...' : 'Otestovať pripojenie'}
              </button>
              <button onClick={handleSaveEmail} disabled={emailLoading}
                className="flex items-center gap-2 px-5 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50">
                <Save size={15} />{emailLoading ? 'Ukladám...' : 'Uložiť nastavenia'}
              </button>
            </div>
          </div>
        </div>

      </div>
    </PortalLayout>
  )
}
TSEOF
echo "  ✓ Updated settings/page.tsx"

echo ""
echo "══════════════════════════════════════════"
echo "  STEP 7 — Create email poller script"
echo "══════════════════════════════════════════"
mkdir -p scripts

cat > scripts/email-poller.js << 'JSEOF'
'use strict'
const { ImapFlow } = require('imapflow')
const { simpleParser } = require('mailparser')
const { PrismaClient } = require('@prisma/client')
const fs = require('fs'), path = require('path')
const prisma = new PrismaClient()
const POLL_INTERVAL = 2 * 60 * 1000
const ATT_DIR = '/opt/sycom-portal/public/uploads/attachments'

function sla(p) { return new Date(Date.now() + ({LOW:24,MEDIUM:8,HIGH:4,CRITICAL:2}[p]??8)*3600000) }

async function settings() {
  const rows = await prisma.setting.findMany({ where:{ key:{ in:['email_imap_host','email_imap_port','email_imap_secure','email_imap_user','email_imap_pass','email_imap_enabled'] } } })
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

async function process(imap, msg) {
  const p = await simpleParser(msg.source)
  const addrs = [p.to?.value ?? []].flat().map(a => a.address?.toLowerCase()).filter(Boolean)
  let client = null
  for (const a of addrs) { client = await prisma.client.findFirst({ where: { emailAlias: a } }); if (client) break }
  if (!client) { await imap.messageFlagsAdd(msg.seq,['\\Seen']); return }
  const creator = await prisma.user.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: 'asc' } })
  if (!creator) { await imap.messageFlagsAdd(msg.seq,['\\Seen']); return }
  const subject = (p.subject||'(bez predmetu)').substring(0,200)
  const priority = subject.toLowerCase().includes('urgent') ? 'HIGH' : 'MEDIUM'
  let desc = (p.text||'').trim() || (p.html||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim() || '(bez obsahu)'
  const ticket = await prisma.ticket.create({ data: { subject, description: desc, priority, category: 'EMAIL', clientId: client.id, creatorId: creator.id, slaDeadline: sla(priority) } })
  console.log(`[poller] ✓ #${ticket.ticketNumber} "${subject}" → ${client.name}`)
  if (p.attachments?.length) {
    if (!fs.existsSync(ATT_DIR)) fs.mkdirSync(ATT_DIR, { recursive: true })
    for (const a of p.attachments) {
      try {
        const fn = `${ticket.id}-${Date.now()}-${(a.filename||'file').replace(/[^a-zA-Z0-9._-]/g,'_')}`
        fs.writeFileSync(path.join(ATT_DIR, fn), a.content)
        await prisma.attachment.create({ data: { ticketId: ticket.id, filename: a.filename||'file', fileUrl: `/uploads/attachments/${fn}`, fileSize: a.size??a.content.length, mimeType: a.contentType||'application/octet-stream' } })
      } catch(e) { console.error('[poller] att error:', e.message) }
    }
  }
  await imap.messageFlagsAdd(msg.seq,['\\Seen'])
}

async function poll() {
  const s = await settings()
  if (s.email_imap_enabled !== 'true') { console.log('[poller] disabled'); return }
  const imap = new ImapFlow({ host: s.email_imap_host, port: +s.email_imap_port||993, secure: s.email_imap_secure==='true', auth: { user: s.email_imap_user, pass: s.email_imap_pass }, logger: false })
  try {
    await imap.connect()
    const lock = await imap.getMailboxLock('INBOX')
    try {
      const uids = await imap.search({ seen: false })
      console.log(`[poller] ${uids.length} unseen`)
      if (uids.length) for await (const msg of imap.fetch(uids, { source: true })) { try { await process(imap, msg) } catch(e) { console.error(e.message) } }
    } finally { lock.release() }
    await imap.logout()
  } catch(e) { console.error('[poller] IMAP:', e.message); try { await imap.logout() } catch {} }
}

async function main() {
  console.log('[poller] starting, interval=2min')
  if (!fs.existsSync(ATT_DIR)) fs.mkdirSync(ATT_DIR, { recursive: true })
  await poll()
  setInterval(() => poll().catch(e => console.error(e.message)), POLL_INTERVAL)
}
main().catch(e => { console.error(e); process.exit(1) })
JSEOF
echo "  ✓ Created scripts/email-poller.js"

echo ""
echo "══════════════════════════════════════════"
echo "  STEP 8 — Install npm packages"
echo "══════════════════════════════════════════"
npm install imapflow mailparser
echo "  ✓ imapflow + mailparser installed"

echo ""
echo "══════════════════════════════════════════"
echo "  STEP 9 — Push to GitHub"
echo "══════════════════════════════════════════"
git add -A
git commit -m "feat: email-to-ticket — IMAP poller, emailAlias on Client, Setting model, email settings UI"
git push origin HEAD
echo "  ✓ Pushed to GitHub"

echo ""
echo "══════════════════════════════════════════"
echo "  STEP 10 — Prisma + Build + Restart"
echo "══════════════════════════════════════════"
npx prisma db push
npx prisma generate
npm run build && pm2 restart sycom-portal
echo "  ✓ Portal restarted"

echo ""
echo "══════════════════════════════════════════"
echo "  STEP 11 — Start email poller"
echo "══════════════════════════════════════════"
pm2 start scripts/email-poller.js --name email-poller 2>/dev/null || pm2 restart email-poller
pm2 save
echo "  ✓ Email poller running"

echo ""
echo "════════════════════════════════════════════════════"
echo "  ALL DONE!"
echo "  Next steps:"
echo "  1. Go to Nastavenia → fill in IMAP settings → Save"
echo "  2. Go to Klienti → set emailAlias per client"
echo "  3. Create the alias on your Exchange server"
echo "════════════════════════════════════════════════════"
