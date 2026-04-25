'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { Save, KeyRound, CheckCircle, AlertCircle, User } from 'lucide-react'

export default function ProfilePage() {
  const { data: session, update } = useSession()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameStatus, setNameStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newPass2, setNewPass2] = useState('')
  const [passLoading, setPassLoading] = useState(false)
  const [passStatus, setPassStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name ?? '')
      setEmail(session.user.email ?? '')
    }
  }, [session])

  const handleSaveName = async () => {
    if (!name.trim()) { setNameStatus({ type: 'error', message: 'Meno nesmie byť prázdne.' }); return }
    setNameLoading(true); setNameStatus(null)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Uloženie zlyhalo')
      await update({ name })
      setNameStatus({ type: 'success', message: 'Meno bolo uložené.' })
    } catch (e: any) {
      setNameStatus({ type: 'error', message: e.message })
    } finally { setNameLoading(false) }
  }

  const handleChangePassword = async () => {
    if (!oldPass || !newPass || !newPass2) { setPassStatus({ type: 'error', message: 'Vyplňte všetky polia.' }); return }
    if (newPass !== newPass2) { setPassStatus({ type: 'error', message: 'Nové heslá sa nezhodujú.' }); return }
    if (newPass.length < 8) { setPassStatus({ type: 'error', message: 'Nové heslo musí mať aspoň 8 znakov.' }); return }
    setPassLoading(true); setPassStatus(null)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: oldPass, password: newPass }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Zmena hesla zlyhala')
      setOldPass(''); setNewPass(''); setNewPass2('')
      setPassStatus({ type: 'success', message: 'Heslo bolo úspešne zmenené.' })
    } catch (e: any) {
      setPassStatus({ type: 'error', message: e.message })
    } finally { setPassLoading(false) }
  }

  const inputClass = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sycom-300 focus:border-sycom-400 transition-colors'
  const labelClass = 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block'

  return (
    <PortalLayout>
      <div className="max-w-xl mx-auto py-8 px-6 space-y-6">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Môj profil</h1>
          <p className="text-sm text-gray-500 mt-1">Upravte svoje osobné údaje a heslo</p>
        </div>

        {/* Avatar + info */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-sycom-500 text-white text-xl font-bold flex items-center justify-center shrink-0">
            {name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || <User size={22} />}
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{name}</p>
            <p className="text-sm text-gray-400">{email}</p>
          </div>
        </div>

        {/* Meno */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Zobrazované meno</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className={labelClass}>Meno a priezvisko</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                placeholder="Meno Priezvisko" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>E-mail (neupraviteľný)</label>
              <input type="email" value={email} readOnly
                className="w-full px-3 py-2.5 border border-gray-100 rounded-xl text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
            </div>
            {nameStatus && (
              <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm ${nameStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                {nameStatus.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                {nameStatus.message}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={handleSaveName} disabled={nameLoading}
                className="flex items-center gap-2 px-5 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
                <Save size={15} />
                {nameLoading ? 'Ukladám...' : 'Uložiť meno'}
              </button>
            </div>
          </div>
        </div>

        {/* Heslo */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <KeyRound size={16} className="text-sycom-500" />
              Zmena hesla
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className={labelClass}>Aktuálne heslo</label>
              <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)}
                placeholder="••••••••" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Nové heslo</label>
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
                placeholder="min. 8 znakov" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Potvrdiť nové heslo</label>
              <input type="password" value={newPass2} onChange={e => setNewPass2(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                placeholder="••••••••" className={inputClass} />
            </div>
            {passStatus && (
              <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm ${passStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                {passStatus.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                {passStatus.message}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={handleChangePassword} disabled={passLoading}
                className="flex items-center gap-2 px-5 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
                <KeyRound size={15} />
                {passLoading ? 'Mením...' : 'Zmeniť heslo'}
              </button>
            </div>
          </div>
        </div>

      </div>
    </PortalLayout>
  )
}
